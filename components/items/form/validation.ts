import { z } from "zod";

export const itemSchema = z.object({
  name: z.string().min(2, "اسم الصنف مطلوب"),

  barcode: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),

  item_type: z.enum(["product", "service"]),

  sale_method: z.enum(["piece", "weight", "money"]),

  unit: z.string().min(1, "الوحدة مطلوبة"),

  buy_price: z.coerce.number().min(0, "سعر الشراء غير صحيح"),

  sell_price: z.coerce.number().min(0.01, "سعر البيع يجب أن يكون أكبر من صفر"),

  stock: z.coerce.number().min(0),

  minimum_stock: z.coerce.number().min(0),
});

export type ItemSchema = z.infer<typeof itemSchema>;
