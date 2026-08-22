# SAP Cloud Integration

This folder documents Integration Suite iFlows. Credentials stay in local `.env`, never in git.

## Prerequisites

- SAP BTP trial (or paid) subaccount
- Integration Suite subscription with Cloud Integration capability
- Role collections: `PI_Administrator`, `PI_Integration_Developer`, `PI_Business_Expert`
- Local Supplier API on port 4010 plus a public tunnel

## 1. Process Integration Runtime

In BTP Cockpit → Instances and Subscriptions:

1. Create instance: service `SAP Process Integration Runtime`, plan `integration-flow`.
2. Create a service key.
3. Copy `clientid` and `clientsecret`. Those are Basic auth user and password for CAP and Postman.

## 2. Design the iFlow

In Integration Suite → Design → Integrations:

1. Create package `EPP_Procurement`.
2. Add Integration Flow `EPP_Supplier_SendPurchaseOrder`.
3. Sender: HTTPS, address `/epp/supplier/orders`, CSRF off, role `ESBMessaging.send`.
4. Add Groovy Script. Paste `scripts/ValidateAndMapSupplierOrder.groovy`.
5. Add Request Reply + HTTP receiver to `https://<tunnel>/api/orders`.
6. Add Exception Subprocess: on error, set body `{"error":"supplier integration failed"}` and fail the exchange.
7. Save and **Deploy**.

## 3. Find the endpoint

Monitor → Manage Integration Content → the iFlow → copy the HTTPS endpoint.

It looks like:

`https://<tenant>.integrationsuite.cfapps.<region>.hana.ondemand.com/http/epp/supplier/orders`

## 4. Test in Postman before CAP

POST that URL

Headers: `Content-Type: application/json`

Authorization: Basic, username = service key `clientid`, password = `clientsecret`

Body: the sample in `supplier-purchase-order.md`

Expected: 200 and `externalOrderId` / `ACCEPTED`.

Check Cloud Integration monitoring for the message and the Groovy attachment.

## 5. Point CAP at the iFlow

In `apps/cap/.env` (gitignored):

INTEGRATION_SUPPLIER_URL=<the HTTPS endpoint>
INTEGRATION_SUPPLIER_USER=<clientid>
INTEGRATION_SUPPLIER_PASSWORD=<clientsecret>
INTEGRATION_TIMEOUT_MS=30000

Restart `cds watch --profile pg`.