export type IntegrationErrorCode =
  | "TIMEOUT"
  | "NETWORK"
  | "HTTP_4XX"
  | "HTTP_5XX"
  | "INVALID_RESPONSE";

export type OrderItemPayload = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type SendPurchaseOrderPayload = {
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  supplierId: string;
  items: OrderItemPayload[];
};

export type ConfirmPurchaseOrderPayload = {
  purchaseOrderId: string;
  externalOrderId: string;
};

export type ReceiveGoodsPayload = {
  purchaseOrderId: string;
  erpPurchaseOrderId: string;
  quantityReceived: number;
  notes?: string;
};

export type SendInvoicePayload = {
  invoiceId: string;
  invoiceNumber: string;
  purchaseOrderNumber: string;
  supplierId: string;
  amount: number;
  currency: string;
};

export type SupplierOrderResponse = {
  externalOrderId: string;
  status: string;
  confirmedAt?: string;
};

export type ErpPurchaseOrderResponse = {
  erpPurchaseOrderId: string;
  status: string;
};

export type ErpGoodsReceiptResponse = {
  goodsReceiptId: string;
  erpPurchaseOrderId: string;
  quantityReceived: number;
  purchaseOrderStatus: string;
};

export type AccountingInvoiceResponse = {
  externalInvoiceId: string;
  status: string;
};

export type IntegrationMessageRow = {
  ID: string;
  messageId: string;
  messageType: string;
  destinationSystem: string;
  businessEntityType?: string;
  businessEntityId?: string;
  status: string;
  attempts: number;
  payload?: string | null;
  responsePayload?: string | null;
  errorMessage?: string | null;
};

export type OutboundResult<T> = {
  messageId: string;
  status: "SUCCESS" | "FAILED";
  attempts: number;
  result?: T;
  errorMessage?: string | null;
  responsePayload?: string | null;
};