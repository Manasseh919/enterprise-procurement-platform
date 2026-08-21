using { epp as db } from '../db/schema';

@path: 'procurement'
service ProcurementService {
  entity Departments           as projection on db.Departments;
  entity Employees             as projection on db.Employees;
  entity Suppliers             as projection on db.Suppliers;
  entity PurchaseRequests      as projection on db.PurchaseRequests;
  entity PurchaseRequestItems  as projection on db.PurchaseRequestItems;
  entity Approvals             as projection on db.Approvals;
  entity PurchaseOrders        as projection on db.PurchaseOrders;
  entity PurchaseOrderItems    as projection on db.PurchaseOrderItems;
  entity GoodsReceipts         as projection on db.GoodsReceipts;
  entity Invoices              as projection on db.Invoices;
  entity IntegrationMessages   as projection on db.IntegrationMessages;
}