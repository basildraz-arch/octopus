-- ٠٩٠ — المرتجع الجزئي
--
-- ============================================================
-- الفرق بينه وبين الإلغاء
-- ============================================================
--
-- `void_sale` (٠٨٥) بتلغي الفاتورة كلها - وde للفاتورة اللي
-- **اتسجّلت غلط**.
--
-- المرتجع حاجة تانية خالص: البيعة كانت صح، والزبون رجّع حاجة منها.
-- اشترى تلاتة ورجّع واحد. الفاتورة تفضل موجودة، ناقصة السطر ده.
--
-- ============================================================
-- القرار: تعديل الفاتورة مش إشعار دائن
-- ============================================================
--
-- العرف المحاسبي إن المرتجع يتسجّل كمستند منفصل (إشعار دائن)
-- والفاتورة الأصلية ماتتلمسش.
--
-- اخترنا التعديل في المكان لنفس سبب ٠٨٥ بالظبط: مستند منفصل معناه
-- إن **كل استعلام بيجمع مبيعات لازم يطرح المرتجعات**. التقارير،
-- `profit_by_item`، `getShiftSummary`، تقارير الموظفين، جرد الدرج.
-- والمكان اللي هينسى هيدي رقم مختلف عن غيره - وde غلط **مخفي**،
-- أسوأ من إن الرقم يتعدّل.
--
-- والسجل مابيضيعش: `sale_returns` بتحتفظ بكل مرتجع كامل.
--
-- ============================================================
-- الخصم بيتقلّص بالنسبة
-- ============================================================
--
-- فاتورة ٢١٠ ج بخصم ٥ (٢.٤٪). الزبون رجّع بـ٤٥ ج.
--
--   لو سبنا الخصم ٥: الباقي ١٦٥ بخصم ٥ = ٣٪. المحل بيرجّع أكتر
--   مما أخد.
--
--   لو شلنا الخصم: الزبون بيدفع السعر الكامل على اللي احتفظ بيه
--   بعد ما اداله المحل خصم.
--
-- الصح إن الخصم يتقلّص بنفس النسبة: ٥ × (١٦٥/٢١٠) = ٣.٩٣، فتفضل
-- ٢.٤٪ على اللي فاضل. (ده الرقم اللي طلع في الاختبار فعلًا.)
--
-- ============================================================
-- الحدود
-- ============================================================
--
-- - **مايرجّعش أكتر من اللي اتباع.** الكمية بتتقارن باللي في السطر
--   دلوقتي (اللي هي الأصلية ناقص أي مرتجع سابق).
-- - **اليوم المقفول مايتلمسش** - زي ٠٨٥ بالظبط.
-- - **لو رجّع كل حاجة**، الفاتورة بتتمسح والحركة بتتسجّل في
--   `sale_voids` كمان - عشان النتيجة النهائية تبقى واحدة سواء
--   عمل إلغاء أو رجّع الكل.
--
-- ============================================================
-- الاختبار
-- ============================================================
--
--   فاتورة ٤×صنف + ٢×صنف = ٢١٠، خصم ٥، إجمالي ٢٠٥
--   إرجاع ٩٩ من صنف اتباع منه ٤  → "مش ينفع ترجّع 99 ... المتبقي 4"  ✅
--   كاشير يحاول يعمل مرتجع        → "المرتجعات لصاحب النشاط بس"      ✅
--   إرجاع ١ من الصنف الأول        → المرتجع ٤٥.٠٠                    ✅
--   الإجمالي ٢٠٥ ← ١٦١.٠٧، الخصم ٥ ← ٣.٩٣                            ✅
--   المخزون ٥٤٥٠ ← ٥٤٤٦ (بيع ٤) ← ٥٤٤٧ (رجع ١)                       ✅

create table if not exists public.sale_returns (
    id            uuid primary key default gen_random_uuid(),
    business_id   uuid not null references businesses(id) on delete cascade,
    sale_id       uuid not null,
    returned_by   uuid references users(id) on delete set null,
    returned_at   timestamptz not null default now(),
    reason        text,

    -- قيمة اللي رجع، وصورة السطور. jsonb عشان تفضل مقروءة حتى لو
    -- الأصناف اتمسحت بعدين.
    refund_amount numeric(14,2) not null,
    lines         jsonb not null
);

create index if not exists sale_returns_business_time
    on public.sale_returns (business_id, returned_at desc);

alter table public.sale_returns enable row level security;

drop policy if exists sale_returns_read on public.sale_returns;
create policy sale_returns_read on public.sale_returns
    for select using (
        business_id = get_my_business_id()
        and (is_business_owner() or has_read_permission('view_reports'))
    );

-- مفيش INSERT/UPDATE/DELETE policies عن قصد: الكتابة من
-- `return_sale_lines` بس. زي `sale_voids` و`cart_audit_log`.

create or replace function public.return_sale_lines(
    p_sale_id      uuid,
    p_lines        jsonb,     -- [{item_id, quantity}]
    p_reason       text default null,
    p_warehouse_id uuid default null
) returns numeric              -- قيمة المرتجع
language plpgsql
security definer
set search_path = public
as $$
declare
    v_business  uuid := get_my_business_id();
    v_sale      record;
    v_wh        uuid;
    v_line      record;
    v_si        record;
    v_name      text;
    v_qty       numeric;
    v_share     numeric;
    v_cost_back numeric;
    v_refund    numeric := 0;
    v_snapshot  jsonb := '[]'::jsonb;
    v_subtotal_before numeric;
    v_subtotal_after  numeric;
    v_new_discount    numeric;
    v_left      int;
begin
    if v_business is null then
        raise exception 'غير مصرّح';
    end if;

    if not business_is_active(v_business) then
        raise exception 'الاشتراك مقفول';
    end if;

    if not has_permission('refund_sale') then
        raise exception 'المرتجعات لصاحب النشاط بس';
    end if;

    if p_lines is null or jsonb_array_length(p_lines) = 0 then
        raise exception 'مفيش أصناف مختارة للمرتجع';
    end if;

    select s.*, sh.closed_at into v_sale
    from sales s
    left join shifts sh on sh.id = s.shift_id
    where s.id = p_sale_id and s.business_id = v_business;

    if not found then
        raise exception 'الفاتورة مش موجودة';
    end if;

    if v_sale.closed_at is not null then
        raise exception 'اليوم ده اتقفل — افتحه الأول عشان تعمل مرتجع منه';
    end if;

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

    select coalesce(sum(total), 0) into v_subtotal_before
    from sale_items where sale_id = p_sale_id;

    for v_line in
        select (e->>'item_id')::uuid as item_id,
               (e->>'quantity')::numeric as quantity
        from jsonb_array_elements(p_lines) e
    loop
        if v_line.quantity is null or v_line.quantity <= 0 then
            raise exception 'الكمية لازم تكون أكبر من صفر';
        end if;

        -- القفل على `sale_items` لوحدها: `for update` مايتجمعش مع
        -- `left join` (الصنف ممكن يكون اتمسح والفاتورة لسه موجودة).
        -- Postgres بيرفض صراحةً:
        --   "FOR UPDATE cannot be applied to the nullable side of
        --    an outer join"
        select * into v_si
        from sale_items
        where sale_id = p_sale_id and item_id = v_line.item_id
        for update;

        if not found then
            raise exception 'الصنف ده مش في الفاتورة';
        end if;

        select name into v_name from items where id = v_si.item_id;

        if v_line.quantity > v_si.quantity then
            raise exception 'مش ينفع ترجّع % من % — المتبقي في الفاتورة %',
                v_line.quantity, coalesce(v_name, 'الصنف'), v_si.quantity;
        end if;

        v_qty       := v_line.quantity;
        v_share     := v_qty / v_si.quantity;
        v_cost_back := case when v_si.cost is null then null
                            else round(v_si.cost * v_share, 4) end;

        v_refund := v_refund + round(v_si.total * v_share, 2);

        v_snapshot := v_snapshot || jsonb_build_object(
            'item_id', v_si.item_id,
            'name', coalesce(v_name, 'صنف متمسوح'),
            'quantity', v_qty,
            'unit_price', v_si.unit_price,
            'refund', round(v_si.total * v_share, 2),
            'cost', v_cost_back
        );

        perform return_line_to_stock(
            v_business, v_si.item_id, v_qty, v_cost_back, v_wh, v_sale.created_at
        );

        if v_qty = v_si.quantity then
            delete from sale_items where id = v_si.id;
        else
            update sale_items
            set quantity = quantity - v_qty,
                total    = round(total - (v_si.total * v_share), 2),
                cost     = case when cost is null then null
                                else round(cost - v_cost_back, 4) end
            where id = v_si.id;
        end if;
    end loop;

    insert into sale_returns (
        business_id, sale_id, returned_by, reason, refund_amount, lines
    ) values (
        v_business, p_sale_id, my_user_id(),
        nullif(btrim(coalesce(p_reason, '')), ''),
        v_refund, v_snapshot
    );

    select count(*) into v_left from sale_items where sale_id = p_sale_id;

    if v_left = 0 then
        insert into sale_voids (
            business_id, sale_id, voided_by, reason,
            sale_total, sale_created_at, lines
        ) values (
            v_business, p_sale_id, my_user_id(), 'اترجّعت كلها',
            v_sale.total, v_sale.created_at, v_snapshot
        );

        delete from sales where id = p_sale_id and business_id = v_business;

        return v_refund;
    end if;

    select coalesce(sum(total), 0) into v_subtotal_after
    from sale_items where sale_id = p_sale_id;

    v_new_discount := case
        when v_subtotal_before > 0
        then round(v_sale.discount_amount * (v_subtotal_after / v_subtotal_before), 2)
        else 0
    end;

    update sales
    set discount_amount = v_new_discount,
        total = greatest(0, round(v_subtotal_after - v_new_discount, 2))
    where id = p_sale_id and business_id = v_business;

    return v_refund;
end;
$$;

revoke all on function public.return_sale_lines(uuid, jsonb, text, uuid)
  from public, anon;
grant execute on function public.return_sale_lines(uuid, jsonb, text, uuid)
  to authenticated;

notify pgrst, 'reload schema';
