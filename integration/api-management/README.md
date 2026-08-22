# SAP API Management

Protects the Supplier simulator. Cloud Integration is not used.

Flow:

CAP → API Management proxy → Supplier API (`/api/orders`)

Do not commit API keys.

## 1. Import the specification

In Integration Suite → API Management (API Portal / Engage):

1. Create or open the API Portal.
2. Add API → Import → OpenAPI.
3. Select `openapi/supplier-purchase-orders.yaml`.
4. Name: `epp-supplier-purchase-orders`
5. Version: `v1`

## 2. Backend target

Target URL: `https://<SUPPLIER_PUBLIC_URL>`

Path mapping:

| Proxy (what callers use) | Target (simulator) |
|---|---|
| POST `/api/v1/purchase-orders` | POST `/api/orders` |
| GET `/api/v1/purchase-orders/{id}` | GET `/api/orders/{id}` |

If the UI has no path rewrite, set the proxy base path so it still forwards to those simulator routes.

## 3. Policies (ProxyEndpoint PreFlow)

Add, in this order:

1. Verify API Key — header `apikey`
2. Spike Arrest — `10ps` (10 per second) for the trial
3. Assign Message / log correlation id if you want extra logging

Publish the API. Create a **Product**, add this API, publish the product.

## 4. Application key

In the Developer Portal / API Business Hub Enterprise:

1. Create an application.
2. Subscribe it to the product.
3. Copy the **Application key**. That is the `apikey` header.

## 5. Test in Postman (before CAP)

POST `https://<apim-host>/api/v1/purchase-orders`

Headers:

- `Content-Type: application/json`
- `apikey: <application-key>`

Body:

{
  "purchaseOrderNumber": "PO-2026-000001",
  "supplierId": "SUP-001",
  "items": [
    { "description": "Laptop", "quantity": 2, "unitPrice": 1500 }
  ]
}

Expected: 201, `externalOrderId`, `ACCEPTED`.

Without `apikey`: 401.
Send many requests quickly: 429.

## 6. Point CAP at the proxy

In gitignored `apps/cap/.env`:

INTEGRATION_SUPPLIER_URL=https://<apim-host>/api/v1/purchase-orders
INTEGRATION_SUPPLIER_API_KEY=<application-key>
INTEGRATION_TIMEOUT_MS=30000

Restart `cds watch --profile pg`.