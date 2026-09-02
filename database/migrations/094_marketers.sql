-- ============================================================
-- 094 — المسوقين: عمولة لمرة واحدة + حساب دخول خاص
-- ============================================================
--
-- باسل: "عندي أزمة مادية وعايز أبدأ أشغّل المسوقين بـ٥٠٠ ج لكل حد
-- هيجيبه، ويظهر أكونت تسويقي مختلف لكل نشاط يقدر المسوق يستعمله."
--
-- وقرّر التلات حاجات دي بالنص:
--   ١. ٥٠٠ ج **مرة واحدة** لكل محل (مش شهري)
--   ٢. كل مسوق له حساب دخول محدود، وجواه اسطمبات عرض لكل نوع نشاط
--   ٣. العمولة تستحق **أول ما المحل يدفع أول اشتراك**
--
-- ------------------------------------------------------------
-- ليه "أول ما يدفع" هي النقطة الوحيدة الصح
-- ------------------------------------------------------------
--
-- لو الاستحقاق عند التسجيل، أي مسوق يقدر يفتح عشر حسابات وهمية في
-- ساعة وياخد ٥٠٠٠ ج على محلات مش موجودة. وde آخر حاجة يحتاجها حد
-- في أزمة مادية.
--
-- والحلو إن النقطة دي **مبنية أصلًا**: تريجر
-- `qualify_referral_on_payment` بيولع لما `subscription_expires_at`
-- تتحرك للمستقبل أول مرة. الميجريشن ده بيركب عليه، مابيعملش واحد
-- جديد.
--
-- ------------------------------------------------------------
-- المبلغ بيتجمّد على الإحالة نفسها
-- ------------------------------------------------------------
--
-- `referral_codes.signup_reward` هو السعر **الحالي** للكود.
-- و`referrals.signup_reward` هو المبلغ اللي اتحدد للمحل ده وقت ما
-- استحق. لو باسل غيّر الـ٥٠٠ لـ٣٠٠ الشهر الجاي، المحلات اللي
-- استحقت بـ٥٠٠ تفضل بـ٥٠٠.
--
-- من غير التجميد ده، تعديل رقم واحد في شاشة الماستر كان هيغيّر
-- **كل** المستحقات القديمة بأثر رجعي - يعني خلاف مع المسوق على فلوس
-- هو شافها على شاشته الأسبوع اللي فات.

-- ------------------------------------------------------------
-- ١. أعمدة العمولة
-- ------------------------------------------------------------

alter table public.referral_codes
  add column if not exists signup_reward numeric not null default 500;

alter table public.referrals
  add column if not exists signup_reward   numeric,
  add column if not exists signup_paid_at  timestamptz,
  add column if not exists signup_payout_id uuid references public.referral_payouts(id);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'referral_codes_signup_reward_sane'
  ) then
    alter table public.referral_codes
      add constraint referral_codes_signup_reward_sane
      check (signup_reward >= 0 and signup_reward <= 100000);
  end if;
end $$;

-- الصلاحيات بالاسم. الجدولين دول عليهم grants على مستوى العمود،
-- يعني أي عمود جديد ممنوع افتراضيًا - و`getReferralSummaries`
-- بتعمل `select("*")` على `referral_codes`، فعمود من غير grant
-- كان هيكسر شاشة الإحالة عند باسل وعند كل صاحب محل.
grant select (signup_reward) on public.referral_codes to authenticated;

grant select (signup_reward, signup_paid_at, signup_payout_id)
  on public.referrals to authenticated;

-- الكتابة من الماستر بمفتاح service_role بس. مفيش grant.

-- ------------------------------------------------------------
-- ٢. التريجر بيجمّد المبلغ وقت الاستحقاق
-- ------------------------------------------------------------
--
-- نفس التريجر القديم بالظبط + سطر `signup_reward`. اتكتب كامل مش
-- مُعدّل عشان النسخة المكتوبة هنا تبقى هي اللي في القاعدة.

create or replace function public.qualify_referral_on_payment()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
    if new.subscription_expires_at is not null
       and new.subscription_expires_at > now()
       and (old.subscription_expires_at is null or old.subscription_expires_at <= now())
    then
        update referrals r
        set qualified_at = now(),
            reward_ends_at = now() + make_interval(months => c.reward_months),
            -- السعر بيتصوّر هنا ومابيتغيّرش تاني.
            signup_reward = coalesce(r.signup_reward, c.signup_reward)
        from referral_codes c
        where c.id = r.referral_code_id
          and r.referred_business_id = new.id
          and r.qualified_at is null;
    end if;

    return new;
end;
$function$;

-- ------------------------------------------------------------
-- ٣. جدول المسوقين
-- ------------------------------------------------------------
--
-- المسوق **مش مستخدم في محل**. مالوش صف في `users`، وعشان كده
-- `get_my_business_id()` بترجّعله null وكل policy في البرنامج
-- بترفضه تلقائيًا. de مش صدفة - ده الحاجز الأساسي.
--
-- والجدول ده نفسه مقفول: RLS شغّالة و**مفيش ولا policy** لـ
-- authenticated، والصلاحيات مسحوبة. الباب الوحيد هو
-- `marketer_dashboard()` اللي بترجّع حقول محدّدة بالاسم.
--
-- **الحاجز هو محتوى الرد، مش بس الصلاحية** - نفس مبدأ
-- `my_shift_report` (ميجريشن ٠٨٦). لو اتضاف عمود مبيعات في الرد
-- ده، يبقى ثغرة.

create table if not exists public.marketers (
    id              uuid primary key default gen_random_uuid(),
    auth_user_id    uuid not null unique references auth.users(id) on delete cascade,
    referral_code_id uuid not null references public.referral_codes(id) on delete restrict,
    full_name       text not null,
    phone           text,
    active          boolean not null default true,
    created_at      timestamptz not null default now(),
    created_by      uuid
);

create index if not exists marketers_code_idx on public.marketers (referral_code_id);

alter table public.marketers enable row level security;

revoke all on public.marketers from authenticated, anon;

-- ------------------------------------------------------------
-- ٤. شاشة المسوق
-- ------------------------------------------------------------
--
-- كل اللي المسوق بيشوفه عن المحل اللي جابه: **اسمه، وتاريخ
-- تسجيله، وهل دفع ولا لأ، وهل عمولته اتصرفت**.
--
-- مفيش مبيعات، ولا أصناف، ولا تليفون صاحب المحل، ولا حتى قيمة
-- اشتراكه. المسوق جاب المحل فهو عارف اسمه أصلًا؛ الباقي مش شغله.
--
-- بترجّع jsonb مش table عشان تجمع الملخص والقايمة في نداء واحد -
-- شاشة واحدة، طلب واحد.

create or replace function public.marketer_dashboard()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_marketer  record;
    v_shops     jsonb;
    v_due       numeric;
    v_paid      numeric;
    v_pending   int;
begin
    select m.id, m.full_name, m.phone, m.active,
           c.id as code_id, c.code, c.signup_reward, c.active as code_active
      into v_marketer
      from marketers m
      join referral_codes c on c.id = m.referral_code_id
     where m.auth_user_id = auth.uid();

    if not found then
        raise exception 'الحساب ده مش حساب مسوّق';
    end if;

    if not v_marketer.active then
        raise exception 'حسابك متوقف - كلّم الإدارة';
    end if;

    select coalesce(jsonb_agg(row order by signed_up desc), '[]'::jsonb)
      into v_shops
      from (
        select
            jsonb_build_object(
                'shopName',  b.name,
                'signedUp',  r.created_at,
                'paid',      r.qualified_at is not null,
                'paidAt',    r.qualified_at,
                'reward',    coalesce(r.signup_reward, v_marketer.signup_reward),
                'settled',   r.signup_paid_at is not null,
                'settledAt', r.signup_paid_at
            ) as row,
            r.created_at as signed_up
        from referrals r
        join businesses b on b.id = r.referred_business_id
        where r.referral_code_id = v_marketer.code_id
      ) s;

    -- مستحق = المحل دفع، والعمولة لسه ما اتصرفتش.
    select
        coalesce(sum(case
            when r.qualified_at is not null and r.signup_paid_at is null
            then coalesce(r.signup_reward, v_marketer.signup_reward) else 0 end), 0),
        coalesce(sum(case
            when r.signup_paid_at is not null
            then coalesce(r.signup_reward, v_marketer.signup_reward) else 0 end), 0),
        count(*) filter (where r.qualified_at is null)
      into v_due, v_paid, v_pending
      from referrals r
     where r.referral_code_id = v_marketer.code_id;

    return jsonb_build_object(
        'name',        v_marketer.full_name,
        'code',        v_marketer.code,
        'codeActive',  v_marketer.code_active,
        'rewardEach',  v_marketer.signup_reward,
        'due',         v_due,
        'paid',        v_paid,
        'pendingCount', v_pending,
        'shops',       v_shops
    );
end;
$$;

revoke all on function public.marketer_dashboard() from public, anon;
grant execute on function public.marketer_dashboard() to authenticated;

-- ------------------------------------------------------------
-- ٥. "أنا مسوّق؟" — سؤال رخيص عشان التوجيه بعد الدخول
-- ------------------------------------------------------------
--
-- `marketer_dashboard()` بترمي استثناء لو الحساب مش مسوّق، وde
-- صح ليها بس غالي لو الغرض مجرد "أروح فين بعد اللوجين".

create or replace function public.am_i_marketer()
returns boolean
language sql
security definer
set search_path to 'public'
stable
as $$
    select exists (
        select 1 from marketers
        where auth_user_id = auth.uid() and active
    );
$$;

revoke all on function public.am_i_marketer() from public, anon;
grant execute on function public.am_i_marketer() to authenticated;

notify pgrst, 'reload schema';

-- ------------------------------------------------------------
-- ٦. صرف المستحقات — عملية واحدة
-- ------------------------------------------------------------
--
-- الصرف تلات كتابات مترابطة: سطر في دفتر المدفوعات، وختم على كل
-- إحالة اتصرفت، وربط الاتنين. لو اتعملوا من الـAPI واحد ورا التاني
-- وقطع في النص، يا سطر مدفوعات من غير إحالات متختومة (فالمستحق
-- يفضل ظاهر ويتصرف تاني)، يا إحالات متختومة من غير سطر (فالفلوس
-- تختفي من الدفتر).
--
-- **بصلاحية service_role بس.** الدالة دي بتكتب في جدول
-- append-only، ومحدش من المتصفح المفروض يوصلها - حتى باسل نفسه
-- بيوصلها من خلال مسار الماستر اللي بيتأكد من هويته الأول.

create or replace function public.settle_marketer_commissions(
    p_marketer_id uuid,
    p_note text default null,
    p_recorded_by uuid default null
) returns numeric
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_code uuid;
    v_total numeric;
    v_payout uuid;
begin
    select referral_code_id into v_code from marketers where id = p_marketer_id;

    if v_code is null then
        raise exception 'المسوّق مش موجود';
    end if;

    select coalesce(sum(coalesce(r.signup_reward, c.signup_reward)), 0)
      into v_total
      from referrals r
      join referral_codes c on c.id = r.referral_code_id
     where r.referral_code_id = v_code
       and r.qualified_at is not null
       and r.signup_paid_at is null;

    if v_total <= 0 then
        raise exception 'مفيش مستحقات دلوقتي';
    end if;

    insert into referral_payouts (referral_code_id, amount, period_label, note, recorded_by)
    values (v_code, v_total, to_char(now(), 'YYYY-MM'), p_note, p_recorded_by)
    returning id into v_payout;

    update referrals r
       set signup_paid_at = now(),
           signup_payout_id = v_payout,
           signup_reward = coalesce(r.signup_reward, c.signup_reward)
      from referral_codes c
     where c.id = r.referral_code_id
       and r.referral_code_id = v_code
       and r.qualified_at is not null
       and r.signup_paid_at is null;

    return v_total;
end;
$$;

revoke all on function public.settle_marketer_commissions(uuid, text, uuid)
  from public, anon, authenticated;

grant execute on function public.settle_marketer_commissions(uuid, text, uuid)
  to service_role;

notify pgrst, 'reload schema';
