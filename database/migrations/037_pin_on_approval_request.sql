-- ==========================================
-- OCTOPUS ERP
-- Carry the cashier's PIN through the approval request
--
-- Why: the original flow left a dead state. Master approves -> an
-- account exists -> but it has no PIN, so the cashier cannot log in
-- at all until the owner remembers to go and set one. That gap was
-- hit immediately in real testing ("مش راضي يدخل اصلا"), which is
-- exactly the kind of step a busy shop owner will skip.
--
-- Now the owner chooses the PIN in the same form where they name the
-- cashier, and approval copies it straight into employee_pins - so an
-- approved account is a working account, always.
--
-- The column holds a scrypt hash, never a PIN. It is written by the
-- request API route (service role) and read only by the approval
-- route; no client-side policy grants access to it, and the SELECT
-- policy on this table already exposes the row to the owner - hence
-- storing a hash rather than anything reversible matters here.
-- ==========================================

alter table employee_approval_requests
    add column if not exists pin_hash text;

-- Belt and braces: the owner CAN read their own request rows (the
-- read_requests policy), so make sure a hash is all that can ever
-- live here.
comment on column employee_approval_requests.pin_hash is
  'scrypt$<salt>$<key> - never a plaintext PIN. Copied into employee_pins on approval.';
