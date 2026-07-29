# 🗄️ OCTOPUS DATABASE

## Design Philosophy

The database is designed around Business Entities.

We design the business first.

Then convert it into database tables.

Never design tables first.

---

# Core Entities

## Business

Represents the company or shop.

Examples

- Pet Shop
- Barber Shop
- Restaurant
- Workshop

---

## User

Represents anyone who can log in.

Examples

- Owner
- Manager
- Employee

---

## Employee

Represents employee information.

Salary

Phone

Role

Permissions

---

## Customer

Represents customers.

Name

Phone

Address

Notes

Loyalty

---

## Supplier

Represents suppliers.

Name

Phone

Address

Notes

---

## Item

Represents Products and Services.

Every item is either

Product

or

Service

---

## Category

Groups items.

Examples

Food

Accessories

Shampoo

Services

---

## Sale

Represents an invoice.

Contains

Customer

Items

Payments

Discount

Tax

Total

---

## Sale Item

Represents one line inside a Sale.

Item

Quantity

Unit

Price

Discount

Total

---

## Inventory

Represents stock movement.

Purchase

Sale

Adjustment

Return

Transfer

---

## Payment

Represents payment records.

Cash

Visa

Vodafone Cash

InstaPay

Bank

Credit

---

## Cashbox

Represents money locations.

Cash Drawer

Bank

Vodafone Cash

InstaPay

---

## Purchase

Supplier invoices.

---

## Purchase Item

Items inside purchases.

---

## Expense

Any expense.

Rent

Electricity

Salary

Transportation

---

## Branch

Future feature.

One business can contain multiple branches.
---

# Entity Relationships

## Business

A Business owns:

- Users
- Employees
- Customers
- Suppliers
- Categories
- Items
- Sales
- Purchases
- Cashboxes
- Expenses
- Branches

One Business

↓

Many Users

One Business

↓

Many Items

One Business

↓

Many Customers

One Business

↓

Many Suppliers

One Business

↓

Many Sales

One Business

↓

Many Purchases

---

## Category

One Category

↓

Many Items

---

## Customer

One Customer

↓

Many Sales

---

## Supplier

One Supplier

↓

Many Purchases

---

## Sale

One Sale contains

↓

Many Sale Items

One Sale belongs to

↓

One Customer

One Sale belongs to

↓

One Business

---

## Sale Item

Every Sale Item belongs to

↓

One Sale

Every Sale Item points to

↓

One Item

---

## Purchase

One Purchase contains

↓

Many Purchase Items

One Purchase belongs to

↓

One Supplier

---

## Purchase Item

Every Purchase Item belongs to

↓

One Purchase

Every Purchase Item points to

↓

One Item

---

## Item

Every Item belongs to

↓

One Business

Every Item belongs to

↓

One Category

One Item may appear in

↓

Many Sale Items

One Item may appear in

↓

Many Purchase Items

One Item creates

↓

Many Inventory Movements

---

## Inventory

Every movement belongs to

↓

One Item

Movement Types

- Purchase
- Sale
- Return
- Adjustment
- Transfer