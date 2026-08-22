import { integrationConfig } from "./config.js";
import { postJson } from "./http-client.js";
import type {
  SendPurchaseOrderPayload,
  SupplierOrderResponse,
} from "./types.js";

export async function sendSupplierOrder(
  payload: SendPurchaseOrderPayload,
): Promise<SupplierOrderResponse> {
  const { supplierBaseUrl, timeoutMs } = integrationConfig();
  return postJson<SupplierOrderResponse>(
    `${supplierBaseUrl}/api/orders`,
    {
      purchaseOrderNumber: payload.purchaseOrderNumber,
      supplierId: payload.supplierId,
      items: payload.items,
    },
    timeoutMs,
  );
}

export async function confirmSupplierOrder(
  externalOrderId: string,
): Promise<SupplierOrderResponse> {
  const { supplierBaseUrl, timeoutMs } = integrationConfig();
  return postJson<SupplierOrderResponse>(
    `${supplierBaseUrl}/api/orders/${encodeURIComponent(externalOrderId)}/confirm`,
    {},
    timeoutMs,
  );
}