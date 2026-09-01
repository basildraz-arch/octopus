-- ٠٨٨ — آخر باب كان لسه مفتوح على سعر الشرا
--
-- ============================================================
-- الثغرة (اتثبتت بحساب كاشير حقيقي، ١ سبتمبر ٢٠٢٦)
-- ============================================================
--
-- ميجريشنز ٠٦٩ و٠٧٠ و٠٧١ كلها اتعملت عشان حاجة واحدة: **الكاشير
-- مايشوفش سعر الشرا**. العمود اتمنع على مستوى الأعمدة، والـview
-- اتقفلت، و`sell_line` بقت بتحسب التكلفة جوه القاعدة.
--
-- و`draw_stock_fifo` فضلت مفتوحة على `authenticated` طول الوقت ده،
-- وهي بترجّع **سعر شرا كل دفعة** في ردها:
--
--     'buyPrice', b.buy_price
--
-- `AGENTS.md` كان مكتوب فيه إن ٠٧١ "قفلت آخر منفذ". اللي حصل فعلًا
-- إن **الكود** بطّل ينادي الدالة في مسار البيع - بس **الدالة نفسها**
-- مااتمنعتش. وde فرق كبير: أي حد يفتح أدوات المطوّر يقدر ينادي
-- الـRPC مباشرةً، الواجهة مالهاش دعوة.
--
-- الإثبات، بحساب كاشير حقيقي على بيانات حقيقية:
--
--     select draw_stock_fifo('<صنف>', 1, '<مخزن>')
--     → [{"batchId": "...", "buyPrice": 20.00, "quantity": 1}]
--     → والمخزون نزل 5450 ← 5449
--
-- **مشكلتين مش واحدة:**
--
-- ١. سعر الشرا اتسرّب - نفس الرقم اللي تلات ميجريشنز اتعملوا عشانه.
-- ٢. المخزون اتخصم **من غير أي فاتورة**. مفيش سطر بيع، مفيش تكلفة
--    مسجّلة، مفيش أثر. كاشير يقدر يمشّي بضاعة والجرد يطلع ناقص
--    ومحدش يعرف ليه.
--
-- ============================================================
-- الإصلاح: شيل `sell` من الشرط
-- ============================================================
--
-- الدالة لسه مستعملة فعلًا في مسارين شرعيين:
--
--     stockTransfer.repository.ts  → نقل بين المخازن  (transfer_stock)
--     item.repository.ts:167       → تظبيط رصيد صنف   (manage_items)
--
-- ومسار البيع **مابيناديهاش خالص** - `sell_line` جواها حلقة FIFO
-- بتاعتها. فصلاحية `sell` هنا بقت بلا وظيفة، وهي الصلاحية الوحيدة
-- اللي كل كاشير معاه.
--
-- وبنضيف `manage_items` و`receive_stock`: `adjustItemStock` بتنادي
-- الدالة دي، وشاشة الأصناف بتتفتح بـ`manage_items` - يعني اللي معاه
-- تعديل أصناف من غير `transfer_stock` كان بيترفض. الشرط القديم
-- ماكانش بس واسع، كان **ضيّق في المكان الغلط كمان**.
--
-- ============================================================
-- اللي لسه مفتوح عن قصد
-- ============================================================
--
-- الدالة لسه بترجّع `buyPrice` للمتصفح. ده مقبول للأدوار اللي
-- بتناديها دلوقتي: `stock_batches_read` بتدّي القراءة أصلًا لـ
-- `receive_stock` و`manage_items` و`view_reports`، فهم شايفينه
-- بأي حال.
--
-- **الاستثناء:** حد معاه `transfer_stock` **لوحدها** من غير
-- `receive_stock`. مفيش دور جاهز بالشكل ده (`stock_keeper` معاه
-- الاتنين)، بس صاحب محل يقدر يعمله يدوي. الحل الكامل إن النقل
-- كله يبقى دالة واحدة زي ما `record_sale` عملت للبيع، والتكلفة
-- ماتخرجش للمتصفح أصلًا. **مأجّل، ومتسجّل هنا عشان مايتنسيش.**
--
-- ============================================================
-- الاختبار بعد التطبيق
-- ============================================================
--
--   كاشير ينادي draw_stock_fifo  → "مش مسموح تسحب من المخزون"  ✅
--   البيع بعد ٠٧٦ و٠٨٨           → اتسجّل، التكلفة اتكتبت ٤٠،
--                                   المخزون 5450 ← 5448        ✅

create or replace function public.draw_stock_fifo(
    p_item_id      uuid,
    p_quantity     numeric,
    p_warehouse_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_business uuid := get_my_business_id();
    v_remaining numeric := p_quantity;
    v_available numeric;
    v_take numeric;
    v_draws jsonb := '[]'::jsonb;
    v_stock numeric := 0;
    v_cost numeric := 0;
    b record;
begin
    if v_business is null then
        raise exception 'غير مصرّح';
    end if;

    if p_quantity is null or p_quantity <= 0 then
        raise exception 'الكمية لازم تكون أكبر من صفر';
    end if;

    -- **`sell` اتشالت من هنا (ميجريشن ٠٨٨).** البيع بيمر على
    -- `record_sale` → `sell_line`، واللي جواها حلقة FIFO خاصة بيها.
    -- سيبها هنا كان معناه إن كل كاشير يقدر يقرا التكاليف ويخصم
    -- مخزون من غير فاتورة.
    if not (
        has_permission('transfer_stock')
        or has_permission('manage_items')
        or has_permission('receive_stock')
    ) then
        raise exception 'مش مسموح تسحب من المخزون';
    end if;

    if not exists (
        select 1 from items where id = p_item_id and business_id = v_business
    ) then
        raise exception 'الصنف مش من نشاطك';
    end if;

    if not exists (
        select 1 from warehouses where id = p_warehouse_id and business_id = v_business
    ) then
        raise exception 'المخزن مش من نشاطك';
    end if;

    select coalesce(sum(remaining_quantity), 0) into v_available
    from stock_batches
    where item_id = p_item_id
      and warehouse_id = p_warehouse_id
      and business_id = v_business
      and remaining_quantity > 0;

    if v_available < p_quantity then
        raise exception 'الكمية المطلوبة أكبر من المخزون المتاح فعليًا';
    end if;

    for b in
        select id, remaining_quantity, buy_price
        from stock_batches
        where item_id = p_item_id
          and warehouse_id = p_warehouse_id
          and business_id = v_business
          and remaining_quantity > 0
        order by created_at
        for update
    loop
        exit when v_remaining <= 0;

        v_take := least(b.remaining_quantity, v_remaining);

        update stock_batches
        set remaining_quantity = remaining_quantity - v_take
        where id = b.id;

        v_draws := v_draws || jsonb_build_object(
            'batchId', b.id,
            'quantity', v_take,
            'buyPrice', b.buy_price
        );

        v_remaining := v_remaining - v_take;
    end loop;

    select coalesce(sum(remaining_quantity), 0),
           coalesce(sum(remaining_quantity * buy_price), 0)
    into v_stock, v_cost
    from stock_batches
    where item_id = p_item_id
      and business_id = v_business
      and remaining_quantity > 0;

    update items
    set stock = v_stock,
        buy_price = case when v_stock > 0 then v_cost / v_stock else buy_price end
    where id = p_item_id
      and business_id = v_business;

    return v_draws;
end;
$$;

revoke all on function public.draw_stock_fifo(uuid, numeric, uuid) from public, anon;
grant execute on function public.draw_stock_fifo(uuid, numeric, uuid) to authenticated;

notify pgrst, 'reload schema';
