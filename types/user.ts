import { UserRole } from "./role";

export interface User {
  id: string;

  business_id: string;

  branch_id?: string;

  full_name: string;

  email?: string;

  phone?: string;

  role: UserRole;

  active: boolean;

  avatar?: string;

  created_at: string;

  updated_at: string;
}