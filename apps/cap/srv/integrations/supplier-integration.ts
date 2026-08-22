import { integrationConfig } from "./config.js";
import { postJson } from "./http-client.js";
import type {
  SendPurchaseOrderPayload,
  SupplierOrderResponse,
} from "./types.js";

export async function sendSupplierOrder(
  payload: SendPurchaseOrderPayload,
): Promise<SupplierOrderResponse> {
  const {
    supplierOrdersUrl,
    supplierUser,
    supplierPassword,
    supplierApiKey,
    timeoutMs,
  } = integrationConfig();

  return postJson<SupplierOrderResponse>(
    supplierOrdersUrl,
    {
      purchaseOrderNumber: payload.purchaseOrderNumber,
      supplierId: payload.supplierId,
      items: payload.items,
    },
    timeoutMs,
    {
      user: supplierUser,
      password: supplierPassword,
      apiKey: supplierApiKey,
    },
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