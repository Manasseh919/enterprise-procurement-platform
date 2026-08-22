using { ProcurementService } from './procurement-service';

annotate ProcurementService.PurchaseRequests with @cds.search: {
  requestNumber, title, description
};

annotate ProcurementService.PurchaseRequests with @(
  UI.CreateHidden : true,
  UI.DeleteHidden : true,
  UI.UpdateHidden : true,

  UI.HeaderInfo : {
    TypeName       : 'Purchase Request',
    TypeNamePlural : 'Purchase Requests',
    Title          : { Value: title },
    Description    : { Value: requestNumber }
  },

  UI.SelectionFields : [
    status,
    department_ID,
    requester_ID
  ],

  UI.LineItem : [
    {
      $Type  : 'UI.DataFieldForAction',
      Label  : 'Submit',
      Action : 'ProcurementService.submitPurchaseRequest'
    },
    {
      $Type  : 'UI.DataFieldForAction',
      Label  : 'Approve',
      Action : 'ProcurementService.approvePurchaseRequest'
    },
    {
      $Type  : 'UI.DataFieldForAction',
      Label  : 'Reject',
      Action : 'ProcurementService.rejectPurchaseRequest'
    },
    {
      $Type  : 'UI.DataFieldForAction',
      Label  : 'Create Purchase Order',
      Action : 'ProcurementService.createPurchaseOrder'
    },
    { $Type: 'UI.DataField', Value: requestNumber, Label: 'Request Number' },
    { $Type: 'UI.DataField', Value: title, Label: 'Title' },
    { $Type: 'UI.DataField', Value: status, Label: 'Status' },
    { $Type: 'UI.DataField', Value: department.name, Label: 'Department' },
    { $Type: 'UI.DataField', Value: requester.email, Label: 'Requester' },
    { $Type: 'UI.DataField', Value: totalAmount, Label: 'Total Amount' },
    { $Type: 'UI.DataField', Value: currency, Label: 'Currency' }
  ],

  UI.Identification : [
    {
      $Type       : 'UI.DataFieldForAction',
      Label       : 'Submit',
      Action      : 'ProcurementService.submitPurchaseRequest',
      Determining : true,
      ![@UI.Hidden] : {
        $edmJson : {
          $Ne : [ { $Path : 'status' }, { $String : 'DRAFT' } ]
        }
      }
    },
    {
      $Type       : 'UI.DataFieldForAction',
      Label       : 'Approve',
      Action      : 'ProcurementService.approvePurchaseRequest',
      Determining : true,
      ![@UI.Hidden] : {
        $edmJson : {
          $Ne : [ { $Path : 'status' }, { $String : 'PENDING_APPROVAL' } ]
        }
      }
    },
    {
      $Type       : 'UI.DataFieldForAction',
      Label       : 'Reject',
      Action      : 'ProcurementService.rejectPurchaseRequest',
      Determining : true,
      ![@UI.Hidden] : {
        $edmJson : {
          $Ne : [ { $Path : 'status' }, { $String : 'PENDING_APPROVAL' } ]
        }
      }
    },
    {
      $Type       : 'UI.DataFieldForAction',
      Label       : 'Create Purchase Order',
      Action      : 'ProcurementService.createPurchaseOrder',
      Determining : true,
      ![@UI.Hidden] : {
        $edmJson : {
          $Ne : [ { $Path : 'status' }, { $String : 'APPROVED' } ]
        }
      }
    }
  ],

  UI.PresentationVariant : {
    SortOrder : [
      { Property: requestNumber, Descending: true }
    ]
  },

  UI.FieldGroup #Status : {
    Data : [
      { $Type: 'UI.DataField', Value: status },
      { $Type: 'UI.DataField', Value: totalAmount },
      { $Type: 'UI.DataField', Value: currency }
    ]
  },

  UI.FieldGroup #Details : {
    Data : [
      { $Type: 'UI.DataField', Value: requestNumber },
      { $Type: 'UI.DataField', Value: title },
      { $Type: 'UI.DataField', Value: description },
      { $Type: 'UI.DataField', Value: status },
      { $Type: 'UI.DataField', Value: department.name, Label: 'Department' },
      { $Type: 'UI.DataField', Value: requester.firstName, Label: 'Requester first name' },
      { $Type: 'UI.DataField', Value: requester.lastName, Label: 'Requester last name' },
      { $Type: 'UI.DataField', Value: requester.email, Label: 'Requester email' },
      { $Type: 'UI.DataField', Value: totalAmount },
      { $Type: 'UI.DataField', Value: currency },
      { $Type: 'UI.DataField', Value: submittedAt },
      { $Type: 'UI.DataField', Value: approvedAt },
      { $Type: 'UI.DataField', Value: rejectedAt }
    ]
  },

  UI.HeaderFacets : [
    {
      $Type  : 'UI.ReferenceFacet',
      Label  : 'Status',
      Target : '@UI.FieldGroup#Status'
    }
  ],

  UI.Facets : [
    {
      $Type  : 'UI.ReferenceFacet',
      Label  : 'Request Information',
      ID     : 'RequestInformation',
      Target : '@UI.FieldGroup#Details'
    },
    {
      $Type  : 'UI.ReferenceFacet',
      Label  : 'Items',
      ID     : 'Items',
      Target : 'items/@UI.LineItem'
    },
    {
      $Type  : 'UI.ReferenceFacet',
      Label  : 'Approval History',
      ID     : 'Approvals',
      Target : 'approvals/@UI.LineItem'
    }
  ]
);

annotate ProcurementService.PurchaseRequests with {
  ID            @UI.Hidden;
  requestNumber @title: 'Request Number';
  title         @title: 'Title';
  description   @title: 'Description';
  status        @title: 'Status';
  totalAmount   @title: 'Total Amount';
  currency      @title: 'Currency';
  submittedAt   @title: 'Submitted At';
  approvedAt    @title: 'Approved At';
  rejectedAt    @title: 'Rejected At';
  createdAt     @UI.Hidden;
  createdBy     @UI.Hidden;
  modifiedAt    @UI.Hidden;
  modifiedBy    @UI.Hidden;

  department @(
    title : 'Department',
    Common.Text : department.name,
    Common.TextArrangement : #TextOnly,
    Common.ValueList : {
      $Type : 'Common.ValueListType',
      Label : 'Department',
      CollectionPath : 'Departments',
      Parameters : [
        {
          $Type : 'Common.ValueListParameterInOut',
          LocalDataProperty : department_ID,
          ValueListProperty : 'ID'
        },
        {
          $Type : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty : 'name'
        }
      ]
    }
  );

  requester @(
    title : 'Requester',
    Common.Text : requester.email,
    Common.TextArrangement : #TextOnly,
    Common.ValueList : {
      $Type : 'Common.ValueListType',
      Label : 'Requester',
      CollectionPath : 'Employees',
      Parameters : [
        {
          $Type : 'Common.ValueListParameterInOut',
          LocalDataProperty : requester_ID,
          ValueListProperty : 'ID'
        },
        {
          $Type : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty : 'firstName'
        },
        {
          $Type : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty : 'lastName'
        },
        {
          $Type : 'Common.ValueListParameterDisplayOnly',
          ValueListProperty : 'email'
        }
      ]
    }
  );
};

annotate ProcurementService.PurchaseRequests actions {
  submitPurchaseRequest @(
    Common.SideEffects : {
      TargetProperties : [ 'status', 'totalAmount', 'submittedAt' ],
      TargetEntities   : [ approvals ]
    }
  );

  approvePurchaseRequest @(
    Common.SideEffects : {
      TargetProperties : [ 'status', 'approvedAt' ],
      TargetEntities   : [ approvals ]
    }
  );

  rejectPurchaseRequest @(
    Common.SideEffects : {
      TargetProperties : [ 'status', 'rejectedAt' ],
      TargetEntities   : [ approvals ]
    }
  );

  rejectPurchaseRequest(comment) @(
    title     : 'Rejection comment',
    mandatory : true
  );

  createPurchaseOrder @(
    Common.SideEffects : {
      TargetProperties : [ 'status' ]
    }
  );

  createPurchaseOrder(supplier_ID) @(
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
  );
};

annotate ProcurementService.PurchaseRequestItems with @(
  UI.LineItem : [
    { $Type: 'UI.DataField', Value: description, Label: 'Description' },
    { $Type: 'UI.DataField', Value: quantity, Label: 'Quantity' },
    { $Type: 'UI.DataField', Value: unitPrice, Label: 'Unit Price' },
    { $Type: 'UI.DataField', Value: totalPrice, Label: 'Total Price' },
    { $Type: 'UI.DataField', Value: currency, Label: 'Currency' }
  ]
);

annotate ProcurementService.PurchaseRequestItems with {
  ID                 @UI.Hidden;
  purchaseRequest    @UI.Hidden;
  purchaseRequest_ID @UI.Hidden;
};

annotate ProcurementService.Approvals with @(
  UI.LineItem : [
    { $Type: 'UI.DataField', Value: approver.email, Label: 'Approver' },
    { $Type: 'UI.DataField', Value: status, Label: 'Status' },
    { $Type: 'UI.DataField', Value: comment, Label: 'Comment' },
    { $Type: 'UI.DataField', Value: createdAt, Label: 'Created At' },
    { $Type: 'UI.DataField', Value: approvedAt, Label: 'Decided At' }
  ]
);

annotate ProcurementService.Approvals with {
  ID                 @UI.Hidden;
  purchaseRequest    @UI.Hidden;
  purchaseRequest_ID @UI.Hidden;
};

annotate ProcurementService.Departments with {
  ID @UI.Hidden;
};

annotate ProcurementService.Employees with {
  ID @UI.Hidden;
};

annotate ProcurementService.Suppliers with {
  ID             @title: 'Supplier';
  supplierNumber @title: 'Supplier Number';
  name           @title: 'Name';
};