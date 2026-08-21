export type ChangeRequestKind =
  | "enable_feature"
  | "disable_feature"
  | "change_business_type"
  | "add_warehouse"
  | "add_branch"
  | "other";

export type ChangeRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export interface ChangeRequest {
  id: string;

  business_id: string;

  requested_by: string | null;

  kind: ChangeRequestKind;

  // Shape depends on kind:
  //   enable_feature / disable_feature  -> { feature: FeatureKey }
  //   change_business_type              -> { business_type: string }
  //   add_warehouse / add_branch        -> { name: string }
  payload: Record<string, unknown>;

  // What the owner wrote, in their own words.
  note: string;

  status: ChangeRequestStatus;

  reviewed_by: string | null;

  reviewed_at: string | null;

  review_note: string | null;

  created_at: string;
}

export const CHANGE_REQUEST_KIND_LABELS: Record<ChangeRequestKind, string> = {
  enable_feature: "تفعيل ميزة",
  disable_feature: "إلغاء ميزة",
  change_business_type: "تغيير نوع النشاط",
  add_warehouse: "إضافة مخزن",
  add_branch: "إضافة فرع",
  other: "طلب تاني",
};

export const CHANGE_REQUEST_STATUS_LABELS: Record<
  ChangeRequestStatus,
  string
> = {
  pending: "مستني الموافقة",
  approved: "اتوافق عليه",
  rejected: "اترفض",
  cancelled: "اتلغى",
};
