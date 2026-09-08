import { useEffect, useMemo, useRef, useState } from "react";
import { EXPENSE_CATEGORIES, EXPENSE_DEPARTMENTS, PAY_MODES, expenseLabel } from "../finance";
import { getBlob, openBlob } from "../fileStore";
import { downloadCsv, formatDateDMY, money, todayISO } from "../lib";
import { PageHead } from "../ui";

function expenseStatus(row) {
  if (row.status === "Verified") return "Verified";
  if (row.receiptId || row.status === "Pending verify") return "Pending verify";
  return "No receipt";
}

function statusClass(st) {
  if (st === "Verified") return "exp-status ok";
  if (st === "Pending verify") return "exp-status wait";
  return "exp-status none";
}

export default function Expenses({
  state,
  onAdd,
  onUpdate,
  onRemove,
  onAttachReceipt,
  onVerify,
}) {
  const deskUser = state.users.find((u) => u.id === state.session?.userId);
  const fileRef = useRef(null);
  const [editId, setEditId] = useState(null);
  const [uploadId, setUploadId] = useState(null);
  const [date, setDate] = useState(todayISO());
  const [department, setDepartment] = useState("Hotel");
  const [category, setCategory] = useState("diesel");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [paidTo, setPaidTo] = useState("");
  const [givenBy, setGivenBy] = useState(deskUser?.name || state.property?.name || "Hotel");
  const [description, setDescription] = useState("");
  const [filterDept, setFilterDept] = useState("all");
  const [filterFrom, setFilterFrom] = useState(todayISO());
  const [filterTo, setFilterTo] = useState(todayISO());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const cur = state.property.currency;
  const loc = state.property.locale;
  const m = (n) => money(n, cur, loc);

  const rows = useMemo(() => {
    return (state.expenses || [])
      .filter((e) => {
        const d = String(e.date || "").slice(0, 10);
        if (filterFrom && d < filterFrom) return false;
        if (filterTo && d > filterTo) return false;
        if (filterDept !== "all" && e.department !== filterDept) return false;
        return true;
      })
      .sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.at).localeCompare(String(a.at)));
  }, [state.expenses, filterFrom, filterTo, filterDept]);

  const total = rows.reduce((s, e) => s + Number(e.amount || 0), 0);

  // If the row being edited was removed / storage reloaded, switch to "new" so Save still works.
  useEffect(() => {
    if (!editId) return;
    const stillThere = (state.expenses || []).some((e) => String(e.id) === String(editId));
    if (!stillThere) {
      setEditId(null);
      setError("That expense was removed — fill and Save expense to record it again.");
    }
  }, [editId, state.expenses]);

  function resetForm() {
    setEditId(null);
    setAmount("");
    setPaidTo("");
    setDescription("");
    setDate(todayISO());
    setDepartment("Hotel");
    setCategory("diesel");
    setMethod("Cash");
    setGivenBy(deskUser?.name || state.property?.name || "Hotel");
    setError("");
  }

  function startEdit(row) {
    setEditId(row.id);
    setDate(String(row.date || "").slice(0, 10));
    setDepartment(row.department || "Hotel");
    setCategory(row.category || "other");
    setAmount(String(row.amount || ""));
    setMethod(row.method || "Cash");
    setPaidTo(row.paidTo || "");
    setGivenBy(row.givenBy || deskUser?.name || state.property?.name || "Hotel");
    setDescription(row.description || "");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submit(e) {
    e.preventDefault();
    setError("");
    const payload = {
      date,
      department,
      category,
      amount: Number(amount),
      method,
      paidTo,
      givenBy,
      description,
    };
    let out = editId ? onUpdate?.(editId, payload) : onAdd?.(payload);
    // Stale edit id (deleted row / refresh) → save as a new expense instead of blocking.
    if (editId && out?.error === "Expense not found") {
      setEditId(null);
      out = onAdd?.(payload);
    }
    if (out?.error) {
      setError(out.error);
      return;
    }
    resetForm();
  }

  function pickReceipt(rowId) {
    setUploadId(rowId);
    fileRef.current?.click();
  }

  async function onFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !uploadId) return;
    setBusy(true);
    setError("");
    try {
      const out = await onAttachReceipt?.(uploadId, file);
      if (out?.error) setError(out.error);
    } finally {
      setBusy(false);
      setUploadId(null);
    }
  }

  async function viewReceipt(row) {
    if (!row.receiptId) return;
    const blobRow = await getBlob(row.receiptId);
    if (!blobRow?.blob) {
      window.alert("Receipt file not found on this computer.");
      return;
    }
    if (!openBlob(blobRow)) {
      window.alert("Allow pop-ups to view the receipt in a new tab.");
    }
  }

  return (
    <>
      <PageHead title="Expense entry" sub="Record money given for hotel / hall expenses. Upload receipt, then Verify.">
        <button
          className="btn ghost"
          type="button"
          onClick={() => {
            downloadCsv(`Gayatri-expenses-${filterFrom || "all"}_${filterTo || "all"}.csv`, [
              ["Date", "Given by", "Taken by", "Department", "Expense", "Amount", "Payment", "Status", "Receipt", "Description"],
              ...rows.map((r) => [
                r.date,
                r.givenBy || state.property?.name || "Hotel",
                r.paidTo || "—",
                r.department,
                expenseLabel(r.category),
                Number(r.amount || 0),
                r.method,
                expenseStatus(r),
                r.receiptName || "",
                r.description || "",
              ]),
            ]);
          }}
        >
          Download Excel
        </button>
      </PageHead>

      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf"
        hidden
        onChange={onFileChosen}
      />

      <div className="panel exp-panel">
        <h3 className="exp-section-title">{editId ? "Edit expense" : "Record expense"}</h3>
        <form className="exp-form" onSubmit={submit}>
          <div className="exp-row exp-row-3">
            <label>
              <span className="exp-lab">Date</span>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label>
              <span className="exp-lab">Department</span>
              <select value={department} onChange={(e) => setDepartment(e.target.value)}>
                {EXPENSE_DEPARTMENTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="exp-lab">Expense type</span>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="exp-row exp-row-3">
            <label>
              <span className="exp-lab">Given by</span>
              <input value={givenBy} onChange={(e) => setGivenBy(e.target.value)} placeholder="Hotel / desk staff" required />
            </label>
            <label className="exp-span-2">
              <span className="exp-lab">Taken by</span>
              <input
                value={paidTo}
                onChange={(e) => setPaidTo(e.target.value)}
                placeholder="Who received ₹ — shop · person · vendor"
                required
              />
            </label>
          </div>

          <div className="exp-row exp-row-3">
            <label>
              <span className="exp-lab">Amount</span>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Money given"
              />
            </label>
            <label>
              <span className="exp-lab">Payment mode</span>
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAY_MODES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              <span className="exp-lab">Note</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Pressure cooker advance"
              />
            </label>
          </div>

          {error ? <p className="exp-error">{error}</p> : null}

          <div className="exp-actions">
            <button className="btn" type="submit" disabled={busy}>
              {editId ? "Save changes" : "Save expense"}
            </button>
            {editId ? (
              <button className="btn ghost" type="button" onClick={resetForm}>
                Cancel edit
              </button>
            ) : null}
            <span className="muted exp-hint">After save: upload receipt → Verify</span>
          </div>
        </form>
      </div>

      <div className="panel exp-panel">
        <div className="panel-head">
          <h3>Expense list</h3>
          <div className="exp-total">
            <span className="muted">Total</span>
            <strong>{m(total)}</strong>
          </div>
        </div>

        <div className="exp-filters">
          <label>
            From
            <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
          </label>
          <label>
            To
            <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
          </label>
          <label>
            Department
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
              <option value="all">All</option>
              {EXPENSE_DEPARTMENTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="table-wrap">
          <table className="exp-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Given by</th>
                <th>Taken by</th>
                <th>Expense</th>
                <th className="num">Amount</th>
                <th>Mode</th>
                <th>Status</th>
                <th>Receipt</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!rows.length && (
                <tr>
                  <td colSpan={9} className="muted">
                    No expenses in this range.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const st = expenseStatus(r);
                const isMaint = r.category === "maintenance";
                return (
                  <tr key={r.id} className={isMaint ? "exp-row-maint" : undefined}>
                    <td>{formatDateDMY(r.date)}</td>
                    <td>{r.givenBy || state.property?.name || "Hotel"}</td>
                    <td>
                      <strong>{r.paidTo || "—"}</strong>
                      {r.description ? <div className="muted">{r.description}</div> : null}
                    </td>
                    <td>
                      {isMaint ? (
                        <span className="pill maint">{expenseLabel(r.category)}</span>
                      ) : (
                        expenseLabel(r.category)
                      )}
                      <div className="muted">{r.department}</div>
                    </td>
                    <td className="num">{m(Number(r.amount || 0))}</td>
                    <td>{r.method}</td>
                    <td>
                      <span className={statusClass(st)}>{st}</span>
                      {r.verifiedBy ? <div className="muted">{r.verifiedBy}</div> : null}
                    </td>
                    <td>
                      {r.receiptId ? (
                        <button className="btn ghost small" type="button" onClick={() => viewReceipt(r)}>
                          View
                        </button>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <div className="exp-row-actions">
                        <button className="btn ghost small" type="button" onClick={() => startEdit(r)}>
                          Edit
                        </button>
                        <button
                          className="btn ghost small"
                          type="button"
                          disabled={busy}
                          onClick={() => pickReceipt(r.id)}
                        >
                          {r.receiptId ? "Replace receipt" : "Upload receipt"}
                        </button>
                        {r.receiptId && st !== "Verified" ? (
                          <button
                            className="btn small"
                            type="button"
                            onClick={() => {
                              const out = onVerify?.(r.id, true);
                              if (out?.error) window.alert(out.error);
                            }}
                          >
                            Verify
                          </button>
                        ) : null}
                        {st === "Verified" ? (
                          <button
                            className="btn ghost small"
                            type="button"
                            onClick={() => onVerify?.(r.id, false)}
                          >
                            Unverify
                          </button>
                        ) : null}
                        <button
                          className="btn ghost small danger"
                          type="button"
                          onClick={() => {
                            if (!window.confirm("Remove this expense?")) return;
                            if (String(editId) === String(r.id)) resetForm();
                            onRemove?.(r.id);
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
