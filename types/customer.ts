export interface Customer {
  id: string;

  business_id: string;

  name: string;

  phone?: string | null;

  note?: string | null;

  active: boolean;

  created_at: string;

  updated_at: string;
}

export interface CustomerBalance {
  customer: Customer;

  // Everything they have taken on account.
  charged: number;

  // Everything they have paid, plus any owner corrections.
  paid: number;

  // charged - paid. Positive means they owe the shop.
  balance: number;

  lastActivityAt: string | null;
}
