-- ============================================================
-- 099 — «قريبًا»: تسجيل طلب على مجال البرنامج مابيخدمهوش
-- ============================================================
--
-- باسل لقى حدود المنتج وهو بيراجع شاشة العرض:
--
--   "فيه أنشطة محتاجة حاجات مش عندي لسه، زي المواعيد والاشتراكات
--    في الجيمات."
--
-- وهو محق. الأخطبوط بيبيع **أصناف ليها مخزون**. الجيم بيبيع
-- **اشتراك بمدة**، والعيادة بتبيع **ميعاد**. دول مش أصناف - دول
-- شكل منتج تاني (اشتراكات متكررة + تقويم).
--
-- ------------------------------------------------------------
-- القرار: نعرض «قريبًا» ونجمّع طلبات
-- ------------------------------------------------------------
--
-- التلات اختيارات كانت: نخفيها، ونبنيها دلوقتي، ونجمّع طلبات.
-- باسل اختار التالت، وده الصح: البناء أسبوعين لحاجة **مفيش عميل
-- واحد طلبها لحد دلوقتي**، والإخفاء بيضيّع المعلومة خالص.
--
-- والأهم إن الشاشة بتقول للمسوّق صراحةً «البرنامج لسه مابيعملش
-- ده». **مسوّق بيوعد بحاجة مش موجودة بيوقّع محل في مشكلة، والمحل
-- ده بيبقى أول واحد يشتكي ويمشي** - وسمعتك في بلد صغير أغلى من
-- اشتراك.
--
-- ------------------------------------------------------------
-- الجدول append-only
-- ------------------------------------------------------------
--
-- زي `cart_audit_log` و`referral_payouts`: مفيش UPDATE ولا DELETE
-- policies خالص. طلب اتسجّل يفضل - العدد نفسه هو المعلومة، ولو
-- بيتمسح مابقاش عدد.
--
-- والمسوّق **مالوش أي صلاحية على الجدول** (زي كل حاجة تانية).
-- الباب الوحيد دالة بتكتب سطر واحد وبترجّع "تمام".

create table if not exists public.vertical_interest (
    id            uuid primary key default gen_random_uuid(),

    -- المجال زي ما هو معروض في الشاشة: 'gym'، 'clinic'، 'school'...
    vertical      text not null,

    shop_name     text not null,
    phone         text,
    note          text,

    -- مين سجّله. مسوّق أو صاحب محل - الاتنين ممكن يقولوا "نفسي في
    -- كذا"، والفرق مهم وقت القراءة.
    marketer_id   uuid references public.marketers(id) on delete set null,
    business_id   uuid references public.businesses(id) on delete set null,

    created_at    timestamptz not null default now()
);

create index if not exists vertical_interest_vertical_idx
  on public.vertical_interest (vertical, created_at desc);

alter table public.vertical_interest enable row level security;

revoke all on public.vertical_interest from authenticated, anon;

-- ------------------------------------------------------------
-- التسجيل
-- ------------------------------------------------------------
--
-- بتقبل من مسوّق شغّال أو صاحب محل. أي حد تاني بيترفض.
--
-- **مفيش قراءة هنا خالص** - المسوّق مايشوفش طلبات غيره ولا حتى
-- بتاعته. هو بيسجّل ويمشي، وباسل هو اللي بيقرا من الماستر.

create or replace function public.log_vertical_interest(
    p_vertical  text,
    p_shop_name text,
    p_phone     text default null,
    p_note      text default null
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
    v_marketer uuid;
    v_business uuid;
begin
    select id into v_marketer
      from marketers where auth_user_id = auth.uid() and active;

    v_business := get_my_business_id();

    if v_marketer is null and v_business is null then
        raise exception 'غير مصرّح';
    end if;

    if coalesce(btrim(p_vertical), '') = '' then
        raise exception 'اختار المجال';
    end if;

    if coalesce(btrim(p_shop_name), '') = '' then
        raise exception 'اكتب اسم المحل';
    end if;

    -- حدود بسيطة على الطول: الحقول دي بتتعرض في شاشة الماستر،
    -- ونص طويل جدًا بيبوّظ الشاشة من غير ما يضيف معلومة.
    insert into vertical_interest (
        vertical, shop_name, phone, note, marketer_id, business_id
    ) values (
        left(btrim(p_vertical), 40),
        left(btrim(p_shop_name), 120),
        nullif(left(btrim(coalesce(p_phone, '')), 30), ''),
        nullif(left(btrim(coalesce(p_note, '')), 500), ''),
        v_marketer,
        case when v_marketer is null then v_business else null end
    );
end;
$$;

revoke all on function public.log_vertical_interest(text, text, text, text)
  from public, anon;

grant execute on function public.log_vertical_interest(text, text, text, text)
  to authenticated;

notify pgrst, 'reload schema';
