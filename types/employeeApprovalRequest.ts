export type EmployeeApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

export interface EmployeeApprovalRequest {
  id: string;

  business_id: string;

  requested_by: string;

  full_name: string;

  phone?: string;

  branch_id?: string;

  generated_email: string;

  // What the owner asked this person to be. Copied onto the `users`
  // row the moment the request is approved.
  staff_role?: "cashier" | "stock_keeper" | "manager";

  extra_permissions?: string[];

  status: EmployeeApprovalStatus;

  reviewed_by?: string;

  reviewed_at?: string;

  rejection_reason?: string;

  created_user_id?: string;

  created_at: string;

  updated_at: string;
}
