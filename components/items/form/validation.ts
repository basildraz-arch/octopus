import { z } from "zod";

export const itemSchema = z.object({
  name: z.string().min(2, "اسم الصنف مطلوب"),

  barcode: z.string().optional(),

  buy_price: z.coerce.number().min(0, "سعر الشراء غير صحيح"),

  sell_price: z.coerce.number().min(0.01, "سعر البيع يجب أن يكون أكبر من صفر"),

  stock: z.coerce.number().min(0),

  minimum_stock: z.coerce.number().min(0),

  item_type: z.enum(["product", "service"]),

  has_stock: z.boolean(),

  active: z.boolean(),
});

export type ItemSchema = z.infer<typeof itemSchema>;