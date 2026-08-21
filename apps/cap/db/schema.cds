namespace epp;

using { cuid, managed } from '@sap/cds/common';

type UserRole : String enum {
  EMPLOYEE;
  MANAGER;
  PROCUREMENT;
  FINANCE;
  ADMIN;
}

type SupplierStatus : String enum {
  ACTIVE;
  INACTIVE;
  BLOCKED;
}

type PurchaseRequestStatus : String enum {
  DRAFT;
  SUBMITTED;
  PENDING_APPROVAL;
  APPROVED;
  REJECTED;
  ORDER_CREATED;
}

type ApprovalStatus : String enum {
  PENDING;
  APPROVED;
  REJECTED;
}

type PurchaseOrderStatus : String enum {
  DRAFT;
  CREATED;
  SENT;
  CONFIRMED;
  PARTIALLY_RECEIVED;
  RECEIVED;
  CANCELLED;
}

type GoodsReceiptStatus : String enum {
  PARTIAL;
  COMPLETE;
}

type InvoiceStatus : String enum {
  RECEIVED;
  PENDING_APPROVAL;
  APPROVED;
  REJECTED;
  PROCESSED;
}

type IntegrationMessageStatus : String enum {
  PENDING;
  PROCESSING;
  SUCCESS;
  FAILED;
  RETRYING;
}

type MoneyAmount  : Decimal(15, 2);
type Quantity     : Integer;
type CurrencyCode : String(3);

@assert.unique.name: [name]
entity Departments : cuid, managed {
  name       : String(100) @mandatory;
  costCenter : String(50);
  employees  : Association to many Employees
                 on employees.department = $self;
}

@assert.unique.email: [email]
entity Employees : cuid, managed {
  firstName  : String(100) @mandatory;
  lastName   : String(100) @mandatory;
  email      : String(255) @mandatory;
  role       : UserRole default 'EMPLOYEE';
  department : Association to Departments;
}

@assert.unique.supplierNumber: [supplierNumber]
entity Suppliers : cuid, managed {
  supplierNumber     : String(32) @mandatory;
  name               : String(255) @mandatory;
  email              : String(255);
  phone              : String(50);
  address            : String(500);
  country            : String(100);
  status             : SupplierStatus default 'ACTIVE';
  externalSupplierId : String(64);
}

@assert.unique.requestNumber: [requestNumber]
entity PurchaseRequests : cuid, managed {
  requestNumber : String(32) @mandatory;
  title         : String(255) @mandatory;
  description   : String(5000);
  status        : PurchaseRequestStatus default 'DRAFT';
  totalAmount   : MoneyAmount default 0;
  currency      : CurrencyCode default 'USD';
  requester     : Association to Employees;
  department    : Association to Departments;
  submittedAt   : Timestamp;
  approvedAt    : Timestamp;
  rejectedAt    : Timestamp;
  items         : Composition of many PurchaseRequestItems
                    on items.purchaseRequest = $self;
  approvals     : Composition of many Approvals
                    on approvals.purchaseRequest = $self;
}

entity PurchaseRequestItems : cuid {
  purchaseRequest : Association to PurchaseRequests @mandatory;
  description     : String(500) @mandatory;
  quantity        : Quantity @mandatory;
  unitPrice       : MoneyAmount @mandatory;
  totalPrice      : MoneyAmount default 0;
  currency        : CurrencyCode default 'USD';
}

entity Approvals : cuid {
  purchaseRequest : Association to PurchaseRequests @mandatory;
  approver        : Association to Employees;
  status          : ApprovalStatus default 'PENDING';
  comment         : String(2000);
  approvedAt      : Timestamp;
  createdAt       : Timestamp @cds.on.insert: $now;
}

@assert.unique.purchaseOrderNumber: [purchaseOrderNumber]
entity PurchaseOrders : cuid, managed {
  purchaseOrderNumber : String(32) @mandatory;
  purchaseRequest     : Association to PurchaseRequests;
  supplier            : Association to Suppliers;
  status              : PurchaseOrderStatus default 'DRAFT';
  totalAmount         : MoneyAmount default 0;
  currency            : CurrencyCode default 'USD';
  externalOrderId     : String(64);
  sentAt              : Timestamp;
  confirmedAt         : Timestamp;
  items               : Composition of many PurchaseOrderItems
                          on items.purchaseOrder = $self;
  goodsReceipts       : Composition of many GoodsReceipts
                          on goodsReceipts.purchaseOrder = $self;
}

entity PurchaseOrderItems : cuid {
  purchaseOrder : Association to PurchaseOrders @mandatory;
  description   : String(500) @mandatory;
  quantity      : Quantity @mandatory;
  unitPrice     : MoneyAmount @mandatory;
  totalPrice    : MoneyAmount default 0;
  currency      : CurrencyCode default 'USD';
}

@assert.unique.goodsReceiptNumber: [goodsReceiptNumber]
entity GoodsReceipts : cuid {
  goodsReceiptNumber : String(32) @mandatory;
  purchaseOrder      : Association to PurchaseOrders @mandatory;
  receivedBy         : Association to Employees;
  receivedDate       : Date;
  status             : GoodsReceiptStatus default 'PARTIAL';
  notes              : String(5000);
}

@assert.unique.invoiceNumber: [invoiceNumber]
entity Invoices : cuid {
  invoiceNumber     : String(32) @mandatory;
  purchaseOrder     : Association to PurchaseOrders;
  supplier          : Association to Suppliers;
  amount            : MoneyAmount default 0;
  currency          : CurrencyCode default 'USD';
  status            : InvoiceStatus default 'RECEIVED';
  externalInvoiceId : String(64);
  invoiceDate       : Date;
  receivedAt        : Timestamp;
  approvedAt        : Timestamp;
}

@assert.unique.messageId: [messageId]
entity IntegrationMessages : cuid {
  messageId          : String(64) @mandatory;
  messageType        : String(100) @mandatory;
  sourceSystem       : String(100) @mandatory;
  destinationSystem  : String(100) @mandatory;
  businessEntityType : String(100);
  businessEntityId   : UUID;
  status             : IntegrationMessageStatus default 'PENDING';
  attempts           : Integer default 0;
  payload            : LargeString;
  responsePayload    : LargeString;
  errorMessage       : LargeString;
  createdAt          : Timestamp @cds.on.insert: $now;
  processedAt        : Timestamp;
}