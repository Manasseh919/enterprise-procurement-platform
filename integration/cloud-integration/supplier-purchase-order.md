# iFlow: EPP Send Purchase Order to Supplier

Package: `EPP_Procurement`
iFlow name: `EPP_Supplier_SendPurchaseOrder`
HTTPS address: `/epp/supplier/orders`

## Flow

HTTPS Sender
  → Groovy: ValidateAndMapSupplierOrder
  → Request Reply: HTTP Receiver (Supplier API)
  → End

Exception Subprocess:
  Error Start → Content Modifier (error JSON) → Error End

## Sender (HTTPS)

- Adapter: HTTPS
- Address: `/epp/supplier/orders`
- Authorization: User Role
- User Role: `ESBMessaging.send`
- CSRF Protection: off

## Receiver (HTTP)

- Method: POST
- Address: `https://<SUPPLIER_PUBLIC_URL>/api/orders`
- Authentication: None
- Request headers: Content-Type = application/json

Replace `<SUPPLIER_PUBLIC_URL>` with the Cloudflare/ngrok HTTPS origin (no trailing slash).

## Expected request (from CAP)

{
  "purchaseOrderNumber": "PO-2026-000001",
  "supplierId": "SUP-001",
  "items": [
    { "description": "Laptop", "quantity": 2, "unitPrice": 1500 }
  ]
}

## Expected response (from Supplier API, returned to CAP)

{
  "externalOrderId": "SUP-ORD-10001",
  "status": "ACCEPTED"
}