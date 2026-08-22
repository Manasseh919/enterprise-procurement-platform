import { integrationConfig } from "./config.js";
import { postJson } from "./http-client.js";
import type {
  ErpGoodsReceiptResponse,
  ErpPurchaseOrderResponse,
  ReceiveGoodsPayload,
  SendPurchaseOrderPayload,
} from "./types.js";

export async function sendErpPurchaseOrder(
  payload: SendPurchaseOrderPayload,
): Promise<ErpPurchaseOrderResponse> {
  const { erpBaseUrl, timeoutMs } = integrationConfig();
  return postJson<ErpPurchaseOrderResponse>(
    `${erpBaseUrl}/api/purchase-orders`,
    {
      purchaseOrderNumber: payload.purchaseOrderNumber,
      supplierId: payload.supplierId,
      items: payload.items,
    },
    timeoutMs,
  );
}

export async function sendErpGoodsReceipt(
  payload: ReceiveGoodsPayload,
): Promise<ErpGoodsReceiptResponse> {
  const { erpBaseUrl, timeoutMs } = integrationConfig();
  return postJson<ErpGoodsReceiptResponse>(
    `${erpBaseUrl}/api/goods-receipts`,
    {
      erpPurchaseOrderId: payload.erpPurchaseOrderId,
      quantityReceived: payload.quantityReceived,
      notes: payload.notes,
    },
    timeoutMs,
  );
}