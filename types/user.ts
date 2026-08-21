import { UserRole } from "./role";

export interface User {
  id: string;

  auth_user_id: string;

  business_id: string;

  branch_id?: string;

  full_name: string;

  email?: string;

  phone?: string;

  role: UserRole;

  // What this person's job is, when role is 'employee'. Owners are
  // stored as 'manager' but are never limited by it - see
  // lib/permissions.ts and has_permission() in migration 047.
  // Optional here only so older code that builds a User literal keeps
  // compiling; the column itself is NOT NULL with a default.
  staff_role?: "cashier" | "stock_keeper" | "manager";

  // One-off abilities the owner topped up for this person, on top of
  // whatever staff_role already gives them.
  extra_permissions?: string[];

  active: boolean;

  avatar?: string;

  created_at: string;

  updated_at: string;
}
