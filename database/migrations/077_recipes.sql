-- 077 - الصنف المركّب (الوصفة).
--
-- تبيع كوباية اسبريسو، فيتخصم ١٨ جرام بن من المخزون. تبيع سندوتش،
-- يتخصم عيش وجبنة. الصنف اللي بتبيعه مش هو الصنف اللي بينقص.
--
-- ============================================================
-- ليه دي بالذات، ودلوقتي
-- ============================================================
--
-- ١. **كيرو كافيه.** أول عميل دافع، وأول سؤال هيسأله: "لما أبيع
--    كوباية، البن بينقص؟". من غير ده مخزونه كذب من أول يوم.
--
-- ٢. **أكبر فجوة مفتوحة في السوق المصري.** في بحث المنافسين
--    (docs/COMPETITORS_2026-08.md) الفيتشر دي اتأكدت في Foodics
--    وWeb Pioneer بس. Foodics بـ٢٨٥٠ ج/شهر وللمطاعم بس. دفترة —
--    أشهر برنامج في مصر — صفحة نقاط البيع بتاعتها مابتذكرهاش.
--
-- ============================================================
-- القرارات التصميمية
-- ============================================================
--
-- **الصنف اللي له مكوّنات مالوش مخزون خاص بيه.** مايتعدّش ومايتشتراش
-- - المكوّنات بس هي اللي ليها دفعات. ده مش تبسيط كسول: صنف له
-- مخزون **و**مكوّنات معناه رقمين للحقيقة الواحدة، وأول جرد هيكذّب
-- واحد فيهم. (نفس منطق §4: مصدر واحد للرقم.)
--
-- **التكلفة بتتجمّع من المكوّنات وقت البيع.** نفس FIFO، نفس المبدأ
-- اللي في ٠٧١: التكلفة بتتحسب جوه القاعدة ومابتخرجش للمتصفح.
--
-- **مفيش وصفة جوه وصفة.** لو مكوّن هو نفسه صنف مركّب، بنرفض إضافته.
-- التداخل ده بيفتح باب حلقات لا نهائية، والمحل اللي محتاجه بجد
-- (مصنع) مش عميلنا.
--
-- **إضافية بالكامل.** أي صنف مالوش صفوف في الجدول ده بيتصرّف زي ما
-- هو بالظبط. مفيش سطر واحد بيتغير في سلوك ٩٥ صنف عند كيرو دلوقتي.

create table if not exists public.item_components (
    id           uuid primary key default gen_random_uuid(),
    business_id  uuid not null references businesses(id) on delete cascade,

    -- الصنف اللي بيتباع
    parent_item_id    uuid not null references items(id) on delete cascade,

    -- الصنف اللي بينقص
    component_item_id uuid not null references items(id) on delete restrict,

    -- كام من المكوّن في الوحدة الواحدة من الأب.
    -- numeric مش integer: ١٨ جرام بن في الكوباية يعني 0.018 كيلو.
    quantity     numeric not null check (quantity > 0),

    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),

    -- مكوّن مرتين في نفس الوصفة غلط إدخال، مش حالة استعمال
    unique (parent_item_id, component_item_id),

    -- صنف مكوّن نفسه
    check (parent_item_id <> component_item_id)
);

create index if not exists item_components_parent_idx
    on public.item_components (parent_item_id);

create index if not exists item_components_component_idx
    on public.item_components (component_item_id);

comment on table public.item_components is
  'وصفة الصنف المركّب: بيع الأب بيخصم المكوّنات. الأب مالوش مخزون خاص بيه - المكوّنات بس هي اللي ليها دفعات.';

alter table public.item_components enable row level security;

-- القراءة لأي حد في المحل: الكاشير محتاج يعرف إن الصنف متاح ولا لأ،
-- والكميات دي مش معلومة حساسة (التكلفة هي الحساسة، وهي في item_costs).
create policy item_components_read on public.item_components
    for select using (business_id = get_my_business_id());

-- الكتابة بصلاحية إدارة الأصناف - نفس صلاحية تعديل الصنف نفسه.
create policy item_components_insert on public.item_components
    for insert with check (
        business_id = get_my_business_id()
        and has_permission('manage_items')
        and business_is_active(business_id)
    );

create policy item_components_update on public.item_components
    for update using (
        business_id = get_my_business_id()
        and has_permission('manage_items')
    ) with check (business_id = get_my_business_id());

create policy item_components_delete on public.item_components
    for delete using (
        business_id = get_my_business_id()
        and has_permission('manage_items')
    );

-- ============================================================
-- حراسة: مفيش وصفة جوه وصفة، ومفيش مكوّن من محل تاني
-- ============================================================
--
-- الشرطين دول مش ممكن يتكتبوا كـCHECK constraint لأنهم بيسألوا
-- جداول تانية. وRLS مابتحميش منهم: policy الإدخال بتتأكد إن
-- business_id بتاعك، مش إن **المكوّن** من محلك. من غير التريجر ده
-- تقدر تحط مكوّن من محل تاني في وصفتك.

create or replace function public.validate_item_component()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
    if not exists (
        select 1 from items
        where id = new.parent_item_id and business_id = new.business_id
    ) then
        raise exception 'الصنف الأساسي مش من نشاطك';
    end if;

    if not exists (
        select 1 from items
        where id = new.component_item_id and business_id = new.business_id
    ) then
        raise exception 'المكوّن مش من نشاطك';
    end if;

    -- المكوّن لازم يكون صنف ليه مخزون حقيقي. خدمة مالهاش دفعات
    -- تتسحب منها، فحطّها كمكوّن معناه إن الوصفة مش هتخصم حاجة.
    if not exists (
        select 1 from items
        where id = new.component_item_id and has_stock
    ) then
        raise exception 'المكوّن لازم يكون صنف له مخزون';
    end if;

    if exists (
        select 1 from item_components
        where parent_item_id = new.component_item_id
    ) then
        raise exception 'مينفعش مكوّن يكون هو نفسه صنف مركّب';
    end if;

    if exists (
        select 1 from item_components
        where component_item_id = new.parent_item_id
    ) then
        raise exception 'الصنف ده مستعمل كمكوّن في وصفة تانية';
    end if;

    return new;
end;
$$;

revoke all on function public.validate_item_component() from public, anon, authenticated;

drop trigger if exists trg_validate_item_component on public.item_components;

create trigger trg_validate_item_component
    before insert or update on public.item_components
    for each row execute function public.validate_item_component();

-- ============================================================
-- الكمية المتاحة من صنف مركّب
-- ============================================================
--
-- مش مجموع، دي **أقل** واحدة: لو عندك بن يكفي ٥٠ كوباية ولبن يكفي
-- ٨، إنت عندك ٨. الكوباية التاسعة مش موجودة مهما كان البن كتير.

create or replace function public.recipe_available(
    p_item_id uuid,
    p_warehouse_id uuid
)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  select min(
      floor(
          coalesce((
              select sum(b.remaining_quantity)
              from stock_batches b
              where b.item_id = c.component_item_id
                and b.warehouse_id = p_warehouse_id
                and b.remaining_quantity > 0
                and b.business_id = get_my_business_id()
          ), 0) / c.quantity
      )
  )
  from item_components c
  where c.parent_item_id = p_item_id
    and c.business_id = get_my_business_id();
$$;

comment on function public.recipe_available(uuid, uuid) is
  'أقل عدد وحدات ممكن تتعمل من صنف مركّب بالمخزون الموجود. بترجع null لو الصنف مالوش وصفة.';

revoke all on function public.recipe_available(uuid, uuid) from public, anon;
grant execute on function public.recipe_available(uuid, uuid) to authenticated;

-- available_quantity بقت تعرف الوصفات.
--
-- الكود الحالي بينادي الدالة دي قبل كل بيعة. من غير التعديل ده
-- الصنف المركّب هيرجّع صفر دايمًا (مالوش دفعات باسمه) والكاشير
-- هيشوف "الكمية أكبر من المخزون" على صنف متاح.
create or replace function public.available_quantity(
    p_item_id uuid,
    p_warehouse_id uuid
)
returns numeric
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
      recipe_available(p_item_id, p_warehouse_id),
      (
          select coalesce(sum(b.remaining_quantity), 0)
          from stock_batches b
          where b.item_id = p_item_id
            and b.warehouse_id = p_warehouse_id
            and b.remaining_quantity > 0
            and b.business_id = get_my_business_id()
      )
  );
$$;

revoke all on function public.available_quantity(uuid, uuid) from public, anon;
grant execute on function public.available_quantity(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
