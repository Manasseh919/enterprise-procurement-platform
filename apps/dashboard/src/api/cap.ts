const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

export type PurchaseRequest = {
  ID: string;
  requestNumber: string;
  title: string;
  status: string;
  totalAmount: number;
  currency: string;
};

export type PurchaseOrder = {
  ID: string;
  purchaseOrderNumber: string;
  status: string;
  totalAmount: number;
  currency: string;
};

type ODataList<T> = {
  value: T[];
  "@odata.count"?: number;
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`CAP request failed (${response.status}) for ${path}`);
  }

  return response.json() as Promise<T>;
}

export async function getPurchaseRequests(top = 10) {
  return getJson<ODataList<PurchaseRequest>>(
    `/odata/v4/procurement/PurchaseRequests?$count=true&$top=${top}&$select=ID,requestNumber,title,status,totalAmount,currency&$orderby=requestNumber desc`,
  );
}

export async function getPurchaseOrders(top = 10) {
  return getJson<ODataList<PurchaseOrder>>(
    `/odata/v4/procurement/PurchaseOrders?$count=true&$top=${top}&$select=ID,purchaseOrderNumber,status,totalAmount,currency&$orderby=purchaseOrderNumber desc`,
  );
}