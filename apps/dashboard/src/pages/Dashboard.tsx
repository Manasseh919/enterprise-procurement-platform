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

function healthLabel(snapshot: DashboardSnapshot): string {
  const { failed, retrying, total } = snapshot.integration;
  if (total === 0) return "No messages yet";
  if (failed > 0) return "Attention needed";
  if (retrying > 0) return "Retrying";
  return "Healthy";
}

export function Dashboard() {
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
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const maxStatus = snapshot
    ? Math.max(1, ...Object.values(snapshot.ordersByStatus))
    : 1;

  return (
    <section>
      <h1>Dashboard</h1>
      <p className="muted">Operational view of procurement and integrations.</p>

      {error ? <p className="error">{error}</p> : null}
      {!error && !snapshot ? <p className="muted">Loading…</p> : null}

      {snapshot ? (
        <>
          <div className="kpi-grid">
            <article className="card">
              <h2>Total purchase requests</h2>
              <p className="kpi">{snapshot.totalPurchaseRequests}</p>
            </article>
            <article className="card">
              <h2>Pending approvals</h2>
              <p className="kpi">{snapshot.pendingApprovals}</p>
            </article>
            <article className="card">
              <h2>Open purchase orders</h2>
              <p className="kpi">{snapshot.openPurchaseOrders}</p>
            </article>
            <article className="card">
              <h2>Monthly spending</h2>
              <p className="kpi">
                {money(snapshot.monthlySpend, snapshot.monthlySpendCurrency)}
              </p>
            </article>
          </div>

          <div className="split">
            <article className="card">
              <h2>Purchase orders by status</h2>
              <ul className="bars">
                {Object.entries(snapshot.ordersByStatus).map(([status, count]) => (
                  <li key={status}>
                    <span className="bar-label">{status}</span>
                    <div className="bar-track">
                      <div
                        className="bar-fill"
                        style={{ width: `${(count / maxStatus) * 100}%` }}
                      />
                    </div>
                    <span className="bar-count">{count}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="card">
              <h2>Integration health</h2>
              <p className="kpi">{healthLabel(snapshot)}</p>
              <ul className="health-list">
                <li>Total messages: {snapshot.integration.total}</li>
                <li>Success: {snapshot.integration.success}</li>
                <li>Failed: {snapshot.integration.failed}</li>
                <li>Retrying: {snapshot.integration.retrying}</li>
                <li>In flight: {snapshot.integration.pending}</li>
              </ul>
            </article>
          </div>

          <article className="card">
            <h2>Recent failures</h2>
            {snapshot.recentFailures.length === 0 ? (
              <p className="muted">No failed integration messages.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Message ID</th>
                    <th>Type</th>
                    <th>Destination</th>
                    <th>Attempts</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.recentFailures.map((row) => (
                    <tr key={row.ID}>
                      <td>{row.messageId}</td>
                      <td>{row.messageType}</td>
                      <td>{row.destinationSystem}</td>
                      <td>{row.attempts}</td>
                      <td>{row.errorMessage || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </article>
        </>
      ) : null}
    </section>
  );
}