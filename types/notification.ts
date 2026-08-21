export type NotificationAudience =
  | "owner"
  | "all_staff"
  | "user"
  | "platform_admin";

export type NotificationSeverity = "info" | "warning" | "danger";

export interface AppNotification {
  id: string;

  business_id: string | null;

  audience: NotificationAudience;

  user_id: string | null;

  // What happened, in one machine-readable word: 'low_stock',
  // 'employee_request', 'change_request', 'assistant', ...
  kind: string;

  title: string;

  body: string;

  // Where tapping it should take you.
  link: string | null;

  severity: NotificationSeverity;

  read_at: string | null;

  created_at: string;
}
