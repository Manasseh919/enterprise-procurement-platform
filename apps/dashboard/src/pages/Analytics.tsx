import { useEffect, useState } from "react";
import {
  getDashboardSnapshot,
  type DashboardSnapshot,
} from "../api/cap";

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

export function Analytics() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getDashboardSnapshot()
      .then((data) => {
        if (cancelled) return;
        setSnapshot(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load analytics");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <h1>Analytics</h1>
      <p className="muted">Purchase order volume and this month’s spend.</p>

      {error ? <p className="error">{error}</p> : null}
      {!error && !snapshot ? <p className="muted">Loading…</p> : null}

      {snapshot ? (
        <div className="split">
          <article className="card">
            <h2>This month</h2>
            <p className="kpi">
              {money(snapshot.monthlySpend, snapshot.monthlySpendCurrency)}
            </p>
            <p className="muted">Sum of purchase orders created this UTC month.</p>
          </article>
          <article className="card">
            <h2>Status mix</h2>
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Orders</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(snapshot.ordersByStatus).map(([status, count]) => (
                  <tr key={status}>
                    <td>{status}</td>
                    <td>{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </div>
      ) : null}
    </section>
  );
}