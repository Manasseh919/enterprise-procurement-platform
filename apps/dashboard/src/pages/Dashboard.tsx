import { useEffect, useState } from "react";
import { getPurchaseRequests, type PurchaseRequest } from "../api/cap";

export function Dashboard() {
  const [count, setCount] = useState<number | null>(null);
  const [rows, setRows] = useState<PurchaseRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getPurchaseRequests()
      .then((data) => {
        if (cancelled) return;
        setRows(data.value);
        setCount(data["@odata.count"] ?? data.value.length);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load CAP data");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <h1>Dashboard</h1>
      <p className="muted">
        Connected to SAP CAP ProcurementService. KPI cards come in Stage 17.
      </p>

      {error ? (
        <p className="error">{error}</p>
      ) : (
        <>
          <p>
            <strong>CAP status:</strong> connected
            {count != null ? ` · ${count} purchase requests` : ""}
          </p>
          <table>
            <thead>
              <tr>
                <th>Request</th>
                <th>Title</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.ID}>
                  <td>{row.requestNumber}</td>
                  <td>{row.title}</td>
                  <td>{row.status}</td>
                  <td>
                    {row.totalAmount} {row.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}