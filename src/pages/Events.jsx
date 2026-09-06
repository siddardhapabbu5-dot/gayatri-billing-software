import { PageHead, Pill } from "../ui";

export default function Events({ state, onTask }) {
  const activeEvents = state.events.filter((ev) => {
    const bk = state.bookings.find((b) => b.id === ev.bookingId);
    return bk && bk.status !== "Cancelled";
  });

  return (
    <>
      <PageHead title="Event projects" sub="Each confirmed hall booking becomes an event with a run-sheet. Cancelled bookings are removed from this list." />
      {activeEvents.length === 0 && <div className="empty">No event projects yet.</div>}
      <div className="g2">
        {activeEvents.map((ev) => {
          const bk = state.bookings.find((b) => b.id === ev.bookingId);
          const guest = state.guests.find((g) => g.id === bk?.guestId);
          const done = ev.tasks.filter((t) => t.status === "Done").length;
          return (
            <div key={ev.id} className="panel">
              <h3>{ev.name}</h3>
              <div className="muted">{ev.date} · {guest?.name} · {bk?.number} · {done}/{ev.tasks.length} complete</div>
              <table style={{ marginTop: 8 }}>
                <tbody>
                  {ev.tasks.map((t) => (
                    <tr key={t.id}>
                      <td>{t.name}</td>
                      <td className="muted">{t.assignee || "Unassigned"}</td>
                      <td>
                        <select value={t.status} onChange={(e) => onTask(ev.id, t.id, e.target.value)}>
                          {["Pending", "In progress", "Done"].map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td><Pill status={t.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </>
  );
}
