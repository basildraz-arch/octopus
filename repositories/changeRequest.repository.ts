import { supabase } from "@/lib/supabase";
import type {
  ChangeRequest,
  ChangeRequestKind,
} from "@/types/changeRequest";

// Asking is all a client can do. The change_requests_owner_insert
// policy (migration 049) pins requested_by to the caller and status
// to 'pending'; approving happens server-side behind
// requirePlatformAdmin, because applying the change needs the service
// role that the three guard triggers make an exception for.
export async function createChangeRequest(params: {
  businessId: string;
  requestedBy: string;
  kind: ChangeRequestKind;
  payload: Record<string, unknown>;
  note: string;
}): Promise<ChangeRequest> {
  const { data, error } = await supabase
    .from("change_requests")
    .insert({
      business_id: params.businessId,
      requested_by: params.requestedBy,
      kind: params.kind,
      payload: params.payload,
      note: params.note,
    })
    .select("*")
    .single();

  if (error) throw error;

  return data as ChangeRequest;
}

export async function getChangeRequests(
  businessId?: string
): Promise<ChangeRequest[]> {
  let query = supabase
    .from("change_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (businessId) {
    query = query.eq("business_id", businessId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return (data ?? []) as ChangeRequest[];
}

export async function getPendingChangeRequests(): Promise<ChangeRequest[]> {
  const { data, error } = await supabase
    .from("change_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Supabase Error:", error.message);
    return [];
  }

  return (data ?? []) as ChangeRequest[];
}

export async function cancelChangeRequest(id: string): Promise<void> {
  const { error } = await supabase
    .from("change_requests")
    .update({ status: "cancelled" })
    .eq("id", id);

  if (error) throw error;
}
