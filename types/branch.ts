export interface Branch {
  id: string;

  business_id: string;

  name: string;

  code: string;

  phone?: string;

  email?: string;

  address?: string;

  manager_id?: string;

  active: boolean;

  created_at: string;

  updated_at: string;
}