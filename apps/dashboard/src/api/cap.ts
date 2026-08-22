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
  createdAt?: string;
};

export type IntegrationMessage = {
  ID: string;
  messageId: string;
  messageType: string;
  sourceSystem: string;
  destinationSystem: string;
  businessEntityType?: string;
  businessEntityId?: string;
  status: string;
  attempts: number;
  payload?: string | null;
  responsePayload?: string | null;
  errorMessage?: string | null;
  createdAt?: string;
  processedAt?: string | null;
};

export type RetryIntegrationMessageResponse = {
  ID: string;
  messageId: string;
  messageType: string;
  status: string;
  attempts: number;
  errorMessage?: string;
  responsePayload?: string;
};

export const PURCHASE_ORDER_STATUSES = [
  "DRAFT",
  "CREATED",
  "SENT",
  "CONFIRMED",
  "PARTIALLY_RECEIVED",
  "RECEIVED",
  "CANCELLED",
] as const;

export const INTEGRATION_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SUCCESS",
  "FAILED",
  "RETRYING",
] as const;

export type PurchaseOrderStatus = (typeof PURCHASE_ORDER_STATUSES)[number];

export type IntegrationMessageFilters = {
  status?: string;
  destinationSystem?: string;
  search?: string;
};

type ODataList<T> = {
  value: T[];
  "@odata.count"?: number;
};

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `CAP request failed (${response.status}) for ${path}${detail ? `: ${detail}` : ""}`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function getCount(entity: string, filter?: string): Promise<number> {
  const query = filter ? `?$filter=${encodeURIComponent(filter)}` : "";
  const response = await fetch(
    `${baseUrl}/odata/v4/procurement/${entity}/$count${query}`,
    { headers: { Accept: "text/plain" } },
  );

  if (!response.ok) {
    throw new Error(`CAP count failed (${response.status}) for ${entity}`);
  }

  return Number(await response.text());
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

function startOfCurrentMonthIso(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

export type DashboardSnapshot = {
  totalPurchaseRequests: number;
  pendingApprovals: number;
  openPurchaseOrders: number;
  monthlySpend: number;
  monthlySpendCurrency: string;
  ordersByStatus: Record<string, number>;
  integration: {
    total: number;
    success: number;
    failed: number;
    retrying: number;
    pending: number;
  };
  recentFailures: IntegrationMessage[];
};

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const monthStart = startOfCurrentMonthIso();

  const [
    totalPurchaseRequests,
    pendingApprovals,
    openPurchaseOrders,
    orders,
    monthlyOrders,
    integrationTotal,
    integrationSuccess,
    integrationFailed,
    integrationRetrying,
    integrationPending,
    failures,
  ] = await Promise.all([
    getCount("PurchaseRequests"),
    getCount("PurchaseRequests", "status eq 'PENDING_APPROVAL'"),
    getCount(
      "PurchaseOrders",
      "status ne 'RECEIVED' and status ne 'CANCELLED'",
    ),
    getJson<ODataList<PurchaseOrder>>(
      `/odata/v4/procurement/PurchaseOrders?$select=status,totalAmount,currency,createdAt&$top=1000`,
    ),
    getJson<ODataList<PurchaseOrder>>(
      `/odata/v4/procurement/PurchaseOrders?$filter=${encodeURIComponent(
        `createdAt ge ${monthStart}`,
      )}&$select=totalAmount,currency&$top=1000`,
    ),
    getCount("IntegrationMessages"),
    getCount("IntegrationMessages", "status eq 'SUCCESS'"),
    getCount("IntegrationMessages", "status eq 'FAILED'"),
    getCount("IntegrationMessages", "status eq 'RETRYING'"),
    getCount(
      "IntegrationMessages",
      "status eq 'PENDING' or status eq 'PROCESSING'",
    ),
    getJson<ODataList<IntegrationMessage>>(
      `/odata/v4/procurement/IntegrationMessages?$filter=${encodeURIComponent(
        "status eq 'FAILED'",
      )}&$select=ID,messageId,messageType,sourceSystem,destinationSystem,businessEntityType,status,attempts,errorMessage,createdAt,processedAt&$orderby=createdAt desc&$top=5`,
    ),
  ]);

  const ordersByStatus: Record<string, number> = {};
  for (const status of PURCHASE_ORDER_STATUSES) {
    ordersByStatus[status] = 0;
  }
  for (const order of orders.value) {
    ordersByStatus[order.status] = (ordersByStatus[order.status] ?? 0) + 1;
  }

  const monthlySpend = monthlyOrders.value.reduce(
    (sum, order) => sum + Number(order.totalAmount || 0),
    0,
  );

  return {
    totalPurchaseRequests,
    pendingApprovals,
    openPurchaseOrders,
    monthlySpend,
    monthlySpendCurrency: monthlyOrders.value[0]?.currency ?? "USD",
    ordersByStatus,
    integration: {
      total: integrationTotal,
      success: integrationSuccess,
      failed: integrationFailed,
      retrying: integrationRetrying,
      pending: integrationPending,
    },
    recentFailures: failures.value,
  };
}

function integrationFilter(filters: IntegrationMessageFilters): string {
  const parts: string[] = [];

  if (filters.status) {
    parts.push(`status eq '${filters.status.replaceAll("'", "''")}'`);
  }
  if (filters.destinationSystem) {
    parts.push(
      `destinationSystem eq '${filters.destinationSystem.replaceAll("'", "''")}'`,
    );
  }
  if (filters.search?.trim()) {
    const term = filters.search.trim().replaceAll("'", "''");
    parts.push(
      `(contains(messageId,'${term}') or contains(messageType,'${term}') or contains(errorMessage,'${term}'))`,
    );
  }

  return parts.join(" and ");
}

const MESSAGE_SELECT =
  "ID,messageId,messageType,sourceSystem,destinationSystem,businessEntityType,businessEntityId,status,attempts,payload,responsePayload,errorMessage,createdAt,processedAt";

export async function getIntegrationMessages(
  filters: IntegrationMessageFilters = {},
) {
  const filter = integrationFilter(filters);
  const query = [
    "$count=true",
    `$select=${MESSAGE_SELECT}`,
    "$orderby=createdAt desc",
    "$top=100",
    filter ? `$filter=${encodeURIComponent(filter)}` : "",
  ]
    .filter(Boolean)
    .join("&");

  return getJson<ODataList<IntegrationMessage>>(
    `/odata/v4/procurement/IntegrationMessages?${query}`,
  );
}

export async function getIntegrationMessage(id: string) {
  return getJson<IntegrationMessage>(
    `/odata/v4/procurement/IntegrationMessages(${id})?$select=${MESSAGE_SELECT}`,
  );
}

export async function retryIntegrationMessage(id: string) {
  return getJson<RetryIntegrationMessageResponse>(
    `/odata/v4/procurement/IntegrationMessages(${id})/retryIntegrationMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    },
  );
}

export function canRetry(status: string): boolean {
  return status === "FAILED" || status === "RETRYING";
}