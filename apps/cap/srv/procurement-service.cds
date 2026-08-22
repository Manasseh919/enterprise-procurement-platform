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

  entity Departments           as projection on db.Departments;
  entity Employees             as projection on db.Employees;
  entity Suppliers             as projection on db.Suppliers;

  entity PurchaseRequests      as projection on db.PurchaseRequests actions {
    action submitPurchaseRequest() returns SubmitPurchaseRequestResponse;
  };

  entity PurchaseRequestItems  as projection on db.PurchaseRequestItems;
  entity Approvals             as projection on db.Approvals;
  entity PurchaseOrders        as projection on db.PurchaseOrders;
  entity PurchaseOrderItems    as projection on db.PurchaseOrderItems;
  entity GoodsReceipts         as projection on db.GoodsReceipts;
  entity Invoices              as projection on db.Invoices;
  entity IntegrationMessages   as projection on db.IntegrationMessages;
}