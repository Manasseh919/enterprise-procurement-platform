import cds from "@sap/cds";
import type { Request } from "@sap/cds";
import { sendAccountingInvoice } from "./integrations/accounting-integration.js";
import { integrationConfig } from "./integrations/config.js";
import {
  sendErpGoodsReceipt,
  sendErpPurchaseOrder,
} from "./integrations/erp-integration.js";
import {
  confirmSupplierOrder,
  sendSupplierOrder,
} from "./integrations/supplier-integration.js";
import {
  findSuccessMessage,
  getIntegrationMessage,
  maxAttemptsReached,
  MESSAGE_TYPES,
  parseJson,
  runOutbound,
} from "./integrations/tracker.js";
import type {
  AccountingInvoiceResponse,
  ConfirmPurchaseOrderPayload,
  ErpGoodsReceiptResponse,
  ErpPurchaseOrderResponse,
  IntegrationMessageRow,
  OrderItemPayload,
  ReceiveGoodsPayload,
  SendInvoicePayload,
  SendPurchaseOrderPayload,
  SupplierOrderResponse,
} from "./integrations/types.js";

type PurchaseRequestRow = {
  ID: string;
  requestNumber: string;
  status: string;
  currency?: string;
  requester_ID?: string;
  department_ID?: string;
};

type PurchaseRequestItemRow = {
  ID: string;
  description: string;
  quantity: number;
  unitPrice: number;
  currency?: string;
};

type EmployeeRow = {
  ID: string;
  email: string;
  role: string;
};

type ApprovalRow = {
  ID: string;
  status: string;
  comment?: string | null;
};

type SupplierRow = {
  ID: string;
  supplierNumber: string;
  status: string;
};

type PurchaseOrderRow = {
  ID: string;
  purchaseOrderNumber: string;
  status: string;
  totalAmount?: number;
  currency?: string;
  supplier_ID?: string;
  externalOrderId?: string | null;
};

type PurchaseOrderItemRow = {
  description: string;
  quantity: number;
  unitPrice: number;
};

type InvoiceRow = {
  ID: string;
  invoiceNumber: string;
  status: string;
  amount?: number;
  currency?: string;
  externalInvoiceId?: string | null;
};

function httpError(status: number, message: string): never {
  throw Object.assign(new Error(message), { status, code: String(status) });
}

function asMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function idFromUnknown(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (value && typeof value === "object" && "ID" in value) {
    const id = (value as { ID?: string }).ID;
    if (id) return id;
  }
}

function idFromUrl(
    url: string | undefined,
    entityName: string,
  ): string | undefined {
    if (!url) return;
    const match = decodeURIComponent(url).match(
      new RegExp(
        `${entityName}\\((?:ID=)?(?:guid)?(?:"|')?([0-9a-fA-F-]{36})`,
        "i",
      ),
    );
    return match?.[1];
  }
  

  function idFromSubject(subject: unknown): string | undefined {
    if (!subject || typeof subject !== "object") return;
    const ref = (subject as { ref?: unknown[] }).ref;
    if (!Array.isArray(ref)) return;
    for (const part of ref) {
      if (!part || typeof part !== "object") continue;
      const direct = idFromUnknown(part);
      if (direct) return direct;
      const where = (part as { where?: unknown[] }).where;
      if (!Array.isArray(where)) continue;
      for (let i = 0; i < where.length; i++) {
        const token = where[i] as { ref?: string[]; val?: unknown };
        const next = where[i + 2] as { val?: unknown } | undefined;
        if (token?.ref?.[0] === "ID") {
          const value = idFromUnknown(next?.val ?? next);
          if (value) return value;
        }
        if (
          typeof token?.val === "string" &&
          /^[0-9a-fA-F-]{36}$/i.test(token.val)
        ) {
          return token.val;
        }
      }
    }
  }

  function boundId(req: Request, entityName = "PurchaseRequests"): string {
    const fromParams = idFromUnknown(
      Array.isArray(req.params) ? req.params[0] : req.params,
    );
    if (fromParams) return fromParams;
    const fromSubject = idFromSubject(req.subject);
    if (fromSubject) return fromSubject;
    const innerReq = (
      req as unknown as {
        _?: { req?: { originalUrl?: string; url?: string } };
      }
    )._?.req;
    const httpReq = cds.context?.http?.req as
      | { originalUrl?: string; url?: string; body?: unknown }
      | undefined;
    const fromInner = idFromUrl(
      innerReq?.originalUrl || innerReq?.url,
      entityName,
    );
    if (fromInner) return fromInner;
    const fromUrl = idFromUrl(httpReq?.originalUrl || httpReq?.url, entityName);
    if (fromUrl) return fromUrl;
    const batchBody =
      typeof httpReq?.body === "string"
        ? httpReq.body
        : httpReq?.body
          ? JSON.stringify(httpReq.body)
          : "";
    const fromBatch = idFromUrl(batchBody, entityName);
    if (fromBatch) return fromBatch;
    httpError(400, `${entityName} ID is required`);
  }

function isAnonymous(req: Request): boolean {
    const user = req.user as
      | { id?: string; _is_anonymous?: boolean }
      | undefined;
    return !user || user.id === "anonymous" || Boolean(user._is_anonymous);
  }

function hasAnyRole(req: Request, roles: string[]): boolean {
  const user = req.user;
  if (!user) return false;
  return roles.some((role) => user.is(role));
}

function assertCanSubmit(req: Request): void {
  if (isAnonymous(req)) return;
  if (
    hasAnyRole(req, [
      "ADMIN",
      "admin",
      "EMPLOYEE",
      "employee",
      "authenticated-user",
      "any",
    ])
  )
    return;
  httpError(403, "Not authorized to submit purchase requests");
}

function assertCanApprove(req: Request): void {
  if (isAnonymous(req)) return;
  if (
    hasAnyRole(req, [
      "ADMIN",
      "admin",
      "MANAGER",
      "manager",
      "authenticated-user",
      "any",
    ])
  )
    return;
  httpError(403, "Not authorized to approve or reject purchase requests");
}

function assertCanCreatePurchaseOrder(req: Request): void {
  if (isAnonymous(req)) return;
  if (
    hasAnyRole(req, [
      "ADMIN",
      "admin",
      "PROCUREMENT",
      "procurement",
      "authenticated-user",
      "any",
    ])
  )
    return;
  httpError(403, "Not authorized to create purchase orders");
}

function assertCanSendPurchaseOrder(req: Request): void {
  if (isAnonymous(req)) return;
  if (
    hasAnyRole(req, [
      "ADMIN",
      "admin",
      "PROCUREMENT",
      "procurement",
      "authenticated-user",
      "any",
    ])
  )
    return;
  httpError(403, "Not authorized to send purchase orders");
}

function assertCanReceiveInvoice(req: Request): void {
  if (isAnonymous(req)) return;
  if (
    hasAnyRole(req, [
      "ADMIN",
      "admin",
      "FINANCE",
      "finance",
      "PROCUREMENT",
      "procurement",
      "authenticated-user",
      "any",
    ])
  )
    return;
  httpError(403, "Not authorized to receive invoices");
}

function assertCanRetry(req: Request): void {
  if (isAnonymous(req)) return;
  if (
    hasAnyRole(req, [
      "ADMIN",
      "admin",
      "PROCUREMENT",
      "procurement",
      "authenticated-user",
      "any",
    ])
  )
    return;
  httpError(403, "Not authorized to retry integration messages");
}

function wrapAction(
  handler: (req: Request) => Promise<unknown>,
  fallbackMessage: string,
) {
  return async (req: Request) => {
    try {
      return await handler(req);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status) throw err;
      httpError(500, err instanceof Error ? err.message : fallbackMessage);
    }
  };
}

function nextNumber(prefix: string, lastNumber?: string): string {
  const lastSequence = lastNumber?.startsWith(prefix)
    ? Number(lastNumber.slice(prefix.length))
    : 0;
  const sequence = Number.isFinite(lastSequence) ? lastSequence + 1 : 1;
  return `${prefix}${String(sequence).padStart(6, "0")}`;
}

function valueToParam(value: unknown): string {
    if (value == null) return "";
    if (typeof value === "string") {
      const trimmed = value.trim();
      const uuid = trimmed.match(
        /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/,
      );
      return uuid?.[0] ?? trimmed;
    }
    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      return (
        valueToParam(obj.ID) ||
        valueToParam(obj.id) ||
        valueToParam(obj.value) ||
        valueToParam(obj["@odata.id"]) ||
        valueToParam(obj["@odata.bind"])
      );
    }
    return String(value).trim();
  }
  function actionParam(req: Request, names: string[]): string {
    const sources: Record<string, unknown>[] = [];
    const data = (req.data ?? {}) as Record<string, unknown>;
    sources.push(data);
    const innerBody = (
      req as unknown as { _?: { req?: { body?: unknown } } }
    )._?.req?.body;
    if (innerBody && typeof innerBody === "object" && !Array.isArray(innerBody)) {
      sources.push(innerBody as Record<string, unknown>);
    }
    const httpBody = (
      cds.context?.http?.req as { body?: unknown } | undefined
    )?.body;
    if (httpBody && typeof httpBody === "object" && !Array.isArray(httpBody)) {
      sources.push(httpBody as Record<string, unknown>);
    }
    for (const source of sources) {
      for (const name of names) {
        const keys = [name, `${name}@odata.bind`, `${name}@odata.id`];
        for (const key of keys) {
          const extracted = valueToParam(source[key]);
          if (extracted) return extracted;
        }
      }
    }
    return "";
  }

function callResult(
  messageId: string,
  status: string,
  externalId = "",
  errorMessage = "",
  skipped = false,
) {
  return { messageId, status, externalId, errorMessage, skipped };
}

export default class ProcurementService extends cds.ApplicationService {
  override async init() {
    const { PurchaseRequests, PurchaseOrders, IntegrationMessages } =
      this.entities;

    this.on(
      "submitPurchaseRequest",
      PurchaseRequests,
      wrapAction((req) => this.submitPurchaseRequest(req), "Submit failed"),
    );
    this.on(
      "approvePurchaseRequest",
      PurchaseRequests,
      wrapAction(
        (req) => this.decidePurchaseRequest(req, "APPROVED"),
        "Approve failed",
      ),
    );
    this.on(
      "rejectPurchaseRequest",
      PurchaseRequests,
      wrapAction(
        (req) => this.decidePurchaseRequest(req, "REJECTED"),
        "Reject failed",
      ),
    );
    this.on(
      "createPurchaseOrder",
      PurchaseRequests,
      wrapAction(
        (req) => this.createPurchaseOrder(req),
        "Create purchase order failed",
      ),
    );
    this.on(
      "sendPurchaseOrder",
      PurchaseOrders,
      wrapAction(
        (req) => this.sendPurchaseOrder(req),
        "Send purchase order failed",
      ),
    );
    this.on(
      "confirmPurchaseOrder",
      PurchaseOrders,
      wrapAction(
        (req) => this.confirmPurchaseOrder(req),
        "Confirm purchase order failed",
      ),
    );
    this.on(
      "receiveGoods",
      PurchaseOrders,
      wrapAction((req) => this.receiveGoods(req), "Receive goods failed"),
    );
    this.on(
      "receiveInvoice",
      PurchaseOrders,
      wrapAction((req) => this.receiveInvoice(req), "Receive invoice failed"),
    );
    this.on(
      "retryIntegrationMessage",
      IntegrationMessages,
      wrapAction(
        (req) => this.retryIntegrationMessage(req),
        "Retry integration message failed",
      ),
    );

    await super.init();
  }

  private async submitPurchaseRequest(req: Request) {
    assertCanSubmit(req);

    const { PurchaseRequests, PurchaseRequestItems, Approvals } = this.entities;
    const ID = boundId(req);

    const request = (await SELECT.one
      .from(PurchaseRequests)
      .where({ ID })) as PurchaseRequestRow | null;

    if (!request) {
      httpError(404, "Purchase request not found");
    }

    const requestId = request.ID;

    if (request.status !== "DRAFT") {
      httpError(
        400,
        `Purchase request ${request.requestNumber} cannot be submitted from status ${request.status}`,
      );
    }

    const items = (await SELECT.from(PurchaseRequestItems).where({
      purchaseRequest_ID: requestId,
    })) as PurchaseRequestItemRow[];

    if (!items.length) {
      httpError(400, "A purchase request cannot be submitted without items");
    }

    let totalAmount = 0;

    for (const item of items) {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        httpError(400, "Each item quantity must be greater than zero");
      }

      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        httpError(400, "Each item price must be greater than zero");
      }

      const totalPrice = asMoney(quantity * unitPrice);
      totalAmount = asMoney(totalAmount + totalPrice);

      await UPDATE(PurchaseRequestItems)
        .set({ totalPrice })
        .where({ ID: item.ID });
    }

    const approver = await this.findApprover(
      request.department_ID,
      request.requester_ID,
    );

    if (!approver) {
      httpError(400, "No manager is available to approve this request");
    }

    const submittedAt = new Date().toISOString();

    await UPDATE(PurchaseRequests)
      .set({
        status: "PENDING_APPROVAL",
        totalAmount,
        submittedAt,
      })
      .where({ ID: requestId });

    await INSERT.into(Approvals).entries({
      purchaseRequest_ID: requestId,
      approver_ID: approver.ID,
      status: "PENDING",
    });

    return {
      ID: requestId,
      requestNumber: request.requestNumber,
      status: "PENDING_APPROVAL",
      totalAmount,
      currency: request.currency ?? "USD",
      submittedAt,
      approverEmail: approver.email,
    };
  }

  private async decidePurchaseRequest(
    req: Request,
    decision: "APPROVED" | "REJECTED",
  ) {
    assertCanApprove(req);

    const { PurchaseRequests, Approvals } = this.entities;
    const ID = boundId(req);
    const comment = actionParam(req, ["comment"]);

    if (decision === "REJECTED" && !comment) {
      httpError(400, "A rejection comment is required");
    }

    const request = (await SELECT.one
      .from(PurchaseRequests)
      .where({ ID })) as PurchaseRequestRow | null;

    if (!request) {
      httpError(404, "Purchase request not found");
    }

    if (request.status !== "PENDING_APPROVAL") {
      httpError(
        400,
        `Purchase request ${request.requestNumber} cannot be ${decision.toLowerCase()} from status ${request.status}`,
      );
    }

    const approval = (await SELECT.one.from(Approvals).where({
      purchaseRequest_ID: request.ID,
      status: "PENDING",
    })) as ApprovalRow | null;

    if (!approval) {
      httpError(400, "No pending approval exists for this purchase request");
    }

    const decidedAt = new Date().toISOString();

    await UPDATE(Approvals)
      .set({
        status: decision,
        comment:
          decision === "REJECTED" ? comment : (approval.comment ?? comment),
        approvedAt: decidedAt,
      })
      .where({ ID: approval.ID });

    await UPDATE(PurchaseRequests)
      .set(
        decision === "APPROVED"
          ? { status: "APPROVED", approvedAt: decidedAt }
          : { status: "REJECTED", rejectedAt: decidedAt },
      )
      .where({ ID: request.ID });

    return {
      ID: request.ID,
      requestNumber: request.requestNumber,
      status: decision,
      comment:
        decision === "REJECTED" ? comment : (approval.comment ?? comment),
      decidedAt,
    };
  }

  private async createPurchaseOrder(req: Request) {
    assertCanCreatePurchaseOrder(req);

    const {
      PurchaseRequests,
      PurchaseRequestItems,
      PurchaseOrders,
      PurchaseOrderItems,
      Suppliers,
    } = this.entities;
    const requestId = boundId(req);
    const supplierId = actionParam(req, [
      "supplier_ID",
      "supplierId",
      "supplierID",
    ]);
    if (!supplierId) {
      httpError(400, "A supplier is required to create a purchase order");
    }

    const request = (await SELECT.one
      .from(PurchaseRequests)
      .where({ ID: requestId })) as PurchaseRequestRow | null;

    if (!request) {
      httpError(404, "Purchase request not found");
    }

    if (request.status !== "APPROVED") {
      httpError(
        400,
        `Purchase order can only be created from an APPROVED request. Current status is ${request.status}`,
      );
    }

    const existingOrder = (await SELECT.one
      .from(PurchaseOrders)
      .where({ purchaseRequest_ID: request.ID })) as PurchaseOrderRow | null;

    if (existingOrder) {
      httpError(
        400,
        `Purchase request ${request.requestNumber} already has purchase order ${existingOrder.purchaseOrderNumber}`,
      );
    }

    const supplier = (await SELECT.one
      .from(Suppliers)
      .where({ ID: supplierId })) as SupplierRow | null;

    if (!supplier) {
      httpError(404, "Supplier not found");
    }

    if (supplier.status !== "ACTIVE") {
      httpError(400, `Supplier ${supplier.supplierNumber} is not ACTIVE`);
    }

    const items = (await SELECT.from(PurchaseRequestItems).where({
      purchaseRequest_ID: request.ID,
    })) as PurchaseRequestItemRow[];

    if (!items.length) {
      httpError(400, "A purchase order cannot be created without items");
    }

    let totalAmount = 0;
    const orderItems = items.map((item) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const totalPrice = asMoney(quantity * unitPrice);
      totalAmount = asMoney(totalAmount + totalPrice);
      return {
        description: item.description,
        quantity,
        unitPrice,
        totalPrice,
        currency: item.currency ?? request.currency ?? "USD",
      };
    });

    const purchaseOrderNumber =
      await this.nextPurchaseOrderNumber(PurchaseOrders);
    const currency = request.currency ?? "USD";

    const created = (await INSERT.into(PurchaseOrders).entries({
      purchaseOrderNumber,
      purchaseRequest_ID: request.ID,
      supplier_ID: supplier.ID,
      status: "CREATED",
      totalAmount,
      currency,
    })) as { ID?: string } | undefined;

    const purchaseOrder = (await SELECT.one
      .from(PurchaseOrders)
      .where(
        created?.ID ? { ID: created.ID } : { purchaseOrderNumber },
      )) as PurchaseOrderRow | null;

    if (!purchaseOrder) {
      httpError(500, "Purchase order was not created");
    }

    await INSERT.into(PurchaseOrderItems).entries(
      orderItems.map((item) => ({
        ...item,
        purchaseOrder_ID: purchaseOrder.ID,
      })),
    );

    await UPDATE(PurchaseRequests)
      .set({ status: "ORDER_CREATED" })
      .where({ ID: request.ID });

    return {
      ID: purchaseOrder.ID,
      purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
      purchaseRequestID: request.ID,
      supplierID: supplier.ID,
      status: "CREATED",
      totalAmount,
      currency,
    };
  }

  private async sendPurchaseOrder(req: Request) {
    assertCanSendPurchaseOrder(req);

    const purchaseOrder = await this.loadPurchaseOrder(
      boundId(req, "PurchaseOrders"),
    );
    const payload = await this.sendPayload(purchaseOrder);

    if (!["CREATED", "SENT"].includes(purchaseOrder.status)) {
      httpError(
        400,
        `Purchase order ${purchaseOrder.purchaseOrderNumber} cannot be sent from status ${purchaseOrder.status}`,
      );
    }

    const supplierExisting = await findSuccessMessage(
      purchaseOrder.ID,
      MESSAGE_TYPES.SEND_PURCHASE_ORDER_SUPPLIER,
    );
    const erpExisting = await findSuccessMessage(
      purchaseOrder.ID,
      MESSAGE_TYPES.SEND_PURCHASE_ORDER_ERP,
    );

    if (supplierExisting && erpExisting) {
      httpError(
        400,
        `Purchase order ${purchaseOrder.purchaseOrderNumber} was already sent to supplier and ERP`,
      );
    }

    const supplier = supplierExisting
      ? callResult(
          supplierExisting.messageId,
          "SUCCESS",
          parseJson<SupplierOrderResponse>(supplierExisting.responsePayload)
            ?.externalOrderId ??
            purchaseOrder.externalOrderId ??
            "",
          "",
          true,
        )
      : await this.dispatchSupplierSend(purchaseOrder, payload);

    const erp = erpExisting
      ? callResult(
          erpExisting.messageId,
          "SUCCESS",
          parseJson<ErpPurchaseOrderResponse>(erpExisting.responsePayload)
            ?.erpPurchaseOrderId ?? "",
          "",
          true,
        )
      : await this.dispatchErpSend(purchaseOrder, payload);

    const updated = await this.loadPurchaseOrder(purchaseOrder.ID);

    return {
      ID: updated.ID,
      purchaseOrderNumber: updated.purchaseOrderNumber,
      status: updated.status,
      externalOrderId: updated.externalOrderId ?? "",
      supplier,
      erp,
    };
  }

  private async confirmPurchaseOrder(req: Request) {
    assertCanSendPurchaseOrder(req);

    const purchaseOrder = await this.loadPurchaseOrder(
      boundId(req, "PurchaseOrders"),
    );

    if (!["SENT", "CONFIRMED"].includes(purchaseOrder.status)) {
      httpError(
        400,
        `Purchase order ${purchaseOrder.purchaseOrderNumber} cannot be confirmed from status ${purchaseOrder.status}`,
      );
    }

    if (!purchaseOrder.externalOrderId) {
      httpError(
        400,
        `Purchase order ${purchaseOrder.purchaseOrderNumber} has not been sent to the supplier`,
      );
    }

    const payload: ConfirmPurchaseOrderPayload = {
      purchaseOrderId: purchaseOrder.ID,
      externalOrderId: purchaseOrder.externalOrderId,
    };

    const outbound = await runOutbound<SupplierOrderResponse>({
      messageType: MESSAGE_TYPES.CONFIRM_PURCHASE_ORDER_SUPPLIER,
      destinationSystem: "SUPPLIER",
      businessEntityType: "PurchaseOrder",
      businessEntityId: purchaseOrder.ID,
      payload,
      send: () => confirmSupplierOrder(payload.externalOrderId),
    });

    let confirmedAt = "";
    if (outbound.status === "SUCCESS") {
      confirmedAt = outbound.result?.confirmedAt || new Date().toISOString();
      await UPDATE(this.entities.PurchaseOrders)
        .set({
          status: "CONFIRMED",
          confirmedAt,
        })
        .where({ ID: purchaseOrder.ID });
    }

    const updated = await this.loadPurchaseOrder(purchaseOrder.ID);

    return {
      ID: updated.ID,
      purchaseOrderNumber: updated.purchaseOrderNumber,
      status: updated.status,
      externalOrderId: updated.externalOrderId ?? "",
      confirmedAt,
      integration: callResult(
        outbound.messageId,
        outbound.status,
        outbound.result?.externalOrderId ?? updated.externalOrderId ?? "",
        outbound.errorMessage ?? "",
      ),
    };
  }

  private async receiveGoods(req: Request) {
    assertCanSendPurchaseOrder(req);

    const purchaseOrder = await this.loadPurchaseOrder(
      boundId(req, "PurchaseOrders"),
    );
    const quantityReceived = Number(
      actionParam(req, ["quantityReceived", "quantity"]),
    );
    const notes = actionParam(req, ["notes"]);

    if (!["SENT", "CONFIRMED", "PARTIALLY_RECEIVED"].includes(purchaseOrder.status)) {
      httpError(
        400,
        `Goods cannot be received for purchase order ${purchaseOrder.purchaseOrderNumber} in status ${purchaseOrder.status}`,
      );
    }

    if (!Number.isFinite(quantityReceived) || quantityReceived <= 0) {
      httpError(400, "quantityReceived must be greater than zero");
    }

    const erpSend = await findSuccessMessage(
      purchaseOrder.ID,
      MESSAGE_TYPES.SEND_PURCHASE_ORDER_ERP,
    );
    const erpPurchaseOrderId = parseJson<ErpPurchaseOrderResponse>(
      erpSend?.responsePayload,
    )?.erpPurchaseOrderId;

    if (!erpPurchaseOrderId) {
      httpError(
        400,
        `Purchase order ${purchaseOrder.purchaseOrderNumber} has not been sent to ERP`,
      );
    }

    const payload: ReceiveGoodsPayload = {
      purchaseOrderId: purchaseOrder.ID,
      erpPurchaseOrderId,
      quantityReceived,
      notes: notes || undefined,
    };

    const outbound = await runOutbound<ErpGoodsReceiptResponse>({
      messageType: MESSAGE_TYPES.RECEIVE_GOODS_ERP,
      destinationSystem: "ERP",
      businessEntityType: "PurchaseOrder",
      businessEntityId: purchaseOrder.ID,
      payload,
      send: () => sendErpGoodsReceipt(payload),
    });

    let goodsReceiptNumber = "";
    if (outbound.status === "SUCCESS" && outbound.result) {
      goodsReceiptNumber = await this.nextDocumentNumber(
        this.entities.GoodsReceipts,
        "goodsReceiptNumber",
        `GR-${new Date().getFullYear()}-`,
      );
      const poStatus =
        outbound.result.purchaseOrderStatus === "RECEIVED"
          ? "RECEIVED"
          : "PARTIALLY_RECEIVED";

      await INSERT.into(this.entities.GoodsReceipts).entries({
        goodsReceiptNumber,
        purchaseOrder_ID: purchaseOrder.ID,
        receivedDate: new Date().toISOString().slice(0, 10),
        status: poStatus === "RECEIVED" ? "COMPLETE" : "PARTIAL",
        notes: notes || undefined,
      });

      await UPDATE(this.entities.PurchaseOrders)
        .set({ status: poStatus })
        .where({ ID: purchaseOrder.ID });
    }

    const updated = await this.loadPurchaseOrder(purchaseOrder.ID);

    return {
      ID: updated.ID,
      purchaseOrderNumber: updated.purchaseOrderNumber,
      status: updated.status,
      goodsReceiptNumber,
      quantityReceived,
      integration: callResult(
        outbound.messageId,
        outbound.status,
        outbound.result?.goodsReceiptId ?? "",
        outbound.errorMessage ?? "",
      ),
    };
  }

  private async receiveInvoice(req: Request) {
    assertCanReceiveInvoice(req);

    const { PurchaseOrders, Invoices, Suppliers } = this.entities;
    const purchaseOrder = await this.loadPurchaseOrder(
      boundId(req, "PurchaseOrders"),
    );

    if (["DRAFT", "CREATED", "CANCELLED"].includes(purchaseOrder.status)) {
      httpError(
        400,
        `Invoice cannot be received for purchase order ${purchaseOrder.purchaseOrderNumber} in status ${purchaseOrder.status}`,
      );
    }

    const existingInvoice = (await SELECT.one.from(Invoices).where({
      purchaseOrder_ID: purchaseOrder.ID,
    })) as InvoiceRow | null;

    if (existingInvoice) {
      httpError(
        400,
        `Purchase order ${purchaseOrder.purchaseOrderNumber} already has invoice ${existingInvoice.invoiceNumber}`,
      );
    }

    const supplier = (await SELECT.one
      .from(Suppliers)
      .where({ ID: purchaseOrder.supplier_ID })) as SupplierRow | null;

    if (!supplier) {
      httpError(404, "Supplier not found");
    }

    const invoiceNumber = await this.nextDocumentNumber(
      Invoices,
      "invoiceNumber",
      `INV-${new Date().getFullYear()}-`,
    );
    const amount = asMoney(Number(purchaseOrder.totalAmount || 0));
    const currency = purchaseOrder.currency ?? "USD";
    const receivedAt = new Date().toISOString();

    await INSERT.into(Invoices).entries({
      invoiceNumber,
      purchaseOrder_ID: purchaseOrder.ID,
      supplier_ID: supplier.ID,
      amount,
      currency,
      status: "RECEIVED",
      invoiceDate: receivedAt.slice(0, 10),
      receivedAt,
    });

    const invoice = (await SELECT.one
      .from(Invoices)
      .where({ invoiceNumber })) as InvoiceRow | null;

    if (!invoice) {
      httpError(500, "Invoice was not created");
    }

    const payload: SendInvoicePayload = {
      invoiceId: invoice.ID,
      invoiceNumber,
      purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
      supplierId: supplier.supplierNumber,
      amount,
      currency,
    };

    const outbound = await runOutbound<AccountingInvoiceResponse>({
      messageType: MESSAGE_TYPES.SEND_INVOICE_ACCOUNTING,
      destinationSystem: "ACCOUNTING",
      businessEntityType: "Invoice",
      businessEntityId: invoice.ID,
      payload,
      send: () => sendAccountingInvoice(payload),
    });

    if (outbound.status === "SUCCESS" && outbound.result?.externalInvoiceId) {
      await UPDATE(Invoices)
        .set({ externalInvoiceId: outbound.result.externalInvoiceId })
        .where({ ID: invoice.ID });
    }

    const updated = (await SELECT.one
      .from(Invoices)
      .where({ ID: invoice.ID })) as InvoiceRow;

    return {
      ID: updated.ID,
      invoiceNumber: updated.invoiceNumber,
      purchaseOrderID: purchaseOrder.ID,
      status: updated.status,
      amount,
      externalInvoiceId: updated.externalInvoiceId ?? "",
      integration: callResult(
        outbound.messageId,
        outbound.status,
        outbound.result?.externalInvoiceId ?? "",
        outbound.errorMessage ?? "",
      ),
    };
  }

  private async retryIntegrationMessage(req: Request) {
    assertCanRetry(req);

    const message = await getIntegrationMessage(
      boundId(req, "IntegrationMessages"),
    );

    if (!message) {
      httpError(404, "Integration message not found");
    }

    if (!["FAILED", "RETRYING"].includes(message.status)) {
      httpError(
        400,
        `Integration message ${message.messageId} cannot be retried from status ${message.status}`,
      );
    }

    if (maxAttemptsReached(message.attempts)) {
      httpError(
        400,
        `Integration message ${message.messageId} has reached the maximum of ${integrationConfig().maxAttempts} attempts`,
      );
    }

    const outbound = await this.replayMessage(message);
    const updated = await getIntegrationMessage(message.ID);

    return {
      ID: message.ID,
      messageId: message.messageId,
      messageType: message.messageType,
      status: updated?.status ?? outbound.status,
      attempts: updated?.attempts ?? outbound.attempts,
      errorMessage: updated?.errorMessage ?? outbound.errorMessage ?? "",
      responsePayload: updated?.responsePayload ?? outbound.responsePayload ?? "",
    };
  }

  private async replayMessage(message: IntegrationMessageRow) {
    switch (message.messageType) {
      case MESSAGE_TYPES.SEND_PURCHASE_ORDER_SUPPLIER: {
        const payload = parseJson<SendPurchaseOrderPayload>(message.payload);
        if (!payload) httpError(400, "Stored supplier payload is invalid");
        const outbound = await runOutbound<SupplierOrderResponse>({
          existing: message,
          messageType: message.messageType,
          destinationSystem: "SUPPLIER",
          businessEntityType: "PurchaseOrder",
          businessEntityId: payload.purchaseOrderId,
          payload,
          send: () => sendSupplierOrder(payload),
        });
        if (outbound.status === "SUCCESS") {
          await this.applySupplierSendSuccess(
            payload.purchaseOrderId,
            outbound.result,
          );
        }
        return outbound;
      }
      case MESSAGE_TYPES.SEND_PURCHASE_ORDER_ERP: {
        const payload = parseJson<SendPurchaseOrderPayload>(message.payload);
        if (!payload) httpError(400, "Stored ERP payload is invalid");
        return runOutbound<ErpPurchaseOrderResponse>({
          existing: message,
          messageType: message.messageType,
          destinationSystem: "ERP",
          businessEntityType: "PurchaseOrder",
          businessEntityId: payload.purchaseOrderId,
          payload,
          send: () => sendErpPurchaseOrder(payload),
        });
      }
      case MESSAGE_TYPES.CONFIRM_PURCHASE_ORDER_SUPPLIER: {
        const payload = parseJson<ConfirmPurchaseOrderPayload>(message.payload);
        if (!payload) httpError(400, "Stored confirm payload is invalid");
        const outbound = await runOutbound<SupplierOrderResponse>({
          existing: message,
          messageType: message.messageType,
          destinationSystem: "SUPPLIER",
          businessEntityType: "PurchaseOrder",
          businessEntityId: payload.purchaseOrderId,
          payload,
          send: () => confirmSupplierOrder(payload.externalOrderId),
        });
        if (outbound.status === "SUCCESS") {
          await UPDATE(this.entities.PurchaseOrders)
            .set({
              status: "CONFIRMED",
              confirmedAt:
                outbound.result?.confirmedAt || new Date().toISOString(),
            })
            .where({ ID: payload.purchaseOrderId });
        }
        return outbound;
      }
      case MESSAGE_TYPES.RECEIVE_GOODS_ERP: {
        const payload = parseJson<ReceiveGoodsPayload>(message.payload);
        if (!payload) httpError(400, "Stored goods-receipt payload is invalid");
        const outbound = await runOutbound<ErpGoodsReceiptResponse>({
          existing: message,
          messageType: message.messageType,
          destinationSystem: "ERP",
          businessEntityType: "PurchaseOrder",
          businessEntityId: payload.purchaseOrderId,
          payload,
          send: () => sendErpGoodsReceipt(payload),
        });
        if (outbound.status === "SUCCESS" && outbound.result) {
          const goodsReceiptNumber = await this.nextDocumentNumber(
            this.entities.GoodsReceipts,
            "goodsReceiptNumber",
            `GR-${new Date().getFullYear()}-`,
          );
          const poStatus =
            outbound.result.purchaseOrderStatus === "RECEIVED"
              ? "RECEIVED"
              : "PARTIALLY_RECEIVED";
          await INSERT.into(this.entities.GoodsReceipts).entries({
            goodsReceiptNumber,
            purchaseOrder_ID: payload.purchaseOrderId,
            receivedDate: new Date().toISOString().slice(0, 10),
            status: poStatus === "RECEIVED" ? "COMPLETE" : "PARTIAL",
            notes: payload.notes,
          });
          await UPDATE(this.entities.PurchaseOrders)
            .set({ status: poStatus })
            .where({ ID: payload.purchaseOrderId });
        }
        return outbound;
      }
      case MESSAGE_TYPES.SEND_INVOICE_ACCOUNTING: {
        const payload = parseJson<SendInvoicePayload>(message.payload);
        if (!payload) httpError(400, "Stored invoice payload is invalid");
        const outbound = await runOutbound<AccountingInvoiceResponse>({
          existing: message,
          messageType: message.messageType,
          destinationSystem: "ACCOUNTING",
          businessEntityType: "Invoice",
          businessEntityId: payload.invoiceId,
          payload,
          send: () => sendAccountingInvoice(payload),
        });
        if (outbound.status === "SUCCESS" && outbound.result?.externalInvoiceId) {
          await UPDATE(this.entities.Invoices)
            .set({ externalInvoiceId: outbound.result.externalInvoiceId })
            .where({ ID: payload.invoiceId });
        }
        return outbound;
      }
      default:
        httpError(
          400,
          `Integration message type ${message.messageType} cannot be retried`,
        );
    }
  }

  private async dispatchSupplierSend(
    purchaseOrder: PurchaseOrderRow,
    payload: SendPurchaseOrderPayload,
  ) {
    const outbound = await runOutbound<SupplierOrderResponse>({
      messageType: MESSAGE_TYPES.SEND_PURCHASE_ORDER_SUPPLIER,
      destinationSystem: "SUPPLIER",
      businessEntityType: "PurchaseOrder",
      businessEntityId: purchaseOrder.ID,
      payload,
      send: () => sendSupplierOrder(payload),
    });

    if (outbound.status === "SUCCESS") {
      await this.applySupplierSendSuccess(purchaseOrder.ID, outbound.result);
    }

    return callResult(
      outbound.messageId,
      outbound.status,
      outbound.result?.externalOrderId ?? "",
      outbound.errorMessage ?? "",
    );
  }

  private async dispatchErpSend(
    purchaseOrder: PurchaseOrderRow,
    payload: SendPurchaseOrderPayload,
  ) {
    const outbound = await runOutbound<ErpPurchaseOrderResponse>({
      messageType: MESSAGE_TYPES.SEND_PURCHASE_ORDER_ERP,
      destinationSystem: "ERP",
      businessEntityType: "PurchaseOrder",
      businessEntityId: purchaseOrder.ID,
      payload,
      send: () => sendErpPurchaseOrder(payload),
    });

    return callResult(
      outbound.messageId,
      outbound.status,
      outbound.result?.erpPurchaseOrderId ?? "",
      outbound.errorMessage ?? "",
    );
  }

  private async applySupplierSendSuccess(
    purchaseOrderId: string,
    result?: SupplierOrderResponse,
  ) {
    await UPDATE(this.entities.PurchaseOrders)
      .set({
        status: "SENT",
        externalOrderId: result?.externalOrderId,
        sentAt: new Date().toISOString(),
      })
      .where({ ID: purchaseOrderId });
  }

  private async sendPayload(
    purchaseOrder: PurchaseOrderRow,
  ): Promise<SendPurchaseOrderPayload> {
    const { PurchaseOrderItems, Suppliers } = this.entities;
    const supplier = (await SELECT.one
      .from(Suppliers)
      .where({ ID: purchaseOrder.supplier_ID })) as SupplierRow | null;

    if (!supplier) {
      httpError(404, "Supplier not found");
    }

    const items = (await SELECT.from(PurchaseOrderItems).where({
      purchaseOrder_ID: purchaseOrder.ID,
    })) as PurchaseOrderItemRow[];

    if (!items.length) {
      httpError(400, "A purchase order cannot be sent without items");
    }

    const payloadItems: OrderItemPayload[] = items.map((item) => ({
      description: item.description,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
    }));

    return {
      purchaseOrderId: purchaseOrder.ID,
      purchaseOrderNumber: purchaseOrder.purchaseOrderNumber,
      supplierId: supplier.supplierNumber,
      items: payloadItems,
    };
  }

  private async loadPurchaseOrder(ID: string): Promise<PurchaseOrderRow> {
    const purchaseOrder = (await SELECT.one
      .from(this.entities.PurchaseOrders)
      .where({ ID })) as PurchaseOrderRow | null;

    if (!purchaseOrder) {
      httpError(404, "Purchase order not found");
    }

    return purchaseOrder;
  }

  private async nextPurchaseOrderNumber(
    PurchaseOrders: unknown,
  ): Promise<string> {
    return this.nextDocumentNumber(
      PurchaseOrders,
      "purchaseOrderNumber",
      `PO-${new Date().getFullYear()}-`,
    );
  }

  private async nextDocumentNumber(
    entity: unknown,
    column: string,
    prefix: string,
  ): Promise<string> {
    const last = (await SELECT.one
      .from(entity as string)
      .columns(column)
      .where({ [column]: { like: `${prefix}%` } })
      .orderBy(`${column} desc`)) as Record<string, string> | null;

    return nextNumber(prefix, last?.[column]);
  }

  private async findApprover(
    departmentId?: string,
    requesterId?: string,
  ): Promise<EmployeeRow | null> {
    const { Employees } = this.entities;

    if (departmentId) {
      const departmentManager = (await SELECT.one.from(Employees).where({
        department_ID: departmentId,
        role: "MANAGER",
        ...(requesterId ? { ID: { "!=": requesterId } } : {}),
      })) as EmployeeRow | null;

      if (departmentManager) return departmentManager;
    }

    return (await SELECT.one
      .from(Employees)
      .where({ role: "MANAGER" })) as EmployeeRow | null;
  }
}