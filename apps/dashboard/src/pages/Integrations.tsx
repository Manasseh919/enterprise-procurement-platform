import { useEffect, useMemo, useState } from "react";
import {
  INTEGRATION_STATUSES,
  canRetry,
  getIntegrationMessages,
  retryIntegrationMessage,
  type IntegrationMessage,
} from "../api/cap";

function formatJson(value?: string | null): string {
  if (!value) return "—";
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function formatTime(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export function Integrations() {
  const [status, setStatus] = useState("");
  const [destination, setDestination] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [rows, setRows] = useState<IntegrationMessage[]>([]);
  const [count, setCount] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const selected = useMemo(
    () => rows.find((row) => row.ID === selectedId) ?? null,
    [rows, selectedId],
  );

  useEffect(() => {
    let cancelled = false;

    getIntegrationMessages({
      status: status || undefined,
      destinationSystem: destination || undefined,
      search: appliedSearch || undefined,
    })
      .then((data) => {
        if (cancelled) return;
        setRows(data.value);
        setCount(data["@odata.count"] ?? data.value.length);
        setError(null);
        setSelectedId((current) =>
          current && data.value.some((row) => row.ID === current)
            ? current
            : (data.value[0]?.ID ?? null),
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load integration messages",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [status, destination, appliedSearch]);

  async function onRetry() {
    if (!selected || !canRetry(selected.status)) return;
    setRetrying(true);
    setError(null);
    try {
      await retryIntegrationMessage(selected.ID);
      const data = await getIntegrationMessages({
        status: status || undefined,
        destinationSystem: destination || undefined,
        search: appliedSearch || undefined,
      });
      setRows(data.value);
      setCount(data["@odata.count"] ?? data.value.length);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setRetrying(false);
    }
  }

  return (
    <section>
      <h1>Integrations</h1>
      <p className="muted">
        Live IntegrationMessages from CAP. Retry calls the backend action.
      </p>

      <form
        className="filters"
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedSearch(search);
        }}
      >
        <label>
          Status
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All</option>
            {INTEGRATION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          Destination
          <select
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
          >
            <option value="">All</option>
            <option value="SUPPLIER">SUPPLIER</option>
            <option value="ERP">ERP</option>
            <option value="ACCOUNTING">ACCOUNTING</option>
          </select>
        </label>
        <label className="grow">
          Search
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Message ID, type, or error"
          />
        </label>
        <button type="submit">Apply</button>
      </form>

      {error ? <p className="error">{error}</p> : null}
      <p className="muted">{count} messages</p>

      <div className="split">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Message ID</th>
                <th>Type</th>
                <th>Source</th>
                <th>Destination</th>
                <th>Entity</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Created</th>
                <th>Processed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.ID}
                  className={row.ID === selectedId ? "selected" : undefined}
                  onClick={() => setSelectedId(row.ID)}
                >
                  <td>{row.messageId}</td>
                  <td>{row.messageType}</td>
                  <td>{row.sourceSystem}</td>
                  <td>{row.destinationSystem}</td>
                  <td>{row.businessEntityType || "—"}</td>
                  <td>{row.status}</td>
                  <td>{row.attempts}</td>
                  <td>{formatTime(row.createdAt)}</td>
                  <td>{formatTime(row.processedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <article className="card">
          <h2>Details</h2>
          {!selected ? (
            <p className="muted">Select a message.</p>
          ) : (
            <>
              <dl className="details">
                <div>
                  <dt>Message ID</dt>
                  <dd>{selected.messageId}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{selected.status}</dd>
                </div>
                <div>
                  <dt>Attempts</dt>
                  <dd>{selected.attempts}</dd>
                </div>
                <div>
                  <dt>Error</dt>
                  <dd>{selected.errorMessage || "—"}</dd>
                </div>
              </dl>

              <h3>Request payload</h3>
              <pre>{formatJson(selected.payload)}</pre>
              <h3>Response payload</h3>
              <pre>{formatJson(selected.responsePayload)}</pre>

              {canRetry(selected.status) ? (
                <button type="button" onClick={() => void onRetry()} disabled={retrying}>
                  {retrying ? "Retrying…" : "Retry"}
                </button>
              ) : (
                <p className="muted">Retry is only available for FAILED or RETRYING.</p>
              )}
            </>
          )}
        </article>
      </div>
    </section>
  );
}