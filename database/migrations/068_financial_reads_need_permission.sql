-- 068 - القراءة المالية بقت محتاجة صلاحية، مش عضوية في المحل.
--
-- دي الثغرة الأصلية، الحتة اللي كانت لسه مفتوحة في قاعدة البيانات.
--
-- اتصلح قبل كده الـAPI: بقى بيرجّع 403 لو اللي بيسأل مش owner. بس
-- الكاشير معاه نفس الـanon key بتاع Supabase (هو مكتوب في صفحة الويب،
-- ده طبيعي)، فكان يقدر يعدّي البرنامج كله ويضرب على /rest/v1/sales
-- على طول. الـpolicies كانت بتقول "الصف بتاع محلك؟ اتفضل" - من غير أي
-- سؤال عن الدور. يعني الكاشير كان يقرا كل المبيعات والمشتريات
-- والمصاريف من أول يوم.
--
-- التصليح في نقطة الاختناق زي كل مرة: policy واحدة لكل جدول، بتسأل عن
-- الصلاحية.
--
-- والقاعدة اللي اتحطت: كل واحد يشوف اللي عمله هو (created_by)، واللي
-- معاه view_reports يشوف الكل. الكاشير محتاج يفتح فواتيره عشان يطبع
-- إيصال أو يرجّع بيعة - لو منعناه من ده كنا نكون كسرنا الشغل عشان
-- نأمّنه.

-- زي has_permission() بالظبط، **من غير** شرط إن الاشتراك شغال.
--
-- السبب: migration 066 خلّى has_permission() ترجّع false لو المحل خلص
-- اشتراكه. ده صح للكتابة، بس لو استعملناها هنا كمان يبقى المحل اللي
-- اشتراكه خلص مش هيشوف بياناته - وده بالظبط عكس اللي اتفقنا عليه
-- ("يقدر يشوف كل حاجة، بس البيع والتعديل مقفولين"). فالقراءة ليها
-- دالة لوحدها.
create or replace function public.has_read_permission(p_key text)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
    v_role text;
    v_staff_role text;
    v_extra text[];
begin
    select role, staff_role, extra_permissions
    into v_role, v_staff_role, v_extra
    from users
    where auth_user_id = auth.uid() and active = true;

    if not found then
        return false;
    end if;

    if v_role = 'owner' then
        return true;
    end if;

    return p_key = any(staff_role_permissions(v_staff_role) || coalesce(v_extra, '{}'));
end;
$$;

comment on function public.has_read_permission(text) is
  'زي has_permission() لكن بتتجاهل حالة الاشتراك. للقراءة بس - المحل اللي خلص اشتراكه لازم يفضل شايف بياناته.';

-- created_by في الجداول دي بيشاور على users.id مش على auth.uid()،
-- فمحتاجين نترجم. دالة لوحدها عشان الترجمة تبقى في مكان واحد.
create or replace function public.my_user_id()
returns uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select id from users where auth_user_id = auth.uid() and active = true
$$;

-- ---------- المبيعات ----------
drop policy if exists sales_read on sales;
create policy sales_read on sales
    for select to authenticated
    using (
        business_id = get_my_business_id()
        and (has_read_permission('view_reports') or created_by = my_user_id())
    );

-- بنود الفاتورة مالهاش business_id، فبتسأل الفاتورة نفسها - ولازم
-- تسأل بنفس الشرط بالظبط، وإلا الكاشير يقفل عليه باب ويلاقي الشباك
-- مفتوح (يقرا أسعار البيع من البنود من غير ما يقرا الفواتير).
drop policy if exists sale_items_read on sale_items;
create policy sale_items_read on sale_items
    for select to authenticated
    using (
        exists (
            select 1 from sales s
            where s.id = sale_items.sale_id
              and s.business_id = get_my_business_id()
              and (has_read_permission('view_reports') or s.created_by = my_user_id())
        )
    );

-- ---------- المشتريات ----------
-- receive_stock كمان، لأن اللي بيستلم البضاعة لازم يشوف أمر الشراء
-- اللي بيستلم عليه.
drop policy if exists purchases_read on purchases;
create policy purchases_read on purchases
    for select to authenticated
    using (
        business_id = get_my_business_id()
        and (
            has_read_permission('view_reports')
            or has_read_permission('receive_stock')
            or created_by = my_user_id()
        )
    );

-- ---------- المصاريف ----------
drop policy if exists expenses_read on expenses;
create policy expenses_read on expenses
    for select to authenticated
    using (
        business_id = get_my_business_id()
        and (has_read_permission('view_reports') or created_by = my_user_id())
    );

-- كانت نسخة تانية من نفس شرط الاشتراك، متكتوبة بإيد. نسختين من نفس
-- القاعدة معناها إن واحدة منهم هتتنسى يوم ما القاعدة تتغير.
create or replace function public.business_is_active(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select subscription_open(p_business_id)
$$;

-- الدوال دي SECURITY DEFINER، يعني بتشتغل بصلاحيات صاحبها. مفيش سبب
-- خالص إن حد غير مسجّل دخول يقدر يناديها.
revoke all on function public.has_read_permission(text) from anon;
revoke all on function public.my_user_id() from anon;
revoke all on function public.business_is_active(uuid) from anon;

-- اتجرّب على البيانات الحقيقية بحساب كاشير حقيقي، قبل وبعد:
--
--   قبل:  sales 34, sale_items 34, purchases 12, expenses 9
--   بعد:  sales 0,  sale_items 0,  purchases 0,  expenses 0
--
--   المالك ما اتغيرش: 43 / 46 / 12 / 9، و100 صنف.
--
-- لسه ناقص: buy_price في items و stock_batches الكاشير لسه بيقراه.
-- ده منع على مستوى العمود (revoke + دوال قراءة)، والكود المرفوع
-- حاليًا بيقرا العمود ده مباشرة - فلازم يتعمل بعد رفعة الكود الجديد
-- مش قبلها.
