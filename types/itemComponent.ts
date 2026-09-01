// سطر في وصفة صنف مركّب: "الكوباية فيها ١٨ جرام بن".
//
// الأب هو اللي بيتباع، والمكوّن هو اللي بينقص. الأب مالوش مخزون خاص
// بيه - لو ليه وصفة، المكوّنات بس هي اللي ليها دفعات (ميجريشن 077).

export interface ItemComponent {
  id: string;

  business_id: string;

  // الصنف اللي بيتباع
  parent_item_id: string;

  // الصنف اللي بينقص
  component_item_id: string;

  // كام من المكوّن في الوحدة الواحدة من الأب.
  // ١٨ جرام بن في كوباية، والبن بالكيلو = 0.018
  quantity: number;

  created_at?: string;
  updated_at?: string;
}

// سطر الوصفة ومعاه بيانات المكوّن، عشان الشاشة تعرض اسمه ووحدته
// من غير ما تدوّر عليه.
export interface ItemComponentRow extends ItemComponent {
  component: {
    id: string;
    name: string;
    unit: string;
  } | null;
}
