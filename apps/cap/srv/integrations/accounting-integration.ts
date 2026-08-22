import { integrationConfig } from "./config.js";
import { postJson } from "./http-client.js";
import type {
  AccountingInvoiceResponse,
  SendInvoicePayload,
} from "./types.js";

export async function sendAccountingInvoice(
  payload: SendInvoicePayload,
): Promise<AccountingInvoiceResponse> {
  const { accountingBaseUrl, timeoutMs } = integrationConfig();
  return postJson<AccountingInvoiceResponse>(
    `${accountingBaseUrl}/api/invoices`,
    {
      invoiceNumber: payload.invoiceNumber,
      purchaseOrderNumber: payload.purchaseOrderNumber,
      supplierId: payload.supplierId,
      amount: payload.amount,
      currency: payload.currency,
    },
    timeoutMs,
  );
}