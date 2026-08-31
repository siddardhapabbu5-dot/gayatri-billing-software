import { useMemo, useState } from "react";
import { coverage, formatBytes, HALL_DOCS, HOTEL_DOCS } from "../docTypes";
import { PageHead, Pill } from "../ui";
import DocPanel from "./DocPanel.jsx";

export default function Documents({ state, focusId, onAttach, onRemove, onVerify }) {
  const [bookingId, setBookingId] = useState(focusId || state.bookings[0]?.id || "");
  const booking = state.bookings.find((b) => b.id === bookingId);
  const guest = state.guests.find((g) => g.id === booking?.guestId);
  const stored = state.documents || [];
  const bytes = stored.reduce((s, d) => s + (d.size || 0), 0);
  const rows = useMemo(
    () =>
      state.bookings.map((b) => ({
        b,
        guest: state.guests.find((g) => g.id === b.guestId),
        cov: coverage(state, b.id),
      })),
    [state]
  );

  return (
    <>
      <PageHead
        title="Documents"
        sub="Hotel check-in KYC and function-hall contracts. Files are stored on this computer, can be viewed here, and a copy can be saved to Downloads."
      />
      <div className="kpis">
        <div className="kpi">
          <div className="k">Files on this PC</div>
          <div className="v">{stored.length}</div>
          <div className="s">{formatBytes(bytes)} in browser storage</div>
        </div>
        <div className="kpi">
          <div className="k">Bookings complete</div>
          <div className="v">{rows.filter((r) => r.cov.ok).length}/{rows.length}</div>
          <div className="s">Required papers uploaded</div>
        </div>
        <div className="kpi">
          <div className="k">Hotel KYC</div>
          <div className="v">{HOTEL_DOCS.filter((d) => d.required).length}</div>
          <div className="s">Mandatory at room check-in</div>
        </div>
        <div className="kpi">
          <div className="k">Hall papers</div>
          <div className="v">{HALL_DOCS.filter((d) => d.required).length}</div>
          <div className="s">ID, address, contract, advance proof</div>
        </div>
      </div>

      <div className="g2">
        <div className="panel">
          <h3>Hotel / room booking</h3>
          <table>
            <tbody>
              {HOTEL_DOCS.map((d) => (
                <tr key={d.id}>
                  <td>{d.label}</td>
                  <td>{d.required ? <Pill status="Due">Required</Pill> : <span className="muted">If applicable</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="panel">
          <h3>Function hall booking</h3>
          <table>
            <tbody>
              {HALL_DOCS.map((d) => (
                <tr key={d.id}>
                  <td>{d.label}</td>
                  <td>{d.required ? <Pill status="Due">Required</Pill> : <span className="muted">If applicable</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3>By reservation</h3>
        <table>
          <thead>
            <tr>
              <th>Booking</th>
              <th>Guest</th>
              <th>Papers</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ b, guest: g, cov }) => (
              <tr key={b.id} className="clickable" onClick={() => setBookingId(b.id)}>
                <td>
                  {b.number}
                  <div className="muted">{b.type} · {b.eventDate}</div>
                </td>
                <td>{g?.name}</td>
                <td>
                  {cov.uploaded} uploaded
                  {cov.missing.length ? ` · ${cov.missing.length} required missing` : " · complete"}
                </td>
                <td>{cov.ok ? <Pill status="Paid">Ready</Pill> : <Pill status="Due">Incomplete</Pill>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {booking && (
        <div className="panel" style={{ marginTop: 12 }}>
          <h3>
            Upload & view · {booking.number} · {guest?.name}
          </h3>
          <DocPanel
            state={state}
            bookingId={booking.id}
            guestId={booking.guestId}
            onAttach={onAttach}
            onRemove={onRemove}
            onVerify={onVerify}
          />
        </div>
      )}
    </>
  );
}
