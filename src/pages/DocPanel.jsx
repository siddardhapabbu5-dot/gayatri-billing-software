import { useEffect, useState } from "react";
import { coverage, formatBytes, requiredList } from "../docTypes";
import { downloadBlob, getBlob } from "../fileStore";
import { Pill } from "../ui";

export default function DocPanel({ state, bookingId, guestId, types: typeOverride, pending, onPending, onAttach, onRemove, onVerify }) {
  const booking = state.bookings.find((b) => b.id === bookingId);
  const types = typeOverride || (bookingId ? requiredList(state, bookingId) : []);
  const uploaded = (state.documents || []).filter(
    (d) => (bookingId && d.bookingId === bookingId) || (!bookingId && guestId && d.guestId === guestId)
  );
  const cov = bookingId ? coverage(state, bookingId) : null;
  const [view, setView] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    return () => {
      if (view?.url) URL.revokeObjectURL(view.url);
    };
  }, [view]);

  async function open(doc) {
    const row = await getBlob(doc.id);
    if (!row?.blob) {
      setErr("File is not in this browser’s storage. Re-upload it on this computer.");
      return;
    }
    const url = URL.createObjectURL(row.blob);
    setView({ ...doc, url, mime: row.type || doc.mime, blob: row.blob });
  }

  async function saveCopy(doc) {
    const row = await getBlob(doc.id);
    downloadBlob(row, doc.fileName);
  }

  async function pick(typeId, file) {
    setErr("");
    if (!file) return;
    if (onPending) {
      onPending([...(pending || []).filter((p) => p.typeId !== typeId), { typeId, file }]);
      return;
    }
    const out = await onAttach({ bookingId, guestId, typeId, file });
    if (out?.error) setErr(out.error);
  }

  const pendingMap = Object.fromEntries((pending || []).map((p) => [p.typeId, p.file]));

  return (
    <div>
      {cov && (
        <p className="muted">
          {cov.ok ? "All required documents are on file." : `${cov.missing.length} required document(s) missing.`}{" "}
          Storage: this computer (IndexedDB) · PDF or image · max 8 MB each.
        </p>
      )}
      {err && <p style={{ color: "var(--due)" }}>{err}</p>}
      <table>
        <thead>
          <tr>
            <th>Document</th>
            <th>Need</th>
            <th>Status</th>
            <th>File</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {types.map((t) => {
            const rec = uploaded.find((d) => d.typeId === t.id);
            const staged = pendingMap[t.id];
            return (
              <tr key={t.id}>
                <td>
                  {t.label}
                  <div className="muted">{t.hint}</div>
                </td>
                <td>{t.required ? <Pill status="Due">Required</Pill> : <Pill status="Cancelled">Optional</Pill>}</td>
                <td>
                  {rec ? (
                    rec.verified ? <Pill status="Paid">Verified</Pill> : <Pill status="Advance">Uploaded</Pill>
                  ) : staged ? (
                    <Pill status="Advance">Ready to save</Pill>
                  ) : (
                    <Pill status="Due">Missing</Pill>
                  )}
                </td>
                <td>
                  {rec ? (
                    <>
                      {rec.fileName}
                      <div className="muted">{formatBytes(rec.size)} · {rec.storage}</div>
                    </>
                  ) : staged ? (
                    staged.name
                  ) : (
                    "—"
                  )}
                </td>
                <td className="row">
                  <label className="btn ghost small" style={{ margin: 0 }}>
                    {rec || staged ? "Replace" : "Upload"}
                    <input
                      type="file"
                      accept="image/*,.pdf,application/pdf"
                      hidden
                      onChange={(e) => pick(t.id, e.target.files?.[0])}
                    />
                  </label>
                  {rec && (
                    <>
                      <button type="button" className="btn small" onClick={() => open(rec)}>View</button>
                      <button type="button" className="btn ghost small" onClick={() => saveCopy(rec)}>Save copy</button>
                      {onVerify && (
                        <button type="button" className="btn ghost small" onClick={() => onVerify(rec.id, !rec.verified)}>
                          {rec.verified ? "Unverify" : "Verify"}
                        </button>
                      )}
                      {onRemove && (
                        <button type="button" className="btn danger small" onClick={() => onRemove(rec.id)}>Delete</button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {booking && <p className="muted" style={{ marginTop: 8 }}>{booking.number}</p>}
      {view && (
        <div className="lightbox" onClick={() => setView(null)}>
          <div className="lightbox-card" onClick={(e) => e.stopPropagation()}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
              <strong>{view.label}</strong>
              <button className="btn ghost small" onClick={() => setView(null)}>Close</button>
            </div>
            {String(view.mime).startsWith("image/") ? (
              <img src={view.url} alt={view.fileName} style={{ maxWidth: "100%", maxHeight: "70vh" }} />
            ) : (
              <iframe title={view.fileName} src={view.url} style={{ width: "100%", height: "70vh", border: 0 }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
