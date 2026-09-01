import { supabase } from "@/lib/supabase";
import {
  createBatch,
  drawFromBatches,
  getCurrentStockAndCost,
} from "@/repositories/stockBatch.repository";
import { getDefaultWarehouse } from "@/repositories/warehouse.repository";
import { getItemCost } from "@/repositories/itemCost.repository";

import type {
  Item,
  ItemFormData,
} from "@/types/item";

// كل أعمدة items ما عدا buy_price.
//
// كانت select("*")، وde مبقاش ينفع: العمود ممنوع على مستوى قاعدة
// البيانات (ميجريشن 069) والنجمة بتطلبه فبيرفض الاستعلام كله - حتى
// لصاحب المحل. التكلفة بتيجي من itemCost.repository لوحدها.
//
// لو اتضاف عمود جديد لـitems، لازم يتضاف هنا كمان.
// لازم تفضل نص ثابت مكتوب كده، مش مصفوفة مع join. الفرق مش شكلي:
// Supabase بيقرا قايمة الأعمدة من النص نفسه وقت فحص الأنواع عشان
// يعرف شكل الصف الراجع. join بيطلّع string عادي، فالنوع الراجع بيبقى
// مجهول - وده اللي وقّع الـbuild أول مرة.
const ITEM_COLUMNS =
  "id, business_id, category_id, name, barcode, item_type, sale_method, unit, sell_price, sell_price_2, sell_price_3, min_sell_price, stock, minimum_stock, has_stock, image, keywords, is_ingredient, active, created_at, updated_at";

// ============================================================
// ليه فيه فلتر بالمحل رغم إن الـRLS موجودة
// ============================================================
//
// `items_read` بتقول `business_id = get_my_business_id()` - كفاية
// لأي مستخدم عادي. **بس فيه policy تانية:** `platform_admin_read`
// بتدّي أدمن المنصة قراءة **كل الأصناف في كل المحلات**.
//
// الـpolicy دي موجودة عشان شاشة الماستر، بس هي بتنطبق على **كل**
// استعلام - فشاشة الأصناف العادية كانت بتوري لباسل ١٩٣ صنف من
// ٨ محلات مخلوطين مع بعض.
//
// وde مش تسريب (هو الأدمن فعلًا) - ده **خلط**. وخطورته إنه بيخلّيه
// يفتح صنف من محل حد تاني ويحاول يعدّله، والتعديل بيترفض بصمت
// (شوف `updateItem` فوق).
//
// **الفلتر هنا مش أمان - هو ترتيب.** الأمان في الـRLS.
export async function getItems(businessId?: string): Promise<Item[]> {
  let query = supabase.from("items").select(ITEM_COLUMNS);

  if (businessId) query = query.eq("business_id", businessId);

  const { data, error } = await query.order("name", { ascending: true });

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return (data ?? []) as Item[];
}

export async function getItemById(
  id: string
): Promise<Item | null> {
  const { data, error } = await supabase
    .from("items")
    .select(ITEM_COLUMNS)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Supabase Error:", error.message);
    return null;
  }

  return data as Item;
}

export async function findItemByName(
  name: string
): Promise<Item | null> {
  const { data, error } = await supabase
    .from("items")
    .select(ITEM_COLUMNS)
    .ilike("name", name.trim())
    .maybeSingle();

  if (error) {
    console.error("Supabase Error:", error.message);
    return null;
  }

  return data as Item | null;
}

// أصناف شاشة الكاشير.
//
// **المكوّنات مستثناة هنا وهنا بس.** البن والسكر والكوب بيتضافوا
// كأصناف عشان الوصفة تخصم منهم، بس محدش بيبيعهم بالحبة على الكاونتر.
// من غير الاستثناء ده كانوا هيظهروا جنب القهوة وممكن يتباعوا بالغلط
// من دوسة واحدة (ميجريشن ٠٩١).
//
// `getItems` فوق **مابتستثنيهمش** عن قصد: شاشة الأصناف والمشتريات
// والمخزون كلهم محتاجين يشوفوهم.
export async function getActiveItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from("items")
    .select(ITEM_COLUMNS)
    .eq("active", true)
    .eq("is_ingredient", false)
    .order("name", { ascending: true });

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return (data ?? []) as Item[];
}

export async function createItem(
  item: ItemFormData
) {
  const { data, error } = await supabase
    .from("items")
    .insert(item)
    .select(ITEM_COLUMNS);

  if (error) throw error;

  const newItem = data?.[0];

  if (newItem && item.has_stock && item.stock > 0) {
    const warehouse = await getDefaultWarehouse(item.business_id);

    await createBatch(
      item.business_id,
      newItem.id,
      warehouse.id,
      null,
      item.stock,
      item.buy_price ?? 0
    );
  }

  return data;
}

// ============================================================
// ليه بنتأكد إن فيه صف اتغيّر فعلًا
// ============================================================
//
// `update()` من غير `select()` بترجّع **204 من غير أي خطأ** حتى لو
// **مطابقتش ولا صف**. وde بالظبط اللي بيحصل لما الـRLS تمنع الصف:
// مفيش رفض، مفيش رسالة - نجاح فاضي.
//
// حصل فعلًا (١ سبتمبر): باسل عدّل صنف اسمه "7up" وشاف رسالة نجاح،
// والصنف مااتغيّرش. السبب إن الصنف من **محل كيرو** مش من محله -
// و`items_update` بتقول `business_id = get_my_business_id()`، فصفر
// صفوف اتطابقت والرد رجع 204.
//
// شاف "اتحفظ" تلات مرات على حاجة ماتحفظتش ولا مرة.
//
// **القاعدة: أي `update` أو `delete` لازم يتأكد إن فيه صف اتمس.**
// النجاح الفاضي أسوأ من الخطأ - الخطأ بيتصلّح، والنجاح الفاضي
// بيتصدّق.
export async function updateItem(
  id: string,
  item: Partial<ItemFormData>
) {
  const { data, error } = await supabase
    .from("items")
    .update(item)
    .eq("id", id)
    .select("id");

  if (error) throw error;

  if (!data || data.length === 0) {
    throw new Error(
      "الصنف ده مش من محلك - مااتغيّرش. لو انت أدمن، افتحه من حساب المحل نفسه."
    );
  }
}

export async function adjustItemStock(
  businessId: string,
  item: Item,
  newStock: number
): Promise<void> {
  const { stock: actualStock } = await getCurrentStockAndCost(item.id);

  const diff = newStock - actualStock;

  if (diff === 0) return;

  const warehouse = await getDefaultWarehouse(businessId);

  if (diff > 0) {
    // تكلفة الدفعة الجديدة لازم تتجاب من الباب بتاعها.
    //
    // كان مكتوب item.buy_price ?? 0 - وde بقى **صفر دايمًا** بعد
    // ميجريشن 070، لأن getItems مابترجّعش العمود. يعني كل تصحيح جرد
    // بالزيادة كان بيضيف بضاعة بتكلفة صفر وينزّل متوسط التكلفة،
    // فتقرير الأرباح يطلع أعلى من الحقيقة. من غير أي رسالة خطأ.
    //
    // المتوسط الحالي هو أقرب تقدير عندنا - البضاعة الزيادة دي أصلًا
    // مالهاش فاتورة شرا، عشان كده هي "تصحيح جرد" مش "شرا".
    const knownCost =
      (await getItemCost(item.id)) ?? (await getCurrentStockAndCost(item.id)).averageCost;

    await createBatch(
      businessId,
      item.id,
      warehouse.id,
      null,
      diff,
      knownCost
    );
  } else {
    await drawFromBatches(item.id, Math.abs(diff), warehouse.id);
  }

  const { stock, averageCost } = await getCurrentStockAndCost(item.id);

  await updateItem(item.id, {
    stock,
    buy_price: averageCost,
  });
}

export async function deleteItem(id: string) {
  const { error } = await supabase
    .from("items")
    .delete()
    .eq("id", id);

  if (error) throw error;
}