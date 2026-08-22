function readUrl(
    integrationName: string,
    directName: string,
    fallback: string,
  ): string {
    const integration = process.env[integrationName]?.trim();
    if (integration) return integration.replace(/\/$/, "");
    const direct = process.env[directName]?.trim();
    if (direct) return direct.replace(/\/$/, "");
    return fallback;
  }
  
  export function integrationConfig() {
    const timeoutMs = Number(process.env.INTEGRATION_TIMEOUT_MS ?? 8000);
    const maxAttempts = Number(process.env.INTEGRATION_MAX_ATTEMPTS ?? 3);
  
    return {
      supplierBaseUrl: readUrl(
        "INTEGRATION_SUPPLIER_URL",
        "SUPPLIER_API_URL",
        "http://localhost:4010",
      ),
      erpBaseUrl: readUrl(
        "INTEGRATION_ERP_URL",
        "ERP_API_URL",
        "http://localhost:4011",
      ),
      accountingBaseUrl: readUrl(
        "INTEGRATION_ACCOUNTING_URL",
        "ACCOUNTING_API_URL",
        "http://localhost:4012",
      ),
      timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 8000,
      maxAttempts:
        Number.isFinite(maxAttempts) && maxAttempts > 0 ? maxAttempts : 3,
    };
  }