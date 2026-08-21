import { supabase } from "@/lib/supabase";
import type { AppNotification } from "@/types/notification";

// No business_id filter anywhere in this file, on purpose. Which rows
// a person may see is decided by the notifications_read policy
// (migration 048) - an owner sees their business's owner notices, a
// cashier sees only what's addressed to all staff or to them, and the
// platform admin sees the platform ones. Filtering here as well would
// only hide a bug in that policy.
export async function getNotifications(
  limit = 50
): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return (data ?? []) as AppNotification[];
}

export async function getUnreadCount(): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) {
    console.error("Supabase Error:", error.message);
    return 0;
  }

  return count ?? 0;
}

// The only write a client is allowed to make. The
// protect_notification_columns trigger rejects anything else that
// tries to come through this same path.
export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);

  if (error) throw error;
}
