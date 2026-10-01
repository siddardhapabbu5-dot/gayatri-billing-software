import { useState } from "react";
import { fetchDeskSnapshot, uploadGuestDocument } from "../api/ops.js";
import { snapshotToPhone } from "./deskSync.js";
import { HALLS, ROOM_TYPES, allow, hallName, inr, showDate } from "./previewState.js";

const LEAD_STATUSES = ["New Enquiry", "Follow-up", "Quotation", "Site Visit Done", "Confirmed", "Lost"];
const SOURCES = ["Website", "Google Search", "Google Maps", "WhatsApp", "Facebook", "Instagram", "Reference", "Walk-in", "Phone Call", "Wedding Planner", "Existing Customer", "JustDial", "Sulekha", "Other"];
const DOC_TYPES = [
  ["ID Proof", "Aadhaar / PAN / Passport"],
  ["Agreement", "Booking Agreement"],
  ["GST Certificate", "GST Registration"],
  ["Address Proof", "Electricity Bill / Address Proof"],
];
const FILTERS = [
  ["all", "All"],
  ["new", "New"],
  ["follow", "Follow-up"],
  ["quote", "Quotation"],
];

function tone(status) {
  const value = String(status || "").toLowerCase();
  if (value.includes("follow")) return "follow";
  if (value.includes("quot")) return "quote";
  if (value.includes("confirm")) return "confirmed";
  if (value.includes("lost")) return "lost";
  if (value.includes("visit")) return "visit";
  return "new";
}

function docKind(typeCode) {
  const value = String(typeCode || "").toLowerCase();
  if (value.includes("gst")) return "GST Certificate";
  if (value.includes("agree")) return "Agreement";
  if (value.includes("address")) return "Address Proof";
  if (value.includes("id")) return "ID Proof";
  return "";
}

function guestBookings(guest, state) {
  return (state.bookings || []).filter((booking) => {
    if (String(booking.status || "").toLowerCase() === "cancelled") return false;
    if (guest.serverId && booking.guestServerId === guest.serverId) return true;
    return booking.guest && booking.guest === guest.name;
  });
}

function guestDocuments(guest, state) {
  const numbers = new Set(guestBookings(guest, state).map((booking) => booking.no));
  return (state.documents || []).filter((doc) => Number(doc.guestId) === Number(guest.serverId) || numbers.has(doc.bookingNo));
}

function derivedStatus(guest, bookings) {
  if (guest.leadStatus) return guest.leadStatus;
  if (bookings.some((booking) => String(booking.status || "").toLowerCase() === "confirmed")) return "Confirmed";
  if (bookings.length) return "Follow-up";
  return "New Enquiry";
}

function matchesFilter(status, key) {
  if (key === "all") return true;
  if (key === "new") return status === "New Enquiry";
  if (key === "follow") return status === "Follow-up";
  return status === "Quotation";
}

function placeOf(booking) {
  if (booking.hallId) return hallName(booking.hallId);
  const room = ROOM_TYPES.find((item) => item.id === booking.roomId);
  return room?.name || HALLS.find((item) => item.id === booking.hallId)?.name || "Booking";
}

function locationOf(guest) {
  const address = String(guest.address || "").split(",")[0].trim();
  return address || "—";
}

function phoneDigits(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

function emptyGuest() {
  return { name: "", phone: "", email: "", address: "", leadStatus: "Follow-up", leadSource: "", notes: "" };
}

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

export function GuestCrm({ state, dispatch, flash, documentsMode = false }) {
  const role = state.user?.role;
  const canEdit = allow(role, "guest.edit");
  const [view, setView] = useState("list");
  const [tab, setTab] = useState("overview");
  const [guestId, setGuestId] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState(emptyGuest);
  const [editingId, setEditingId] = useState("");
  const [pickerBack, setPickerBack] = useState("profile");
  const [uploading, setUploading] = useState("");

  const guest = (state.guests || []).find((item) => item.id === guestId) || null;
  const bookings = guest ? guestBookings(guest, state) : [];
  const documents = guest ? guestDocuments(guest, state) : [];
  const status = guest ? derivedStatus(guest, bookings) : "";
  const uploadedTypes = new Set(documents.map((doc) => docKind(doc.kind)).filter(Boolean));
  const uploadedCount = DOC_TYPES.filter(([label]) => uploadedTypes.has(label)).length;

  const rows = (state.guests || []).map((item) => {
    const itemBookings = guestBookings(item, state);
    return { guest: item, bookings: itemBookings, status: derivedStatus(item, itemBookings), docs: guestDocuments(item, state) };
  }).filter(({ guest: item, status: itemStatus }) => {
    const blob = `${item.name} ${item.phone} ${item.leadSource} ${item.address}`.toLowerCase();
    return matchesFilter(itemStatus, filter) && blob.includes(query.trim().toLowerCase());
  });

  const counts = { all: 0, new: 0, follow: 0, quote: 0 };
  (state.guests || []).forEach((item) => {
    const itemStatus = derivedStatus(item, guestBookings(item, state));
    counts.all += 1;
    if (itemStatus === "New Enquiry") counts.new += 1;
    if (itemStatus === "Follow-up") counts.follow += 1;
    if (itemStatus === "Quotation") counts.quote += 1;
  });

  function openGuest(item, nextTab) {
    setGuestId(item.id);
    setTab(nextTab || (documentsMode ? "documents" : "overview"));
    setView("profile");
  }

  function startEdit(item) {
    setEditingId(item?.id || "");
    setForm(item ? {
      name: item.name || "",
      phone: item.phone || "",
      email: item.email || "",
      address: item.address || "",
      leadStatus: derivedStatus(item, guestBookings(item, state)),
      leadSource: item.leadSource || "",
      notes: item.notes || "",
    } : emptyGuest());
    setView("edit");
  }

  function saveGuest() {
    if (!form.name.trim() || !form.phone.trim()) {
      flash("Name and phone are required.");
      return;
    }
    const current = (state.guests || []).find((item) => item.id === editingId);
    if (current?.serverId) {
      dispatch({ type: "update-guest", guest: { ...current, ...form } });
      flash("Customer updated.");
      setView("profile");
      return;
    }
    dispatch({ type: "add-guest", guest: form });
    flash("Customer added.");
    setView("list");
  }

  async function refresh() {
    const snap = await fetchDeskSnapshot();
    dispatch({ type: "hydrate", patch: snapshotToPhone(snap) });
  }

  async function upload(type, file) {
    if (!guest?.serverId) {
      flash("Save the customer on the desk before uploading a file.");
      return;
    }
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      flash("File must be 5 MB or smaller.");
      return;
    }
    setUploading(type);
    try {
      await uploadGuestDocument(guest.serverId, type, file);
      await refresh();
      flash(`${type} uploaded.`);
    } catch (err) {
      flash(err.message || "Upload failed.");
    } finally {
      setUploading("");
    }
  }

  function saveDocuments() {
    if (guest?.serverId && canEdit) {
      dispatch({
        type: "update-guest",
        guest: {
          ...guest,
          leadSource: form.leadSource || guest.leadSource || "",
          leadStatus: guest.leadStatus || status,
          notes: guest.notes || "",
        },
      });
    }
    setView("saved");
  }

  if (view === "saved") {
    return (
      <>
        <section className="mapp-crm-saved">
          <span className="mapp-crm-tick">✓</span>
          <h1>Documents Saved Successfully!</h1>
          <p className="sub">Customer details and documents have been updated.</p>
        </section>
        <button type="button" className="mapp-cta" onClick={() => setView("list")}>Back to Customer</button>
      </>
    );
  }

  if (view === "source" || view === "status") {
    const options = view === "source" ? SOURCES : LEAD_STATUSES;
    const current = view === "source" ? form.leadSource : form.leadStatus;
    return (
      <>
        <h1>{view === "source" ? "Select Source" : "Select Lead Status"}</h1>
        <p className="sub">{view === "source" ? "How did you know about us?" : "Track the enquiry progress"}</p>
        {options.map((option) => (
          <button key={option} type="button" className={`mapp-crm-option${current === option ? " is-on" : ""}`} onClick={() => setForm({ ...form, [view === "source" ? "leadSource" : "leadStatus"]: option })}>
            <span className={`mapp-lead is-${tone(option)}`}>{option}</span>
            <span>{current === option ? "●" : "○"}</span>
          </button>
        ))}
        <button type="button" className="mapp-cta" onClick={() => setView(pickerBack)}>Done</button>
      </>
    );
  }

  if (view === "edit") {
    return (
      <>
        <h1>{editingId ? "Edit Customer" : "Add Customer"}</h1>
        <label>Name *<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label>Phone *<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        <label>Email<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Location<input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></label>
        <button type="button" className="mapp-crm-option" onClick={() => { setPickerBack("edit"); setView("source"); }}>
          <span>Source</span><strong>{form.leadSource || "Select"}</strong>
        </button>
        <button type="button" className="mapp-crm-option" onClick={() => { setPickerBack("edit"); setView("status"); }}>
          <span>Lead Status *</span><strong>{form.leadStatus || "Select"}</strong>
        </button>
        <label>Notes<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
        <button type="button" className="mapp-cta" onClick={saveGuest}>Save</button>
      </>
    );
  }

  if (view === "profile" && guest) {
    const revenue = bookings.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    const upcoming = bookings.filter((item) => item.date >= todayKey()).slice(0, 3);
    return (
      <>
        <section className="mapp-card mapp-crm-head">
          <span className="mapp-avatar">{(guest.name || "?").slice(0, 1).toUpperCase()}</span>
          <span>
            <strong>{guest.name}</strong>
            <span className="sub">{guest.phone || "—"}</span>
            <span className="sub">{locationOf(guest)}</span>
            <span className={`mapp-lead is-${tone(status)}`}>{status}</span>
          </span>
        </section>
        <div className="mapp-crm-stats">
          <span><b>{bookings.length}</b><small>Bookings</small></span>
          <span><b>{inr(revenue)}</b><small>Total Revenue</small></span>
          <span><b>{uploadedCount}/4</b><small>Documents</small></span>
        </div>
        <div className="mapp-crm-actions">
          <a className="mapp-ghost" href={guest.phone ? `tel:${guest.phone}` : undefined}>Call</a>
          <a className="mapp-ghost" href={guest.phone ? `https://wa.me/${phoneDigits(guest.phone)}` : undefined} target="_blank" rel="noreferrer">WhatsApp</a>
          {canEdit ? <button type="button" className="mapp-ghost" onClick={() => startEdit(guest)}>Edit</button> : null}
        </div>
        <div className="mapp-room-tabs mapp-crm-tabs">
          {["overview", "bookings", "documents", "activity"].map((item) => (
            <button key={item} type="button" className={tab === item ? "is-on" : ""} onClick={() => setTab(item)}>{item[0].toUpperCase() + item.slice(1)}</button>
          ))}
        </div>
        {tab === "overview" ? (
          <section className="mapp-card">
            <strong>Customer Information</strong>
            <div className="mapp-bill"><span>Name</span><span>{guest.name}</span></div>
            <div className="mapp-bill"><span>Phone</span><span>{guest.phone || "—"}</span></div>
            <div className="mapp-bill"><span>Email</span><span>{guest.email || "—"}</span></div>
            <div className="mapp-bill"><span>Location</span><span>{locationOf(guest)}</span></div>
            <div className="mapp-bill"><span>Lead Status</span><span>{status}</span></div>
            <div className="mapp-bill"><span>Source</span><span>{guest.leadSource || "—"}</span></div>
            <p className="sub">{guest.notes || "No notes yet."}</p>
          </section>
        ) : null}
        {tab === "bookings" ? (
          <>
            <h2>Upcoming Bookings</h2>
            {(upcoming.length ? upcoming : bookings).map((item) => (
              <article key={item.id} className="mapp-card">
                <strong>{item.package || "Function"}</strong>
                <p className="sub">{showDate(item.date)} · {placeOf(item)}</p>
                <span className={`mapp-lead is-${tone(item.status)}`}>{item.status}</span>
              </article>
            ))}
            {!bookings.length ? <p className="sub">No bookings for this customer.</p> : null}
            <section className="mapp-card">
              <strong>Document Summary</strong>
              <p className="sub">{uploadedCount}/4 uploaded · {4 - uploadedCount} pending</p>
              <div className="mapp-crm-actions">
                <a className="mapp-ghost" href={guest.phone ? `tel:${guest.phone}` : undefined}>Call</a>
                <a className="mapp-ghost" href={guest.phone ? `https://wa.me/${phoneDigits(guest.phone)}` : undefined} target="_blank" rel="noreferrer">WhatsApp</a>
                <a className="mapp-ghost" href={guest.email ? `mailto:${guest.email}` : undefined}>Send Email</a>
              </div>
              <button type="button" className="mapp-ghost" onClick={() => setTab("documents")}>View All Documents</button>
            </section>
          </>
        ) : null}
        {tab === "documents" ? (
          <>
            <section className="mapp-card">
              <div className="mapp-row"><strong>Documents</strong><span>{uploadedCount} / 4 Uploaded</span></div>
              <div className="mapp-crm-bar"><span style={{ width: `${uploadedCount * 25}%` }} /></div>
            </section>
            {DOC_TYPES.map(([label, hint]) => {
              const files = documents.filter((doc) => docKind(doc.kind) === label);
              const latest = files[0];
              return (
                <article key={label} className="mapp-card mapp-crm-doc">
                  <div className="mapp-crm-doc-top">
                    <span><strong>{label}</strong><span className="sub">{latest ? latest.name : hint}</span></span>
                    <span className={`mapp-lead ${latest ? "is-confirmed" : "is-lost"}`}>{latest ? "Uploaded" : "Pending"}</span>
                  </div>
                  {latest?.createdAt ? <p className="sub">{showDate(String(latest.createdAt).slice(0, 10))}</p> : null}
                  {canEdit ? (
                    <label className="mapp-crm-upload">{uploading === label ? "Uploading…" : "Upload"}
                      <input type="file" accept="image/jpeg,image/png,application/pdf,.jpg,.png,.pdf" onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; upload(label, file); }} />
                    </label>
                  ) : null}
                </article>
              );
            })}
            <p className="sub">Supported file types: JPG, PNG, PDF (max 5 MB).</p>
            <button type="button" className="mapp-crm-option" onClick={() => { setForm({ ...form, leadSource: guest.leadSource || "", leadStatus: status }); setPickerBack("profile"); setView("source"); }}>
              <span>How did you know about Gayatri?</span><strong>{guest.leadSource || "Select source"}</strong>
            </button>
            <button type="button" className="mapp-cta" onClick={saveDocuments}>Save & Continue</button>
          </>
        ) : null}
        {tab === "activity" ? (
          <>
            {bookings.map((item) => <article key={item.id} className="mapp-card"><strong>{item.no}</strong><p className="sub">{showDate(item.date)} · {placeOf(item)} · {item.status}</p></article>)}
            {documents.map((doc) => <article key={doc.id} className="mapp-card"><strong>{docKind(doc.kind) || doc.kind}</strong><p className="sub">{doc.name}</p></article>)}
            {!bookings.length && !documents.length ? <p className="sub">No activity yet.</p> : null}
          </>
        ) : null}
        <button type="button" className="mapp-ghost" onClick={() => setView("list")}>Back to list</button>
      </>
    );
  }

  return (
    <>
      <div className="mapp-row">
        <h1>{documentsMode ? "Documents" : "Guests / CRM"}</h1>
        {canEdit && !documentsMode ? <button type="button" className="mapp-crm-add" onClick={() => startEdit(null)}>+</button> : null}
      </div>
      <input placeholder="Search by name, phone, or source" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="mapp-chips mapp-crm-chips">
        {FILTERS.map(([key, label]) => (
          <button key={key} type="button" className={filter === key ? "is-on" : ""} onClick={() => setFilter(key)}>{label} ({counts[key]})</button>
        ))}
      </div>
      {rows.map(({ guest: item, bookings: itemBookings, status: itemStatus, docs }) => (
        <button key={item.id} type="button" className="mapp-line" onClick={() => openGuest(item)}>
          <span className="mapp-avatar">{(item.name || "?").slice(0, 1).toUpperCase()}</span>
          <span className="mapp-grow">
            <strong>{item.name}</strong>
            <span className="sub">{item.phone || "—"} · {locationOf(item)}</span>
            <span className="sub">{documentsMode ? `${docs.length ? "Documents updated" : "No documents"} · ${DOC_TYPES.filter(([label]) => docs.some((doc) => docKind(doc.kind) === label)).length}/4` : `${itemBookings.length} booking${itemBookings.length === 1 ? "" : "s"}`}</span>
          </span>
          <span className={`mapp-lead is-${docs.length && documentsMode ? "confirmed" : tone(itemStatus)}`}>{docs.length && documentsMode ? "Updated" : itemStatus}</span>
        </button>
      ))}
      {!rows.length ? <p className="sub">No customers in this list.</p> : null}
    </>
  );
}

function crmRows(state) {
  return (state.guests || []).map((guest) => ({
    guest,
    status: derivedStatus(guest, guestBookings(guest, state)),
  }));
}

function CountList({ title, note, groups }) {
  const [open, setOpen] = useState("");
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0);
  return (
    <>
      <h1>{title}</h1>
      <p className="sub">{note}</p>
      <section className="mapp-card mapp-crm-total"><strong>{total}</strong><span>Customers</span></section>
      {groups.map((group) => (
        <section key={group.name}>
          <button type="button" className="mapp-crm-count" onClick={() => setOpen(open === group.name ? "" : group.name)}>
            <span className={`mapp-lead is-${group.tone || "new"}`}>{group.name}</span>
            <strong>{group.rows.length}</strong>
          </button>
          {open === group.name ? (
            group.rows.length ? group.rows.map(({ guest }) => (
              <article key={guest.id} className="mapp-card mapp-crm-head">
                <span className="mapp-avatar">{(guest.name || "?").slice(0, 1).toUpperCase()}</span>
                <span>
                  <strong>{guest.name || "Guest"}</strong>
                  <span className="sub">{guest.phone || "—"} · {locationOf(guest)}</span>
                </span>
              </article>
            )) : <p className="sub">No customers.</p>
          ) : null}
        </section>
      ))}
    </>
  );
}

export function LeadStatusPage({ state }) {
  const rows = crmRows(state);
  const known = new Set(LEAD_STATUSES);
  const extra = [...new Set(rows.map((row) => row.status).filter((name) => name && !known.has(name)))];
  return (
    <CountList
      title="Lead Status"
      note="How many customers are in each stage."
      groups={[...LEAD_STATUSES, ...extra].map((name) => ({
        name,
        tone: tone(name),
        rows: rows.filter((row) => row.status === name),
      }))}
    />
  );
}

export function SourcePage({ state }) {
  const rows = crmRows(state);
  const known = new Set(SOURCES.map((name) => name.toLowerCase()));
  const extra = [...new Set(rows.map((row) => String(row.guest.leadSource || "").trim()).filter((name) => name && !known.has(name.toLowerCase())))];
  const names = [...SOURCES, ...extra, "Not set"];
  return (
    <CountList
      title="Source"
      note="How did you know about Gayatri?"
      groups={names.map((name) => ({
        name,
        tone: "new",
        rows: rows.filter((row) => {
          const source = String(row.guest.leadSource || "").trim();
          if (name === "Not set") return !source;
          return source.toLowerCase() === name.toLowerCase();
        }),
      }))}
    />
  );
}
