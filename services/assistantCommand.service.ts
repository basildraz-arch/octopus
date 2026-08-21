import type { SupabaseClient } from "@supabase/supabase-js";

import { askGemini } from "@/lib/gemini";
import { normalize } from "@/lib/assistant/classify";
import { fuzzyIncludes } from "@/lib/assistant/fuzzyMatch";
import {
  COMMAND_SYSTEM_INSTRUCTION,
  parseCommandJson,
  type AssistantCommand,
} from "@/lib/assistant/commands";

// A proposal is a sentence the owner reads and a plan the server can
// carry out later without re-interpreting anything. Once this object
// exists, the model is out of the loop entirely - execution reads
// resolved ids and numbers, never the original text.
export type CommandProposal = {
  kind: AssistantCommand["kind"];
  summary: string;
  affectedCount: number;
  plan: CommandPlan;
};

export type CommandPlan =
  | { type: "update_item"; itemId: string; patch: Record<string, number> }
  | {
      type: "update_items";
      updates: { id: string; sell_price: number }[];
    }
  | {
      type: "insert_item";
      values: {
        name: string;
        sell_price: number;
        category_id: string | null;
        item_type: string;
        sale_method: string;
        has_stock: boolean;
      };
    }
  | { type: "insert_category"; values: { name: string } };

export type CommandOutcome =
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

const MAX_BULK_ITEMS = 500;

export async function detectCommand(
  question: string
): Promise<AssistantCommand | null> {
  try {
    const raw = await askGemini(question, COMMAND_SYSTEM_INSTRUCTION);

    return parseCommandJson(raw);
  } catch (err) {
    console.error("detectCommand failed:", err);

    // A parser that fell over must not turn into an action.
    return null;
  }
}

type ItemRow = {
  id: string;
  name: string;
  sell_price: number;
  sell_price_2: number | null;
  sell_price_3: number | null;
  category_id: string | null;
  stock: number;
  minimum_stock: number | null;
};

async function loadItems(
  supabase: SupabaseClient,
  businessId: string
): Promise<ItemRow[]> {
  const { data, error } = await supabase
    .from("items")
    .select(
      "id, name, sell_price, sell_price_2, sell_price_3, category_id, stock, minimum_stock"
    )
    .eq("business_id", businessId)
    .eq("active", true);

  if (error) throw error;

  return (data ?? []) as ItemRow[];
}

async function findCategoryId(
  supabase: SupabaseClient,
  businessId: string,
  query: string
): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .eq("business_id", businessId)
    .eq("active", true);

  if (error) throw error;

  const match = (data ?? []).find((category) =>
    fuzzyIncludes(normalize(category.name), normalize(query))
  );

  return match ?? null;
}

function matchItems(items: ItemRow[], query: string): ItemRow[] {
  const needle = normalize(query);

  const exact = items.filter((item) => normalize(item.name) === needle);

  if (exact.length > 0) return exact;

  return items.filter((item) => fuzzyIncludes(normalize(item.name), needle));
}

function money(value: number): string {
  return `${value.toFixed(2)} ج`;
}

// Turns a parsed command into something with real ids in it, or into
// an honest "I couldn't". Ambiguity is reported, never guessed at:
// two items matching "قهوة" means the owner gets asked which one.
export async function planCommand(
  supabase: SupabaseClient,
  businessId: string,
  command: AssistantCommand
): Promise<CommandProposal | { error: string }> {
  if (command.kind === "create_category") {
    const existing = await findCategoryId(supabase, businessId, command.name);

    if (existing) {
      return { error: `فيه فئة اسمها "${existing.name}" موجودة بالفعل.` };
    }

    return {
      kind: command.kind,
      summary: `هضيف فئة جديدة اسمها "${command.name}".`,
      affectedCount: 1,
      plan: { type: "insert_category", values: { name: command.name } },
    };
  }

  const items = await loadItems(supabase, businessId);

  if (command.kind === "create_item") {
    const clash = items.find(
      (item) => normalize(item.name) === normalize(command.name)
    );

    if (clash) {
      return { error: `فيه صنف اسمه "${clash.name}" موجود بالفعل.` };
    }

    let categoryId: string | null = null;
    let categoryName = "";

    if (command.categoryQuery) {
      const category = await findCategoryId(
        supabase,
        businessId,
        command.categoryQuery
      );

      if (!category) {
        return {
          error: `مش لاقي فئة اسمها "${command.categoryQuery}". اعمل الفئة الأول أو سيبها فاضية.`,
        };
      }

      categoryId = category.id;
      categoryName = category.name;
    }

    return {
      kind: command.kind,
      summary: `هضيف صنف "${command.name}" بسعر ${money(command.price)}${
        categoryName ? ` تحت فئة "${categoryName}"` : ""
      } - من غير متابعة مخزون، وتقدر تفعّلها من صفحة الصنف.`,
      affectedCount: 1,
      plan: {
        type: "insert_item",
        values: {
          name: command.name,
          sell_price: command.price,
          category_id: categoryId,
          // item_type and sale_method are NOT NULL with no default,
          // so they have to be decided here. A plain piece-priced
          // product is what "ضيف صنف اسمه كذا بكذا" means nine times
          // out of ten, and the item page can change it after.
          item_type: "product",
          sale_method: "piece",
          // Created untracked on purpose: an item with stock tracking
          // on and zero stock cannot be sold, so the shop would add
          // something through the assistant and then find the till
          // refusing it.
          has_stock: false,
        },
      },
    };
  }

  if (command.kind === "bulk_price_change") {
    let scope = items;
    let scopeName = "كل الأصناف";

    if (command.categoryQuery) {
      const category = await findCategoryId(
        supabase,
        businessId,
        command.categoryQuery
      );

      if (!category) {
        return { error: `مش لاقي فئة اسمها "${command.categoryQuery}".` };
      }

      scope = items.filter((item) => item.category_id === category.id);
      scopeName = `أصناف "${category.name}"`;
    }

    if (scope.length === 0) {
      return { error: "مفيش أصناف تحت الشرط ده." };
    }

    if (scope.length > MAX_BULK_ITEMS) {
      return {
        error: `العدد كبير جدًا (${scope.length} صنف). قسّمها على فئات.`,
      };
    }

    const sign = command.direction === "up" ? 1 : -1;

    const updates = scope.map((item) => {
      const delta =
        command.mode === "amount"
          ? command.value
          : (item.sell_price * command.value) / 100;

      // A price change must never quietly produce a negative price.
      const next = Math.max(0, item.sell_price + sign * delta);

      return { id: item.id, sell_price: Number(next.toFixed(2)) };
    });

    const changed = updates.filter((update, index) => {
      return update.sell_price !== scope[index].sell_price;
    });

    if (changed.length === 0) {
      return { error: "التعديل ده مش هيغيّر أي سعر." };
    }

    const wording =
      command.mode === "amount"
        ? `${command.value} جنيه`
        : `${command.value}%`;

    const sample = scope
      .slice(0, 3)
      .map(
        (item, index) =>
          `${item.name}: ${money(item.sell_price)} ← ${money(
            updates[index].sell_price
          )}`
      )
      .join("، ");

    return {
      kind: command.kind,
      summary: `${
        command.direction === "up" ? "هزوّد" : "هقلّل"
      } سعر ${scopeName} بـ ${wording} - ${changed.length} صنف هيتغيّر. مثال: ${sample}.`,
      affectedCount: changed.length,
      plan: { type: "update_items", updates },
    };
  }

  // The three single-item commands share the same lookup.
  const matches = matchItems(items, command.itemQuery);

  if (matches.length === 0) {
    return { error: `مش لاقي صنف اسمه "${command.itemQuery}".` };
  }

  if (matches.length > 1) {
    const names = matches
      .slice(0, 5)
      .map((item) => `"${item.name}"`)
      .join("، ");

    return {
      error: `لقيت أكتر من صنف قريب من "${command.itemQuery}": ${names}. حدّد الاسم أكتر.`,
    };
  }

  const item = matches[0];

  if (command.kind === "set_item_price") {
    const column =
      command.tier === 2
        ? "sell_price_2"
        : command.tier === 3
        ? "sell_price_3"
        : "sell_price";

    const current =
      column === "sell_price"
        ? item.sell_price
        : column === "sell_price_2"
        ? item.sell_price_2
        : item.sell_price_3;

    if (current === command.price) {
      return { error: `سعر "${item.name}" هو ${money(command.price)} أصلاً.` };
    }

    return {
      kind: command.kind,
      summary: `هغيّر سعر "${item.name}"${
        command.tier && command.tier > 1 ? ` (التسعيرة ${command.tier})` : ""
      } من ${current === null ? "غير محدد" : money(current)} لـ ${money(
        command.price
      )}.`,
      affectedCount: 1,
      plan: {
        type: "update_item",
        itemId: item.id,
        patch: { [column]: command.price },
      },
    };
  }

  // set_minimum_stock is the only single-item command left besides
  // pricing. Setting the stock QUANTITY itself is deliberately not on
  // the list: items.stock is derived from the FIFO batches and gets
  // recalculated on the next sale, so an assistant that "set" it
  // would be quietly lying. Receiving stock belongs in تزويد المخزون,
  // where the cost is recorded with it.
  return {
    kind: command.kind,
    summary: `هخلّي التنبيه يشتغل لما "${item.name}" يوصل ${command.minimum} أو أقل (دلوقتي ${item.minimum_stock ?? 0}).`,
    affectedCount: 1,
    plan: {
      type: "update_item",
      itemId: item.id,
      patch: { minimum_stock: command.minimum },
    },
  };
}

// Runs on the OWNER'S session. Every policy and trigger that applies
// to the owner doing this by hand applies here too - the assistant is
// not a way around them, and a failure here is a real permission
// error worth surfacing rather than swallowing.
export async function runPlan(
  supabase: SupabaseClient,
  businessId: string,
  plan: CommandPlan
): Promise<CommandOutcome> {
  try {
    if (plan.type === "insert_category") {
      const { error } = await supabase
        .from("categories")
        .insert({ business_id: businessId, name: plan.values.name });

      if (error) throw error;

      return { status: "ok", message: "اتضافت الفئة." };
    }

    if (plan.type === "insert_item") {
      const { error } = await supabase.from("items").insert({
        business_id: businessId,
        name: plan.values.name,
        sell_price: plan.values.sell_price,
        category_id: plan.values.category_id,
        item_type: plan.values.item_type,
        sale_method: plan.values.sale_method,
        has_stock: plan.values.has_stock,
      });

      if (error) throw error;

      return { status: "ok", message: "اتضاف الصنف." };
    }

    if (plan.type === "update_item") {
      const { error } = await supabase
        .from("items")
        .update(plan.patch)
        .eq("id", plan.itemId)
        .eq("business_id", businessId);

      if (error) throw error;

      return { status: "ok", message: "اتعدّل." };
    }

    // Chunked so one enormous request can't sit on a connection for
    // as long as it likes.
    for (const update of plan.updates) {
      const { error } = await supabase
        .from("items")
        .update({ sell_price: update.sell_price })
        .eq("id", update.id)
        .eq("business_id", businessId);

      if (error) throw error;
    }

    return { status: "ok", message: `اتعدّل ${plan.updates.length} صنف.` };
  } catch (err) {
    console.error("runPlan failed:", err);

    const message =
      err instanceof Error && err.message ? err.message : "تعذر التنفيذ";

    return { status: "error", message };
  }
}
