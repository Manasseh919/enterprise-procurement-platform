# Enterprise Procurement & Integration Platform

Production-style enterprise procurement and system integration platform.

Employees create purchase requests, managers approve them, procurement converts approved requests into purchase orders, and those orders are sent to external systems through SAP Integration Suite. The platform also tracks integration messages, goods receipts, and invoices.

## Architecture

The application itself is self-hosted. SAP BTP is used only for SAP Integration Suite capabilities (Cloud Integration and API Management). CAP, the React dashboard, the Fiori app, and the simulated external APIs are not deployed to SAP BTP.

```text
GitHub → GitHub Actions → VPS
                           ├── React Dashboard
                           ├── Fiori App
                           └── SAP CAP API (Node.js / TypeScript)
                                      │
                                      ▼
                              Neon PostgreSQL

CAP → SAP Integration Suite (Cloud Integration, API Management)
   → Supplier API / ERP API / Accounting API