-- ٠٨٥ — إلغاء فاتورة اتسجّلت غلط
--
-- ============================================================
-- الطلب
-- ============================================================
--
-- كيرو (قاف، أسوان) سجّل فواتير غلط وماكانش فيه أي طريقة يلغيها.
-- البرنامج كان بيسجّل ومابيرجّعش.
--
-- ============================================================
-- ليه مسح مش "علامة ملغية"
-- ============================================================
--
-- العرف في أنظمة الكاشير إن الفاتورة الملغية تفضل بعلامة. بس ده هنا
-- كان معناه عمود `voided_at` في `sales` و**مراجعة كل استعلام في
-- البرنامج** بيجمع مبيعات: التقارير، `profit_by_item`،
-- `getShiftSummary`، تقارير الموظفين، جرد الدرج. ولو مكان واحد
-- اتنسي، الفاتورة الملغية تفضل بتتحسب في رقم واحد ومش في التاني —
-- وde أسوأ من إنها تتمسح، لأنه غلط **مخفي**.
--
-- فالسطور بتتمسح، و**صورة كاملة منها بتتكتب في `sale_voids`** —
-- جدول append-only زي `cart_audit_log`. السجل مابيضيعش، والتقارير
-- بتفضل صح من غير ما نلمس ولا استعلام.
--
-- ============================================================
-- رجوع البضاعة: الصراحة في الحدود
-- ============================================================
--
-- السحب FIFO **مابيسجّلش من أنهي دفعة سحب**. فالإرجاع الحرفي
-- (نفس الدفعات بنفس التكاليف) مستحيل بالسكيما الحالية.
--
-- اللي بيحصل بدله: **دفعة جديدة بالتكلفة المسجّلة في
-- `sale_items.cost`**. القيمة اللي خرجت هي القيمة اللي بترجع
-- بالمليم — الغلط الوحيد المحتمل هو **ترتيب** الدفعات في الطابور،
-- مش قيمتها.
--
-- و`created_at` بتاع الدفعة الراجعة = **وقت الفاتورة الأصلية** مش
-- `now()`. كده بترجع مكانها التقريبي في طابور FIFO بدل ما تروح
-- لآخره وتتباع بعد بضاعة اتشحنت بعدها.
--
-- **المخزن:** `sale_items` مابتسجّلش المخزن اللي البضاعة خرجت منه
-- (`sell_line` بتاخده وماتخزّنوش). فبيترجع للمخزن اللي بيتبعت في
-- `p_warehouse_id`، وde بيبقى الافتراضي لو مااتبعتش. للمحل بمخزن
-- واحد ده مضبوط تمامًا؛ لأكتر من مخزن، الشاشة لازم تسأل.
--
-- ============================================================
-- مين يقدر يلغي
-- ============================================================
--
-- صلاحية `refund_sale` — كانت موجودة في `types/permission.ts` من
-- غير أي كود بينفّذها. **مش في أي دور موظف** (`staff_role_permissions`)
-- يعني صاحب النشاط بس افتراضيًا.
--
-- وde مقصود: الكاشير اللي يقدر يبيع ويلغي ويشيل الفلوس مافيش حاجة
-- بتمسكه. صاحب المحل يقدر يدّيها لموظف معيّن بـ`extra_permissions`
-- لو عايز.
--
-- **واليوم المقفول مايتلمسش.** لو اليوم اتقفل والجرد اتعمل، إلغاء
-- فاتورة بأثر رجعي بيغيّر رقم اتوقّع عليه. صاحب المحل يفتح اليوم
-- الأول (وde متسجّل) وبعدين يلغي.
--
-- ============================================================
-- الاختبار
-- ============================================================
--
-- بحساب مالك حقيقي، الكل جوه transaction اترجعت:
--
--   مخزون قبل=5450  بعد البيع=5447  بعد الإلغاء=5450   ✅
--   قيمة المخزون قبل=110000  بعدها=110000 (٤ خانات)    ✅
--   صف في sale_voids=1، الفاتورة اتمسحت=t               ✅
--
-- والرفض:
--   كاشير بيحاول يلغي   → "إلغاء الفواتير لصاحب النشاط بس"  ✅
--   إلغاء من يوم مقفول  → "اليوم ده اتقفل — افتحه الأول"     ✅

-- ------------------------------------------------------------
-- سجل الإلغاءات — append-only
-- ------------------------------------------------------------

create table if not exists public.sale_voids (
    id            uuid primary key default gen_random_uuid(),
    business_id   uuid not null references businesses(id) on delete cascade,
    sale_id       uuid not null,
    voided_by     uuid references users(id) on delete set null,
    voided_at     timestamptz not null default now(),
    reason        text,

    -- صورة الفاتورة وقت الإلغاء. jsonb عشان تفضل مقروءة حتى لو
    -- الأصناف نفسها اتمسحت بعدين.
    sale_total    numeric(14,2) not null,
    sale_created_at timestamptz not null,
    lines         jsonb not null
);

create index if not exists sale_voids_business_time
    on public.sale_voids (business_id, voided_at desc);

alter table public.sale_voids enable row level security;

-- قراءة: اللي معاه تقارير أو صاحب النشاط. الكاشير مايشوفش إلغاءات
-- زمايله.
drop policy if exists sale_voids_read on public.sale_voids;
create policy sale_voids_read on public.sale_voids
    for select using (
        business_id = get_my_business_id()
        and (is_business_owner() or has_read_permission('view_reports'))
    );

-- مفيش INSERT ولا UPDATE ولا DELETE policies **عن قصد**: الكتابة
-- بتتم من `void_sale` بس (SECURITY DEFINER). زي `cart_audit_log`.

-- ------------------------------------------------------------
-- الدالة
-- ------------------------------------------------------------

create or replace function public.void_sale(
    p_sale_id      uuid,
    p_reason       text default null,
    p_warehouse_id uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_business  uuid := get_my_business_id();
    v_sale      record;
    v_wh        uuid;
    v_lines     jsonb;
    v_unit_cost numeric;
    v_comp_total numeric;
    li record;
    c  record;
begin
    if v_business is null then
        raise exception 'غير مصرّح';
    end if;

    if not business_is_active(v_business) then
        raise exception 'الاشتراك مقفول';
    end if;

    if not has_permission('refund_sale') then
        raise exception 'إلغاء الفواتير لصاحب النشاط بس';
    end if;

    select s.*, sh.closed_at into v_sale
    from sales s
    left join shifts sh on sh.id = s.shift_id
    where s.id = p_sale_id and s.business_id = v_business;

    if not found then
        raise exception 'الفاتورة مش موجودة';
    end if;

    if v_sale.closed_at is not null then
        raise exception 'اليوم ده اتقفل — افتحه الأول عشان تلغي فاتورة منه';
    end if;

    -- المخزن اللي البضاعة هترجع له
    v_wh := p_warehouse_id;

    if v_wh is null then
        select id into v_wh from warehouses
        where business_id = v_business
        order by is_default desc, created_at
        limit 1;
    end if;

    if v_wh is null or not exists (
        select 1 from warehouses where id = v_wh and business_id = v_business
    ) then
        raise exception 'المخزن مش من نشاطك';
    end if;

    -- الصورة قبل المسح
    select jsonb_agg(jsonb_build_object(
               'item_id', si.item_id,
               'name', coalesce(i.name, 'صنف متمسوح'),
               'quantity', si.quantity,
               'unit_price', si.unit_price,
               'total', si.total,
               'cost', si.cost
           ) order by si.created_at)
    into v_lines
    from sale_items si
    left join items i on i.id = si.item_id
    where si.sale_id = p_sale_id;

    insert into sale_voids (
        business_id, sale_id, voided_by, reason,
        sale_total, sale_created_at, lines
    ) values (
        v_business, p_sale_id, my_user_id(), nullif(btrim(coalesce(p_reason, '')), ''),
        v_sale.total, v_sale.created_at, coalesce(v_lines, '[]'::jsonb)
    );

    -- رجوع البضاعة، سطر سطر
    for li in
        select si.item_id, si.quantity, si.cost
        from sale_items si
        where si.sale_id = p_sale_id
    loop
        -- `cost is null` معناها صنف خدمة (مالوش مخزون) — مفيش حاجة
        -- ترجع.
        continue when li.cost is null;

        if exists (
            select 1 from item_components
            where parent_item_id = li.item_id and business_id = v_business
        ) then
            -- صنف بوصفة: المكوّنات هي اللي خرجت، فهي اللي ترجع.
            --
            -- التكلفة المسجّلة إجمالي للسطر كله. بنوزّعها على
            -- المكوّنات **بنسبة قيمتها الحالية** عشان مجموع اللي
            -- رجع يساوي اللي خرج بالظبط - لو وزّعناها بالكمية،
            -- كيلو بن وكيلو سكر هياخدوا نفس التكلفة وde غلط.
            select sum(ic.quantity * coalesce(ci.buy_price, 0))
            into v_comp_total
            from item_components ic
            join items ci on ci.id = ic.component_item_id
            where ic.parent_item_id = li.item_id
              and ic.business_id = v_business;

            for c in
                select ic.component_item_id, ic.quantity,
                       coalesce(ci.buy_price, 0) as unit_cost
                from item_components ic
                join items ci on ci.id = ic.component_item_id
                where ic.parent_item_id = li.item_id
                  and ic.business_id = v_business
            loop
                insert into stock_batches (
                    business_id, item_id, warehouse_id, purchase_id,
                    quantity, remaining_quantity, buy_price, created_at
                ) values (
                    v_business, c.component_item_id, v_wh, null,
                    li.quantity * c.quantity,
                    li.quantity * c.quantity,
                    case
                        when v_comp_total > 0
                        then (li.cost * (c.quantity * c.unit_cost) / v_comp_total)
                             / nullif(c.quantity, 0)
                        else 0
                    end,
                    v_sale.created_at
                );

                update items set updated_at = now()
                where id = c.component_item_id and business_id = v_business;
            end loop;

        else
            -- صنف عادي له مخزون
            if not exists (
                select 1 from items
                where id = li.item_id and business_id = v_business and has_stock
            ) then
                continue;
            end if;

            v_unit_cost := case
                when li.quantity > 0 then li.cost / li.quantity
                else 0
            end;

            insert into stock_batches (
                business_id, item_id, warehouse_id, purchase_id,
                quantity, remaining_quantity, buy_price, created_at
            ) values (
                v_business, li.item_id, v_wh, null,
                li.quantity, li.quantity, v_unit_cost, v_sale.created_at
            );

            -- التريجر بتاع ٠٧٢ بيعيد اشتقاق stock و buy_price من
            -- الدفعات. بنلمس updated_at بس.
            update items set updated_at = now()
            where id = li.item_id and business_id = v_business;
        end if;
    end loop;

    delete from sale_items where sale_id = p_sale_id;
    delete from sales where id = p_sale_id and business_id = v_business;
end;
$$;

revoke all on function public.void_sale(uuid, text, uuid) from public, anon;
grant execute on function public.void_sale(uuid, text, uuid) to authenticated;

notify pgrst, 'reload schema';
