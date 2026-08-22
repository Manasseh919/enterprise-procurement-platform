import { useEffect, useState } from "react";
import { getPurchaseOrders, type PurchaseOrder } from "../api/cap";

export function PurchaseOrders() {
  const [count, setCount] = useState<number | null>(null);
  const [rows, setRows] = useState<PurchaseOrder[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getPurchaseOrders()
      .then((data) => {
        if (cancelled) return;
        setRows(data.value);
        setCount(data["@odata.count"] ?? data.value.length);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load purchase orders");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <h1>Purchase Orders</h1>
      {error ? (
        <p className="error">{error}</p>
      ) : (
        <>
          <p className="muted">
            {count != null ? `${count} purchase orders in CAP` : "Loading…"}
          </p>
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Status</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.ID}>
                  <td>{row.purchaseOrderNumber}</td>
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