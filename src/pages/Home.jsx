import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { publicAvailability } from "../engine";
import { termsLines } from "../seed";
import { addDays, enquiryAlertText, smsHref, telHref, todayISO, waMe } from "../lib";
import "../home.css";

const PAGES = [
  { id: "home", label: "Home" },
  { id: "about", label: "The Hall" },
  { id: "venues", label: "Venues" },
  { id: "packages", label: "Banquets" },
  { id: "gallery", label: "Gallery" },
  { id: "booking", label: "Book" },
  { id: "contact", label: "Visit" },
  { id: "terms", label: "Terms" },
  { id: "staff", label: "Staff" },
];

const DARK_PAGES = new Set(["home"]);

const IMG = "/site/images";

const FILM = [
  { src: `${IMG}/film/mandap.jpg`, alt: "Hindu marriage mandap" },
  { src: `${IMG}/film/agni.jpg`, alt: "Couple walking around the sacred fire" },
  { src: `${IMG}/gallery-3.jpg`, alt: "Indian Hindu wedding ceremony" },
  { src: `${IMG}/venue-garden.jpg`, alt: "Floral mandap and garden wedding" },
  { src: `${IMG}/hero.jpg`, alt: "Wedding celebration" },
];

const GALLERY = [
  { src: `${IMG}/gallery-1.jpg`, alt: "Couple at the venue" },
  { src: `${IMG}/gallery-2.jpg`, alt: "Garden ceremony" },
  { src: `${IMG}/gallery-3.jpg`, alt: "Wedding ceremony" },
  { src: `${IMG}/about.jpg`, alt: "Outdoor seating" },
];

function lakhs(n) {
  const v = n / 100000;
  return `₹${Number.isInteger(v) ? v : v.toFixed(1)}L`;
}

function sizeOf(capacity) {
  if (capacity > 800) return "large";
  if (capacity > 300) return "mid";
  return "intimate";
}

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  eventType: "",
  eventDate: todayISO(),
  guests: "",
  venue: "Any available",
  pkg: "",
  notes: "",
};

const DRAFT_KEY = "gayatri-book-draft";

function loadDraft() {
  const base = { ...emptyForm, eventDate: todayISO() };
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw);
    const eventDate = saved.eventDate && String(saved.eventDate) >= todayISO() ? saved.eventDate : todayISO();
    return { ...base, ...saved, eventDate };
  } catch {
    return base;
  }
}

function saveDraft(form) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  } catch {
    /* ignore quota */
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export default function Home({ state, onEnquire, onStaff }) {
  const p = state.property;
  const deckRef = useRef(null);
  const pageRef = useRef(0);
  const wheelLock = useRef(false);
  const [page, setPage] = useState(0);
  const [filmFrame, setFilmFrame] = useState(0);
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState(loadDraft);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [done, setDone] = useState(null);
  const [agreed, setAgreed] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  pageRef.current = page;

  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );

  const petals = useMemo(() => {
    const item = (kind) => ({
      kind,
      left: `${Math.random() * 100}%`,
      duration: `${7 + Math.random() * 7}s`,
      delay: `${-(Math.random() * 8)}s`,
      size: 0.75 + Math.random() * 0.55,
      drift: Math.round(-40 + Math.random() * 80),
    });
    return [
      ...Array.from({ length: 12 }, () => item("petal")),
      ...Array.from({ length: 6 }, () => item("gold")),
    ];
  }, []);

  const halls = state.halls
    .filter((h) => h.active !== false)
    .map((h) => ({
      ...h,
      size: sizeOf(h.capacity),
      jp: h.jp || h.kind,
      copy: h.copy || h.tag,
      photo: h.webPhoto || h.photo,
    }));
  const occasions = p.eventTypes?.length ? p.eventTypes : [];
  const mapQ = encodeURIComponent(p.mapQuery || (p.address || []).join(" ") || "Palagummi");

  const dateAvail = useMemo(
    () => publicAvailability(state, form.venue, form.eventDate),
    [state, form.venue, form.eventDate]
  );

  const availStrip = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const iso = addDays(todayISO(), i);
      const a = publicAvailability(state, form.venue, iso);
      const d = new Date(`${iso}T12:00:00`);
      return {
        iso,
        booked: a.blocked,
        wd: d.toLocaleDateString("en-IN", { weekday: "short" }),
        day: d.getDate(),
      };
    });
  }, [state, form.venue]);

  useLayoutEffect(() => {
    document.documentElement.classList.add("lux-page");
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/site/css/styles.css";
    link.dataset.lux = "1";
    document.head.appendChild(link);
    return () => {
      document.documentElement.classList.remove("lux-page");
      link.remove();
    };
  }, []);

  useEffect(() => {
    if (FILM.length < 2) return undefined;
    const timer = window.setInterval(() => setFilmFrame((i) => (i + 1) % FILM.length), 5200);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    document.title = p.name || "Gayatri | Marriage & Function Hall";
  }, [p.name]);

  useEffect(() => {
    document.querySelectorAll(".lux-root .reveal").forEach((el) => el.classList.add("is-in"));
  }, []);

  function goTo(id) {
    const deck = deckRef.current;
    const index = PAGES.findIndex((item) => item.id === id);
    if (!deck || index < 0) return;
    setPage(index);
    pageRef.current = index;
    deck.scrollTo({
      left: index * deck.clientWidth,
      behavior: reduceMotion ? "auto" : "smooth",
    });
    const hash = `#${id}`;
    if (window.location.hash !== hash) window.history.replaceState(null, "", hash);
  }

  function goBy(dir) {
    const next = Math.min(PAGES.length - 1, Math.max(0, pageRef.current + dir));
    goTo(PAGES[next].id);
  }

  useEffect(() => {
    const jump = () => {
      const id = window.location.hash.replace("#", "") || "home";
      if (!PAGES.some((item) => item.id === id)) return;
      window.requestAnimationFrame(() => goTo(id));
    };
    const t = window.setTimeout(jump, 80);
    window.addEventListener("hashchange", jump);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("hashchange", jump);
    };
  }, [reduceMotion]);

  useEffect(() => {
    const deck = deckRef.current;
    if (!deck) return undefined;
    const onScroll = () => {
      const i = Math.round(deck.scrollLeft / Math.max(deck.clientWidth, 1));
      const clamped = Math.min(PAGES.length - 1, Math.max(0, i));
      if (clamped !== pageRef.current) {
        setPage(clamped);
        pageRef.current = clamped;
      }
    };
    deck.addEventListener("scroll", onScroll, { passive: true });
    const onResize = () => {
      deck.scrollTo({ left: pageRef.current * deck.clientWidth });
    };
    window.addEventListener("resize", onResize);
    return () => {
      deck.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    const onWheel = (e) => {
      if (lightbox) return;
      if (e.target?.closest?.("input, textarea, select, .booking-form, .terms-page")) return;
      e.preventDefault();
      if (wheelLock.current) return;
      const delta = e.deltaY + e.deltaX;
      if (Math.abs(delta) < 24) return;
      wheelLock.current = true;
      goBy(delta > 0 ? 1 : -1);
      window.setTimeout(() => {
        wheelLock.current = false;
      }, 650);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setLightbox(null);
        return;
      }
      if (lightbox) return;
      if (e.target?.closest?.("input, textarea, select")) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        goBy(1);
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goBy(-1);
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", onWheel);
      document.removeEventListener("keydown", onKey);
    };
  }, [lightbox, reduceMotion]);

  useEffect(() => {
    saveDraft(form);
  }, [form]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  function goBooking(patch) {
    if (patch) setForm((f) => ({ ...f, ...patch }));
    goTo("booking");
  }

  function onPageNav(e, id) {
    e.preventDefault();
    goTo(id);
  }

  const currentId = PAGES[page]?.id || "home";
  const lightPage = !DARK_PAGES.has(currentId);

  return (
    <div className={`lux-root${lightPage ? " is-light" : ""}${currentId === "booking" ? " is-book" : ""}`}>
      <header className={`site-header${lightPage ? " scrolled" : ""}`} id="header">
        <a className="logo" href="#home" onClick={(e) => onPageNav(e, "home")}>
          <img className="logo-mark" src={`${IMG}/logo-mark.png`} alt="" />
          <span>
            <strong>{p.brandName || "Gayatri"}</strong>
            <em>{p.place || ""}</em>
          </span>
        </a>
        <nav className="site-nav" aria-label="Site">
          {PAGES.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={currentId === item.id ? "is-on" : ""}
              onClick={(e) => onPageNav(e, item.id)}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <a className="btn btn-gold" href="#booking" onClick={(e) => onPageNav(e, "booking")}>
            Book Now <span>↗</span>
          </a>
        </div>
      </header>

      <main className="lux-deck" ref={deckRef}>
        <section className="hero" id="home">
          <div className="hero-film" aria-hidden="true">
            <div className="hero-aurora"></div>
            <div className="hero-rays"></div>
            {FILM.map((frame, i) => (
              <img
                key={frame.src}
                className={`film-slide${i === filmFrame ? " is-on" : ""}`}
                src={frame.src}
                alt=""
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ))}
            <div className="hero-film-shade"></div>
          </div>
          <div className="petals" aria-hidden="true">
            {petals.map((petal, i) => (
              <span
                key={i}
                className={`rose-fall is-${petal.kind}`}
                style={{
                  left: petal.left,
                  animationDuration: petal.duration,
                  animationDelay: petal.delay,
                  "--s": petal.size,
                  "--drift": petal.drift,
                }}
              />
            ))}
          </div>
          <div className="hero-glow" aria-hidden="true"></div>
          <div className="hero-brand">
            <figure className="hero-emblem-wrap">
              <img className="hero-emblem" src={`${IMG}/logo-gold.png`} alt={p.brandName || "Gayatri"} />
            </figure>
            <p className="hero-kicker">{p.tagline || "Marriage & Function Hall"}</p>
            <h1>{p.brandName || "Gayatri"}</h1>
            <p className="hero-place">{p.place}</p>
            <p className="swipe-hint">Swipe or use the arrows</p>
          </div>
        </section>

        <section className="intro reveal" id="about">
          <p className="ghost-title">Exclusive getaway in</p>
          <div className="intro-layout">
            <p className="intro-copy">
              {p.about}
            </p>
            <div className="intro-photos">
              <img className="photo-back" src={`${IMG}/gallery-5.jpg`} alt="Evening reception tables" />
              <img className="photo-front" src={`${IMG}/gallery-1.jpg`} alt="Couple celebrating" />
            </div>
          </div>
        </section>

        <section className="locations reveal" id="venues">
          <p className="crumb">Home / Banquets</p>
          <h2 className="page-title">Wedding Reception</h2>
          <p className="page-sub">Banquet</p>
          <div className="filters">
            <p>Filter by category</p>
            <div className="filter-row">
              {[
                ["all", "all"],
                ["large", "800+ guests"],
                ["mid", "300 – 800"],
                ["intimate", "up to 300"],
              ].map(([id, label]) => (
                <button key={id} type="button" className={filter === id ? "is-active" : ""} onClick={() => setFilter(id)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="venue-grid">
            {halls.map((h) => (
              <article key={h.id} className="venue-card" hidden={filter !== "all" && h.size !== filter}>
                <img src={h.photo} alt={h.name} />
                <p className="venue-jp">{h.jp}</p>
                <h3>{h.name}</h3>
                <p>{h.copy}</p>
                <p className="capacity">
                  Capacity <span>|</span> Maximum {h.capacity.toLocaleString("en-IN")} people
                </p>
                {(() => {
                  const todayHold = publicAvailability(state, h.name, todayISO());
                  const w = todayHold.rows[0]?.windows[0];
                  return todayHold.blocked ? (
                    <p className="venue-hold">Booked today {w ? `· ${w.windowLabel || `${w.startLabel} – ${w.endLabel}`}` : ""}</p>
                  ) : (
                    <p className="venue-hold is-free">Free today</p>
                  );
                })()}
                <button type="button" className="text-link" onClick={() => goBooking({ venue: h.name })}>
                  Reserve this hall
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="banquets reveal" id="packages">
          <div className="banquet-head">
            <h2>
              Bespoke banquets<span className="dot"></span>
            </h2>
            <p className="script-line">hall packages</p>
          </div>
          <div className="banquet-layout">
            <img className="banquet-wide" src={`${IMG}/gallery-5.jpg`} alt="Banquet table setting" />
            <div className="banquet-side">
              <img src={`${IMG}/gallery-4.jpg`} alt="Floral décor" />
              <p>
                {p.banquetIntro}
              </p>
              <p>Our desk will help you plan timings, rooms, and hall setup for the day.</p>
              <div className="package-row">
                {state.packages.map((pkg) => (
                  <button key={pkg.id} type="button" onClick={() => goBooking({ pkg: pkg.name })}>
                    {pkg.name} · from {lakhs(pkg.price)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="gallery reveal" id="gallery">
          <p className="kicker">Gallery</p>
          <div className="gallery-strip">
            {GALLERY.map((item) => (
              <button
                key={item.src}
                type="button"
                className="gallery-item"
                onClick={() => setLightbox(item)}
              >
                <img src={item.src} alt={item.alt} />
              </button>
            ))}
          </div>
        </section>

        <section className="organize reveal" id="booking">
          <div className="book-shell">
          <div className="book-head">
            <h2>Book your event</h2>
            <p>Details stay saved if you leave this page.</p>
          </div>
          {done ? (
            <div className="book-sent">
              <p className="home-ok">
                Thank you. Request {done.number} is saved at the desk
                {state.property.notifyWhatsApp !== false ? " and WhatsApp should open so you can send it to us." : "."}
              </p>
              <div className="book-sent-actions">
                {done.wa ? (
                  <a className="btn btn-gold" href={done.wa} target="_blank" rel="noreferrer">
                    Send on WhatsApp
                  </a>
                ) : null}
                {done.tel ? (
                  <a className="btn btn-ghost dark" href={done.tel}>
                    Call {done.desk}
                  </a>
                ) : null}
                {done.sms ? (
                  <a className="btn btn-ghost dark" href={done.sms}>
                    Send SMS
                  </a>
                ) : null}
              </div>
            </div>
          ) : (
            <form
              className="booking-form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                const phoneOk = /^[0-9+\-\s]{10,15}$/.test(form.phone.trim());
                if (!form.name.trim() || !form.email.trim() || !form.eventType || !form.eventDate || !form.guests || !phoneOk) {
                  setError(phoneOk ? "Please complete the required fields." : "Enter a valid 10-digit phone number.");
                  return;
                }
                if (dateAvail.blocked) {
                  setError(dateAvail.message);
                  return;
                }
                if (!agreed) {
                  setError("Please read and agree to the terms and conditions.");
                  return;
                }
                setError("");
                const wishes = [form.pkg && `Package: ${form.pkg}`, form.notes].filter(Boolean).join(" — ");
                const payload = {
                  name: form.name.trim(),
                  phone: form.phone.trim(),
                  email: form.email.trim(),
                  date: form.eventDate,
                  hall: form.venue,
                  guests: form.guests,
                  type: form.eventType,
                  message: wishes,
                };
                const out = onEnquire(payload);
                if (out?.error) {
                  setError(out.error);
                  return;
                }
                if (!out?.booking?.number) return;
                const desk = state.property.notifyPhone || state.property.phone || "+91 98496 00555";
                const text = enquiryAlertText({ ...payload, number: out.booking.number });
                const wa = waMe(desk, text);
                const sent = { number: out.booking.number, wa, sms: smsHref(desk, text), tel: telHref(desk), desk };
                setDone(sent);
                setAgreed(false);
                setToast(`Thank you, ${payload.name.split(" ")[0]}. Opening WhatsApp to the desk.`);
                clearDraft();
                setForm({ ...emptyForm, eventDate: todayISO() });
                if (state.property.notifyWhatsApp !== false && wa) {
                  window.setTimeout(() => window.open(wa, "_blank", "noopener,noreferrer"), 200);
                }
              }}
            >
              <div className="field">
                <label htmlFor="name">Full name *</label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder="e.g. Ananya Reddy"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="phone">Mobile *</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="10-digit number"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="email">Email *</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@email.com"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="eventType">Occasion *</label>
                <select
                  id="eventType"
                  name="eventType"
                  required
                  value={form.eventType}
                  onChange={(e) => setForm({ ...form, eventType: e.target.value })}
                >
                  <option value="">Choose occasion</option>
                  {occasions.map((ev) => (
                    <option key={ev}>{ev}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="guests">Guests *</label>
                <input
                  id="guests"
                  name="guests"
                  type="number"
                  min="30"
                  max="1500"
                  placeholder="e.g. 400"
                  required
                  value={form.guests}
                  onChange={(e) => setForm({ ...form, guests: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="eventDate">Date *</label>
                <input
                  id="eventDate"
                  name="eventDate"
                  type="date"
                  required
                  min={todayISO()}
                  value={form.eventDate}
                  onChange={(e) => {
                    setError("");
                    setForm({ ...form, eventDate: e.target.value });
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="package">Package</label>
                <select
                  id="package"
                  name="package"
                  value={form.pkg}
                  onChange={(e) => setForm({ ...form, pkg: e.target.value })}
                >
                  <option value="">Help me choose</option>
                  {state.packages.map((pkg) => (
                    <option key={pkg.id}>{pkg.name}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="notes">Wishes</label>
                <input
                  id="notes"
                  name="notes"
                  type="text"
                  placeholder="Mandap, rooms…"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <div className="hall-picks">
                <button
                  type="button"
                  className={`hall-pick${form.venue === "Any available" ? " is-on" : ""}`}
                  onClick={() => {
                    setError("");
                    setForm((f) => ({ ...f, venue: "Any available" }));
                  }}
                >
                  <strong>Any hall</strong>
                  <em>We choose</em>
                </button>
                {halls.map((h) => {
                  const hold = publicAvailability(state, h.name, form.eventDate);
                  return (
                    <button
                      key={h.id}
                      type="button"
                      title={h.name}
                      className={`hall-pick${form.venue === h.name ? " is-on" : ""}${hold.blocked ? " is-held" : ""}`}
                      onClick={() => {
                        setError("");
                        setForm((f) => ({ ...f, venue: h.name }));
                      }}
                    >
                      <strong>{h.name.split(" ")[0]}</strong>
                      <em>{hold.blocked ? "Booked" : "Free"}</em>
                    </button>
                  );
                })}
              </div>

              <div className="avail-board">
                <p className={`avail-status ${dateAvail.blocked ? "is-booked" : "is-free"}`}>
                  {dateAvail.blocked
                    ? dateAvail.message
                    : dateAvail.anyBooked
                      ? `Hold: ${dateAvail.rows
                          .filter((r) => r.booked)
                          .map((r) => {
                            const w = r.windows[0];
                            return w
                              ? `${r.hallName} ${w.windowLabel || `${w.startLabel} – ${w.endLabel}`}`
                              : r.hallName;
                          })
                          .join(" · ")}`
                      : `${form.venue === "Any available" ? "All halls" : form.venue} — free`}
                </p>
                <div className="avail-days" role="list">
                  {availStrip.map((d) => (
                    <button
                      key={d.iso}
                      type="button"
                      role="listitem"
                      aria-label={`${d.iso} ${d.booked ? "booked" : "free"}`}
                      className={`avail-day${d.booked ? " is-booked" : ""}${d.iso === form.eventDate ? " is-on" : ""}`}
                      onClick={() => {
                        setError("");
                        setForm((f) => ({ ...f, eventDate: d.iso }));
                      }}
                    >
                      <span>{d.wd}</span>
                      <strong>{d.day}</strong>
                    </button>
                  ))}
                </div>
              </div>
              {error ? <p className="form-error">{error}</p> : null}
              <label className="book-agree">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => {
                    setAgreed(e.target.checked);
                    if (e.target.checked) setError("");
                  }}
                />
                <span>
                  I have read and agree to the{" "}
                  <a href="#terms" onClick={(e) => onPageNav(e, "terms")}>
                    terms and conditions
                  </a>
                  .
                </span>
              </label>
              <button className="btn btn-gold full" type="submit" disabled={dateAvail.blocked}>
                {dateAvail.blocked ? "Choose a free date" : "Send booking request"}
              </button>
            </form>
          )}
          </div>
        </section>

        <section className="contact reveal" id="contact">
          <p className="kicker">Visit</p>
          <h2>{p.name}</h2>
          <address>
            {(p.address || []).map(
              (line) => (
                <span key={line}>
                  {line}
                  <br />
                </span>
              )
            )}
          </address>
          <p>{p.desk}</p>
          <p>
            <a href={`tel:${(p.phone || "").replace(/\s/g, "")}`}>{p.phone}</a>
            {" · "}
            <a href={`mailto:${p.email}`}>{p.email}</a>
          </p>
          <div className="map-wrap">
            <iframe
              title={`${p.name} on Google Maps`}
              src={`https://maps.google.com/maps?q=${mapQ}&z=15&hl=en&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
          <div className="contact-actions">
            <a
              className="btn btn-ghost dark"
              href={`https://www.google.com/maps/search/?api=1&query=${mapQ}`}
              target="_blank"
              rel="noreferrer"
            >
              Open in Google Maps <span>↗</span>
            </a>
            <a className="btn btn-gold" href="/Gayatri-Brochure.pdf" download>
              Download brochure PDF
            </a>
          </div>
        </section>

        <section className="contact terms-page reveal" id="terms">
          <p className="kicker">Terms</p>
          <h2>Terms and conditions</h2>
          <p className="page-sub">
            These apply to hall hire and guest rooms at {p.name}. Catering, decoration, DJ and photography are not provided by the hall.
          </p>
          <ol className="terms-copy">
            {termsLines(p).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </section>

        <section className="contact staff-gate reveal" id="staff">
          <p className="kicker">Staff</p>
          <h2>Hall desk</h2>
          <p className="page-sub">
            For the Gayatri team. Open the calendar, rooms, reservations, and payments.
          </p>
          <p>{p.desk}</p>
          <div className="contact-actions">
            <button type="button" className="btn btn-gold" onClick={onStaff}>
              Enter staff desk
            </button>
          </div>
          <footer className="site-footer">
            <a className="logo" href="#home" onClick={(e) => onPageNav(e, "home")}>
              <strong>{p.brandName || "Gayatri"}</strong>
              <em>{p.place}</em>
            </a>
            <p>
              © {new Date().getFullYear()} {p.name}
              {" · "}
              <a href="#terms" onClick={(e) => onPageNav(e, "terms")}>Terms</a>
            </p>
          </footer>
        </section>
      </main>

      <div className="lightbox" hidden={!lightbox} onClick={() => setLightbox(null)}>
        <button
          type="button"
          className="lightbox-close"
          aria-label="Close image"
          onClick={(e) => {
            e.stopPropagation();
            setLightbox(null);
          }}
        >
          ×
        </button>
        {lightbox ? <img src={lightbox.src} alt={lightbox.alt} onClick={(e) => e.stopPropagation()} /> : null}
      </div>
      <button
        type="button"
        className="slide-arrow prev"
        aria-label="Previous page"
        disabled={page === 0}
        onClick={() => goBy(-1)}
      >
        ‹
      </button>
      <button
        type="button"
        className="slide-arrow next"
        aria-label="Next page"
        disabled={page === PAGES.length - 1}
        onClick={() => goBy(1)}
      >
        ›
      </button>
      <a className="to-top" href="#home" aria-label="Go to home" onClick={(e) => onPageNav(e, "home")}>
        ⌃<span>Home</span>
      </a>
      <div className="toast" hidden={!toast}>
        {toast}
      </div>
    </div>
  );
}
