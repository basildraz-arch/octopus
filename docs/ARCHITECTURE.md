# 🐙 Octopus Architecture

## Vision

Octopus is an AI-powered Business Operating System.

It is not only a POS system.

It contains:

- POS
- CRM
- Inventory
- Accounting
- AI
- Social Media
- Call Center
- Reports

---

# Architecture

UI

↓

Features

↓

Services

↓

Repositories

↓

Supabase

---

# Rules

1. No hardcoded products.
2. No hardcoded categories.
3. No hardcoded settings.
4. Every editable value must have a screen.
5. UI never talks directly to Supabase.
6. Every feature is isolated.
7. Mobile First.
8. AI First.
9. Multi Business.
10. Offline Ready.

---

# Folder Structure

app/

components/

features/

services/

repositories/

lib/

hooks/

types/

utils/

database/

docs/