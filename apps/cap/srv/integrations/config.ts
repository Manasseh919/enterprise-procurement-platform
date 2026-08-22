function envUrl(name: string, fallback = ""): string {
  const value = process.env[name]?.trim();
  return value ? value.replace(/\/$/, "") : fallback;
}

export function integrationConfig() {
  const timeoutMs = Number(process.env.INTEGRATION_TIMEOUT_MS ?? 30000);
  const maxAttempts = Number(process.env.INTEGRATION_MAX_ATTEMPTS ?? 3);
  const supplierDirect = envUrl("SUPPLIER_API_URL", "http://localhost:4010");
  const supplierProxy = envUrl("INTEGRATION_SUPPLIER_URL");

  return {
    supplierBaseUrl: supplierDirect,
    supplierOrdersUrl: supplierProxy || `${supplierDirect}/api/orders`,
    supplierUser: process.env.INTEGRATION_SUPPLIER_USER?.trim() || "",
    supplierPassword: process.env.INTEGRATION_SUPPLIER_PASSWORD?.trim() || "",
    supplierApiKey: process.env.INTEGRATION_SUPPLIER_API_KEY?.trim() || "",
    erpBaseUrl: envUrl("INTEGRATION_ERP_URL") || envUrl("ERP_API_URL", "http://localhost:4011"),
    accountingBaseUrl:
      envUrl("INTEGRATION_ACCOUNTING_URL") ||
      envUrl("ACCOUNTING_API_URL", "http://localhost:4012"),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000,
    maxAttempts:
      Number.isFinite(maxAttempts) && maxAttempts > 0 ? maxAttempts : 3,
  };
}