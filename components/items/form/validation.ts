import { z } from "zod";

export const itemSchema = z.object({
  name: z.string().min(2, "اسم الصنف مطلوب"),

  barcode: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),

  category_id: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),

  item_type: z.enum(["product", "service"]),

  sale_method: z.enum(["piece", "weight", "money"]),

  unit: z.string().min(1, "الوحدة مطلوبة"),

  buy_price: z.coerce.number().min(0, "سعر الشراء غير صحيح"),

  // المكوّن مالوش سعر بيع لأنه مابيتباعش. الحد الأدنى بيتحقق تحت
  // في `superRefine` بدل ما يكون على الحقل نفسه.
  sell_price: z.coerce.number().min(0, "سعر البيع غير صحيح"),

  stock: z.coerce.number().min(0),

  minimum_stock: z.coerce.number().min(0),

  // مكوّن: بيختفي من شاشة الكاشير (ميجريشن ٠٩١).
  //
  // **من غير `.default(false)` عن قصد.** `.default()` في zod بتخلّي
  // نوع الدخل `boolean | undefined` ونوع الخرج `boolean`، و
  // `useForm<ItemSchema>` بيستعمل نوع الخرج بينما الـresolver بيتوقّع
  // الدخل - فالاتنين مايتطابقوش والـbuild بيقع:
  //
  //     Type 'boolean | undefined' is not assignable to type 'boolean'
  //
  // القيمة الافتراضية موجودة في `defaultValues` بتاعة النموذج
  // (الفرعين، الجديد والتعديل)، فمفيش حاجة ناقصة.
  is_ingredient: z.boolean(),
}).superRefine((value, ctx) => {
  // الصنف اللي بيتباع لازم يكون له سعر. المكوّن (بن، سكر، كوب)
  // مابيتباعش فالسعر مالوش معنى - وإجباره كان هيخلّي صاحب المحل
  // يكتب رقم عشوائي عشان يعدّي الشاشة، والرقم ده هيبان في تقرير
  // يومًا ما.
  if (!value.is_ingredient && value.sell_price < 0.01) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sell_price"],
      message: "سعر البيع يجب أن يكون أكبر من صفر",
    });
  }
});

export type ItemSchema = z.infer<typeof itemSchema>;
