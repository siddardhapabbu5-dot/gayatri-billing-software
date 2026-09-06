import { useMemo, useState } from "react";
import { EXPENSE_CATEGORIES, EXPENSE_DEPARTMENTS, PAY_MODES, expenseLabel } from "../finance";
import { downloadCsv, formatDateDMY, money, todayISO } from "../lib";
import { PageHead } from "../ui";

export default function Expenses({ state, onAdd, onRemove }) {
  const [date, setDate] = useState(todayISO());
  const [department, setDepartment] = useState("Hotel");
  const [category, setCategory] = useState("diesel");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [description, setDescription] = useState("");
  const [filterDept, setFilterDept] = useState("all");
  const [filterFrom, setFilterFrom] = useState(todayISO());
  const [filterTo, setFilterTo] = useState(todayISO());
  const [error, setError] = useState("");

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

  function submit(e) {
    e.preventDefault();
    setError("");
    const out = onAdd({
      date,
      department,
      category,
      amount: Number(amount),
      method,
      description,
    });
    if (out?.error) {
      setError(out.error);
      return;
    }
    setAmount("");
    setDescription("");
  }

  return (
    <>
      <PageHead title="Expense entry" sub="Record daily costs. They reduce net income on the daily cashbook and management reports.">
        <button
          className="btn ghost"
          type="button"
          onClick={() => {
            downloadCsv(`Gayatri-expenses-${filterFrom || "all"}_${filterTo || "all"}.csv`, [
              ["Date", "Department", "Expense", "Amount", "Payment", "Description"],
              ...rows.map((r) => [r.date, r.department, expenseLabel(r.category), r.amount, r.method, r.description || ""]),
            ]);
          }}
        >
          Download Excel
        </button>
      </PageHead>

      <div className="g2" style={{ alignItems: "start" }}>
        <div className="panel">
          <h3>New expense</h3>
          <form className="fields two" onSubmit={submit}>
            <label>
              Date
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label>
              Department
              <select value={department} onChange={(e) => setDepartment(e.target.value)}>
                {EXPENSE_DEPARTMENTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label>
              Expense
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>
            <label>
              Amount
              <input type="number" min="1" step="1" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="₹" />
            </label>
            <label>
              Payment
              <select value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAY_MODES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Description
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Generator diesel" />
            </label>
            {error && <p style={{ color: "var(--due)", gridColumn: "1 / -1", margin: 0 }}>{error}</p>}
            <button className="btn" type="submit">Save expense</button>
          </form>
        </div>

        <div className="panel">
          <div className="panel-head">
            <h3>Expense list</h3>
            <strong>{m(total)}</strong>
          </div>
          <div className="fields two" style={{ marginBottom: 12 }}>
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
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Department</th>
                <th>Expense</th>
                <th>Amount</th>
                <th>Pay</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {!rows.length && (
                <tr>
                  <td colSpan={6} className="muted">No expenses in this range.</td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{formatDateDMY(r.date)}</td>
                  <td>{r.department}</td>
                  <td>
                    {expenseLabel(r.category)}
                    {r.description ? <div className="muted">{r.description}</div> : null}
                  </td>
                  <td>{m(r.amount)}</td>
                  <td>{r.method}</td>
                  <td>
                    <button className="btn ghost small danger" type="button" onClick={() => onRemove(r.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
