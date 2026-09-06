import { useEffect, useState } from "react";
import { coverage, formatBytes, requiredList } from "../docTypes";
import { downloadBlob, getBlob } from "../fileStore";
import { formatDateTime } from "../lib";
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
  const [note, setNote] = useState(null);

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

  async function pick(typeId, file, hadFile) {
    setErr("");
    if (!file) return;
    if (onPending) {
      onPending([...(pending || []).filter((p) => p.typeId !== typeId), { typeId, file }]);
      setNote({ typeId, text: hadFile ? `Updated · ${file.name}` : `Uploaded · ${file.name}` });
      return;
    }
    const out = await onAttach({ bookingId, guestId, typeId, file });
    if (out?.error) {
      setErr(out.error);
      return;
    }
    setNote({ typeId, text: hadFile ? `Updated · ${file.name}` : `Uploaded · ${file.name}` });
  }

  function dropStaged(typeId) {
    onPending?.((pending || []).filter((p) => p.typeId !== typeId));
    setNote({ typeId, text: "Removed. Upload the correct file." });
  }

  async function dropSaved(rec) {
    if (!onRemove) return;
    await onRemove(rec.id);
    setNote({ typeId: rec.typeId, text: "Deleted. Upload the correct file if needed." });
  }

  const pendingMap = Object.fromEntries((pending || []).map((p) => [p.typeId, p.file]));

  return (
    <div>
      {cov && (
        <p className="muted">
          {cov.ok ? "All required documents are on file." : `${cov.missing.length} required document(s) missing.`}{" "}
          Storage: this computer (IndexedDB) · PDF, image or video · images/PDF max 8 MB · videos max 100 MB. Wrong file? Use Delete, then Upload.
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
            const hasFile = Boolean(rec || staged);
            const justNow = note?.typeId === t.id;
            return (
              <tr key={t.id}>
                <td>
                  {t.label}
                  <div className="muted">{t.hint}</div>
                </td>
                <td>{t.required ? <Pill status="Due">Required</Pill> : <Pill status="Cancelled">Optional</Pill>}</td>
                <td>
                  {rec ? (
                    rec.verified ? <Pill status="Paid">Verified</Pill> : <Pill status="Paid">{justNow ? "Updated" : "On file"}</Pill>
                  ) : staged ? (
                    <Pill status="Paid">{justNow && note?.text?.startsWith("Updated") ? "Updated" : "Uploaded"}</Pill>
                  ) : (
                    <Pill status="Due">Missing</Pill>
                  )}
                  {justNow ? (
                    <div style={{ color: "var(--ok)", fontSize: 12, marginTop: 4 }}>{note.text}</div>
                  ) : rec?.uploadedAt ? (
                    <div className="muted">{formatDateTime(rec.uploadedAt)}</div>
                  ) : null}
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
                    {hasFile ? "Replace" : "Upload"}
                    <input
                      type="file"
                      accept="image/*,video/*,.pdf,.mp4,.mov,.webm,.m4v,application/pdf"
                      hidden
                      onChange={(e) => {
                        pick(t.id, e.target.files?.[0], hasFile);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {staged && (
                    <button type="button" className="btn danger small" onClick={() => dropStaged(t.id)}>
                      Delete
                    </button>
                  )}
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
                        <button type="button" className="btn danger small" onClick={() => dropSaved(rec)}>Delete</button>
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
            ) : String(view.mime).startsWith("video/") || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(view.fileName || "") ? (
              <video src={view.url} controls playsInline style={{ maxWidth: "100%", maxHeight: "70vh" }} />
            ) : (
              <iframe title={view.fileName} src={view.url} style={{ width: "100%", height: "70vh", border: 0 }} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
