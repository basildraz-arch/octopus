import {
  ensureDefaultWarehouse,
  bulkCreateCategories,
  bulkCreateItems,
  bulkCreateOpeningBatches,
  getExistingItemNames,
  getExistingCategoryMap,
  type ItemInsert,
} from "@/repositories/catalogImport.repository";
import { readXlsxRows, readCsvRows } from "@/lib/xlsx";
import { parseCatalog, type ParsedCatalog } from "@/lib/importCatalog";

export type ImportResult = {
  createdItems: number;
  createdCategories: number;
  skippedExisting: string[];
};

export async function parseCatalogFile(file: File): Promise<ParsedCatalog> {
  if (/\.csv$/i.test(file.name)) {
    return parseCatalog(readCsvRows(await file.text()));
  }

  return parseCatalog(await readXlsxRows(await file.arrayBuffer()));
}

export async function importCatalog(
  businessId: string,
  parsed: ParsedCatalog
): Promise<ImportResult> {
  // Never overwrite what the shop already has: an import adds, it
  // does not reconcile. An owner re-uploading a corrected sheet
  // expects the new lines added, not their edited prices silently
  // reverted.
  const [existingNames, existingCategories] = await Promise.all([
    getExistingItemNames(businessId),
    getExistingCategoryMap(businessId),
  ]);

  const skippedExisting: string[] = [];

  const newItems = parsed.items.filter((item) => {
    if (existingNames.has(item.name.trim().toLowerCase())) {
      skippedExisting.push(item.name);
      return false;
    }

    return true;
  });

  const missingCategories = parsed.categories.filter(
    (name) => !existingCategories[name.trim().toLowerCase()]
  );

  const createdCategoryMap = await bulkCreateCategories(
    businessId,
    missingCategories
  );

  const categoryIdByName: Record<string, string> = { ...existingCategories };

  for (const [name, id] of Object.entries(createdCategoryMap)) {
    categoryIdByName[name.trim().toLowerCase()] = id;
  }

  const rows: ItemInsert[] = newItems.map((item) => ({
    business_id: businessId,
    category_id: item.category
      ? categoryIdByName[item.category.trim().toLowerCase()] ?? null
      : null,
    name: item.name,
    barcode: item.code,
    item_type: "product",
    sale_method: "piece",
    unit: item.unit,
    buy_price: item.buyPrice,
    sell_price: item.price1,
    sell_price_2: item.price2,
    sell_price_3: item.price3,
    stock: item.stock,
    minimum_stock: 0,
    has_stock: true,
    active: true,
    keywords: [],
  }));

  const created = await bulkCreateItems(rows);

  if (created.some((r) => r.stock > 0)) {
    const warehouse = await ensureDefaultWarehouse(businessId);

    await bulkCreateOpeningBatches(businessId, warehouse.id, created);
  }

  return {
    createdItems: created.length,
    createdCategories: missingCategories.length,
    skippedExisting,
  };
}
