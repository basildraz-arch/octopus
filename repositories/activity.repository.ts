import { supabase } from "@/lib/supabase";

export async function logActivity(
  userId: string,
  businessId: string
): Promise<void> {
  const { error } = await supabase
    .from("user_activity_log")
    .insert({ user_id: userId, business_id: businessId });

  if (error) {
    console.error("Supabase Error:", error.message);
  }
}

export type UserActivitySummary = {
  userId: string;
  userName: string;
  businessName: string;
  firstActivity: string;
  lastActivity: string;
};

type ActivityRow = {
  user_id: string;
  created_at: string;
  users: { full_name: string } | null;
  businesses: { name: string } | null;
};

export async function getActivityByDate(
  date: string
): Promise<UserActivitySummary[]> {
  const start = new Date(`${date}T00:00:00`).toISOString();
  const end = new Date(`${date}T23:59:59.999`).toISOString();

  const { data, error } = await supabase
    .from("user_activity_log")
    .select(
      `
      user_id,
      created_at,
      users ( full_name ),
      businesses ( name )
    `
    )
    .gte("created_at", start)
    .lte("created_at", end)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  const rows = (data ?? []) as unknown as ActivityRow[];

  const grouped = new Map<string, UserActivitySummary>();

  for (const row of rows) {
    const existing = grouped.get(row.user_id);

    if (!existing) {
      grouped.set(row.user_id, {
        userId: row.user_id,
        userName: row.users?.full_name ?? "مستخدم محذوف",
        businessName: row.businesses?.name ?? "بيزنس محذوف",
        firstActivity: row.created_at,
        lastActivity: row.created_at,
      });
    } else {
      existing.lastActivity = row.created_at;
    }
  }

  return Array.from(grouped.values());
}
