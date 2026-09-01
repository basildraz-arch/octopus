import { supabase } from "@/lib/supabase";

import type { ItemComponent, ItemComponentRow } from "@/types/itemComponent";

// وصفات الأصناف المركّبة.
//
// الكتابة محروسة في القاعدة بتريجر `validate_item_component` (ميجريشن
// 077): بيرفض المكوّن اللي من محل تاني، والمكوّن اللي مالوش مخزون،
// والوصفة جوه الوصفة. الملف ده **مابيكررش** التحققات دي - بيسيب
// الخطأ يطلع بنصه العربي للمستخدم.
//
// ليه: التحقق المكرر في المتصفح بيفترق عن اللي في القاعدة مع الوقت،
// وساعتها الواجهة بتقول حاجة والقاعدة بتعمل حاجة تانية. نفس درس §6.

export async function getComponents(
  parentItemId: string
): Promise<ItemComponentRow[]> {
  const { data, error } = await supabase
    .from("item_components")
    .select(
      "id, business_id, parent_item_id, component_item_id, quantity, component:items!item_components_component_item_id_fkey ( id, name, unit )"
    )
    .eq("parent_item_id", parentItemId);

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as ItemComponentRow[];
}

// أي أصناف ليها وصفة، في مرة واحدة.
//
// الشاشة اللي بتعرض قايمة أصناف محتاجة تعرف مين فيهم مركّب عشان
// توري علامة - من غير استعلام لكل صنف.
export async function getRecipeParentIds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("item_components")
    .select("parent_item_id");

  if (error) {
    console.error("Supabase Error:", error.message);
    return new Set();
  }

  return new Set((data ?? []).map((row) => row.parent_item_id as string));
}

export async function addComponent(
  businessId: string,
  parentItemId: string,
  componentItemId: string,
  quantity: number
): Promise<void> {
  const { error } = await supabase.from("item_components").insert({
    business_id: businessId,
    parent_item_id: parentItemId,
    component_item_id: componentItemId,
    quantity,
  });

  // بنرمي رسالة القاعدة زي ما هي - هي بالعربي ومكتوبة للمستخدم
  // ("مينفعش مكوّن يكون هو نفسه صنف مركّب").
  if (error) throw new Error(error.message);
}

export async function updateComponentQuantity(
  id: string,
  quantity: number
): Promise<void> {
  const { error } = await supabase
    .from("item_components")
    .update({ quantity, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function removeComponent(id: string): Promise<void> {
  const { error } = await supabase
    .from("item_components")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export type { ItemComponent, ItemComponentRow };
