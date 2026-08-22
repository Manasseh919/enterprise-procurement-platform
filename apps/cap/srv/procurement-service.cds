using { epp as db } from '../db/schema';

@path: 'procurement'
service ProcurementService {

  type SubmitPurchaseRequestResponse {
    ID            : UUID;
    requestNumber : String(32);
    status        : String;
    totalAmount   : Decimal(15, 2);
    currency      : String(3);
    submittedAt   : Timestamp;
    approverEmail : String;
  }

  type ApprovalDecisionResponse {
    ID            : UUID;
    requestNumber : String(32);
    status        : String;
    comment       : String;
    decidedAt     : Timestamp;
  }

  type CreatePurchaseOrderResponse {
    ID                  : UUID;
    purchaseOrderNumber : String(32);
    purchaseRequestID   : UUID;
    supplierID          : UUID;
    status              : String;
    totalAmount         : Decimal(15, 2);
    currency            : String(3);
  }

  type IntegrationCallResult {
    messageId    : String;
    status       : String;
    externalId   : String;
    errorMessage : String;
    skipped      : Boolean;
  }

  type SendPurchaseOrderResponse {
    ID                  : UUID;
    purchaseOrderNumber : String(32);
    status              : String;
    externalOrderId     : String;
    supplier            : IntegrationCallResult;
    erp                 : IntegrationCallResult;
  }

  type ConfirmPurchaseOrderResponse {
    ID                  : UUID;
    purchaseOrderNumber : String(32);
    status              : String;
    externalOrderId     : String;
    confirmedAt         : Timestamp;
    integration         : IntegrationCallResult;
  }

  type ReceiveGoodsResponse {
    ID                  : UUID;
    purchaseOrderNumber : String(32);
    status              : String;
    goodsReceiptNumber  : String;
    quantityReceived    : Integer;
    integration         : IntegrationCallResult;
  }

  type ReceiveInvoiceResponse {
    ID                : UUID;
    invoiceNumber     : String;
    purchaseOrderID   : UUID;
    status            : String;
    amount            : Decimal(15, 2);
    externalInvoiceId : String;
    integration       : IntegrationCallResult;
  }

  type RetryIntegrationMessageResponse {
    ID              : UUID;
    messageId       : String;
    messageType     : String;
    status          : String;
    attempts        : Integer;
    errorMessage    : String;
    responsePayload : String;
  }

  entity Departments           as projection on db.Departments;
  entity Employees             as projection on db.Employees;
  entity Suppliers             as projection on db.Suppliers;

  entity PurchaseRequests      as projection on db.PurchaseRequests actions {
    action submitPurchaseRequest() returns SubmitPurchaseRequestResponse;
    action approvePurchaseRequest() returns ApprovalDecisionResponse;
    action rejectPurchaseRequest(
      comment : String @title: 'Rejection comment' @mandatory
    ) returns ApprovalDecisionResponse;
    action createPurchaseOrder(
      supplier_ID : UUID @(
        title : 'Supplier',
        Common.ValueList : {
          $Type : 'Common.ValueListType',
          Label : 'Supplier',
          CollectionPath : 'Suppliers',
          Parameters : [
            {
              $Type : 'Common.ValueListParameterInOut',
              LocalDataProperty : supplier_ID,
              ValueListProperty : 'ID'
            },
            {
              $Type : 'Common.ValueListParameterDisplayOnly',
              ValueListProperty : 'supplierNumber'
            },
            {
              $Type : 'Common.ValueListParameterDisplayOnly',
              ValueListProperty : 'name'
            }
          ]
        }
      )
    ) returns CreatePurchaseOrderResponse;
  };

  entity PurchaseRequestItems  as projection on db.PurchaseRequestItems;
  entity Approvals             as projection on db.Approvals;

  entity PurchaseOrders        as projection on db.PurchaseOrders actions {
    action sendPurchaseOrder() returns SendPurchaseOrderResponse;
    action confirmPurchaseOrder() returns ConfirmPurchaseOrderResponse;
    action receiveGoods(quantityReceived : Integer, notes : String) returns ReceiveGoodsResponse;
    action receiveInvoice() returns ReceiveInvoiceResponse;
  };

  entity PurchaseOrderItems    as projection on db.PurchaseOrderItems;
  entity GoodsReceipts         as projection on db.GoodsReceipts;
  entity Invoices              as projection on db.Invoices;

  entity IntegrationMessages   as projection on db.IntegrationMessages actions {
    action retryIntegrationMessage() returns RetryIntegrationMessageResponse;
  };
}