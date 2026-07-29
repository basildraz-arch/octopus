export type UserRole =
  | "owner"
  | "manager"
  | "employee";

export interface RolePermissions {
  dashboard: boolean;

  sales: boolean;

  items: boolean;

  customers: boolean;

  suppliers: boolean;

  expenses: boolean;

  reports: boolean;

  employees: boolean;

  settings: boolean;
}