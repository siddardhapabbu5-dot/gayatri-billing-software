import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { publicAvailability } from "../engine";
import { TERM_LANGS, TERM_SECTIONS, sectionLines, termLocaleOf } from "../policies";
import { addDays, capacityText, enquiryAlertText, mapEmbedSrc, mapGoogleUrl, money, monthMatrix, pad, parseISO, smsHref, telHref, todayISO, waMe } from "../lib";
import RetreatOffer from "./RetreatOffer.jsx";
import "../home.css";

const PAGES = [
  { id: "home", label: "Home" },
  { id: "about", label: "The Hall" },
  { id: "venues", label: "Venues" },
  { id: "stay", label: "The Royal Family Retreat" },
  { id: "stay-space", label: "The Royal Family Retreat", hideNav: true },
  { id: "gallery", label: "Gallery" },
  { id: "booking", label: "Book" },
  { id: "contact", label: "Visit" },
  { id: "terms", label: "Terms" },
  { id: "staff", label: "Staff" },
];

const DARK_PAGES = new Set(["home"]);

const IMG = "/site/images";

const FILM = [
  { src: `${IMG}/film/mandap.jpg`, alt: "Convention hall interior" },
  { src: `${IMG}/film/agni.jpg`, alt: "Hall stage and lighting" },
  { src: `${IMG}/gallery-3.jpg`, alt: "Delegates in the hall" },
  { src: `${IMG}/venue-garden.jpg`, alt: "Garden pavilion for outdoor sessions" },
  { src: `${IMG}/hero.jpg`, alt: "Evening programme at the hall" },
];

const GALLERY = [
  {
    src: `${IMG}/gallery/videos/gayatri-convention-reel.mp4`,
    poster: `${IMG}/gallery/aerial-dusk-grove.jpg`,
    alt: "Gayatri Convention highlight reel",
    label: "Gayatri Convention reel",
    span: "hero",
    kind: "video",
  },
  {
    src: `${IMG}/gallery/videos/drone-night-flyover.mp4`,
    poster: `${IMG}/gallery/aerial-night-front.jpg`,
    alt: "Night drone flyover of Gayatri Convention",
    label: "Night flyover",
    span: "tall",
    kind: "video",
  },
  {
    src: `${IMG}/gallery/videos/drone-approach-lights.mp4`,
    poster: `${IMG}/gallery/aerial-night-side.jpg`,
    alt: "Drone approach with fairy lights and parking",
    label: "Approach at night",
    kind: "video",
  },
  {
    src: `${IMG}/gallery/videos/drone-courtyard-night.mp4`,
    poster: `${IMG}/gallery/aerial-night-top.jpg`,
    alt: "Courtyard and halls from the air at night",
    label: "Courtyard night",
    kind: "video",
  },
  {
    src: `${IMG}/gallery/aerial-dusk-grove.jpg`,
    alt: "Gayatri Convention at dusk among the palm grove",
    label: "Dusk over the grove",
    kind: "image",
  },
  {
    src: `${IMG}/gallery/imperial-hall-ceremony.jpg`,
    alt: "Imperial Ballroom filled for a ceremony",
    label: "Imperial Ballroom",
    kind: "image",
  },
  {
    src: `${IMG}/gallery/aerial-night-side.jpg`,
    alt: "Night aerial of the lit convention complex",
    label: "Night lights",
    kind: "image",
  },
  {
    src: `${IMG}/gallery/aerial-night-front.jpg`,
    alt: "Front aerial of Gayatri Convention at night",
    label: "The approach",
    kind: "image",
  },
  {
    src: `${IMG}/gallery/aerial-night-top.jpg`,
    alt: "Top-down night view of halls, courtyard and parking",
    label: "Full campus",
    kind: "image",
  },
  {
    src: `${IMG}/gallery/evening-buffet-crowd.jpg`,
    alt: "Evening buffet and guests outside the hall",
    label: "An evening in motion",
    kind: "image",
  },
];

function isGalleryVideo(item) {
  return item?.kind === "video" || /\.(mp4|mov|webm|m4v)$/i.test(item?.src || "");
}

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  eventType: "",
  eventDate: todayISO(),
  guests: "",
  venue: "",
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
    const venue = saved.venue && saved.venue !== "Any available" ? saved.venue : "";
    return { ...base, ...saved, eventDate, venue };
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
  const [form, setForm] = useState(loadDraft);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [done, setDone] = useState(null);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [termLang, setTermLang] = useState("en");
  const [termLangOpen, setTermLangOpen] = useState(false);
  const termLangDropRef = useRef(null);
  const [lightbox, setLightbox] = useState(null);
  const [availView, setAvailView] = useState("month");
  const [availMonth, setAvailMonth] = useState(() => todayISO().slice(0, 7));
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
      jp: h.jp || h.kind,
      copy: h.copy || h.tag,
      photo: h.webPhoto || h.photo,
    }));
  const occasions = p.eventTypes?.length ? p.eventTypes : [];
  const mapSrc = mapEmbedSrc(p);
  const mapLink = mapGoogleUrl(p);
  const termLoc = termLocaleOf(p, termLang);
  const termLangLabel = TERM_LANGS.find((l) => l.id === termLang)?.label || "English";

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

  const availMonthCells = useMemo(() => {
    const [y, m] = availMonth.split("-").map(Number);
    const today = todayISO();
    const cells = monthMatrix(y, m - 1);
    return cells.map((day) => {
      if (!day) return null;
      const iso = `${y}-${pad(m)}-${pad(day)}`;
      if (iso < today) return { iso, day, past: true, booked: false };
      const a = publicAvailability(state, form.venue, iso);
      return { iso, day, past: false, booked: a.blocked };
    });
  }, [state, form.venue, availMonth]);

  const availMonthLabel = useMemo(() => {
    const d = parseISO(`${availMonth}-01`);
    return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
  }, [availMonth]);

  function shiftAvailMonth(n) {
    const d = parseISO(`${availMonth}-01`);
    d.setMonth(d.getMonth() + n);
    setAvailMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  }

  useEffect(() => {
    if (form.eventDate && form.eventDate.length >= 7) {
      setAvailMonth(form.eventDate.slice(0, 7));
    }
  }, [form.eventDate]);

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
    document.title = p.name || "Gayatri | Convention";
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
      const sheet = e.target?.closest?.(".terms-scroll");
      if (sheet) {
        const { scrollTop, scrollHeight, clientHeight } = sheet;
        const dy = e.deltaY + e.deltaX;
        if (scrollHeight > clientHeight + 4) {
          if (dy > 0 && scrollTop + clientHeight < scrollHeight - 2) return;
          if (dy < 0 && scrollTop > 2) return;
        }
      }
      if (e.target?.closest?.("input, textarea, select, .booking-form")) return;
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
      if (lightbox) {
        if (e.key === "ArrowRight" || e.key === "PageDown") {
          e.preventDefault();
          const i = (lightbox.index + 1) % GALLERY.length;
          setLightbox({ ...GALLERY[i], index: i });
        }
        if (e.key === "ArrowLeft" || e.key === "PageUp") {
          e.preventDefault();
          const i = (lightbox.index - 1 + GALLERY.length) % GALLERY.length;
          setLightbox({ ...GALLERY[i], index: i });
        }
        return;
      }
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

  useEffect(() => {
    if (PAGES[page]?.id !== "terms") return;
    const sheet = document.querySelector("#terms .terms-scroll");
    if (sheet) sheet.scrollTop = 0;
  }, [page, termLang]);

  useEffect(() => {
    setTermLangOpen(false);
  }, [page]);

  useEffect(() => {
    if (!termLangOpen) return undefined;
    const close = (e) => {
      if (termLangDropRef.current && !termLangDropRef.current.contains(e.target)) {
        setTermLangOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [termLangOpen]);

  function goBooking(patch) {
    if (patch) setForm((f) => ({ ...f, ...patch }));
    goTo("booking");
  }

  function onPageNav(e, id) {
    e.preventDefault();
    goTo(id);
  }

  function scrollToTermSection(id) {
    const sheet = document.querySelector("#terms .terms-scroll");
    const el = document.querySelector(`#terms-${id}`);
    if (!sheet || !el) return;
    const top = el.getBoundingClientRect().top - sheet.getBoundingClientRect().top + sheet.scrollTop - 10;
    sheet.scrollTo({ top, behavior: "smooth" });
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
            <em>{currentId.startsWith("stay") ? "The Royal Family Retreat" : (p.place || "")}</em>
          </span>
        </a>
        <nav className="site-nav" aria-label="Site">
          {PAGES.filter((item) => !item.hideNav).map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={[
                item.id === "stay" ? "stay-nav" : "",
                item.id === "stay" ? (currentId.startsWith("stay") ? "is-on" : "") : currentId === item.id ? "is-on" : "",
              ].filter(Boolean).join(" ")}
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
            <h1>{p.brandName || "Gayatri"}</h1>
            <div className="hero-offers">
              <p>Convention</p>
              <p>Luxury banquets</p>
              <p>Resorts</p>
            </div>
            <p className="hero-place">{p.place}</p>
          </div>
        </section>

        <section className="intro reveal" id="about">
          <p className="ghost-title">Exclusive getaway in</p>
          <div className="intro-layout">
            <p className="intro-copy">
              {p.about}
            </p>
            <div className="intro-photos">
              <img className="photo-back" src={`${IMG}/gallery-5.jpg`} alt="Hall dining setup" />
              <img className="photo-front" src={`${IMG}/gallery-1.jpg`} alt="Delegates at the venue" />
            </div>
          </div>
        </section>

        <section className="locations reveal" id="venues">
          <p className="crumb">Home / Halls</p>
          <h2 className="page-title">Convention halls</h2>
          <p className="page-sub">Venues</p>
          <div className="venue-grid">
            {halls.map((h) => (
              <article key={h.id} className="venue-card">
                <img src={h.photo} alt={h.name} />
                <p className="venue-jp">{h.jp}</p>
                <h3>{h.name}</h3>
                <p className="venue-copy">{h.copy}</p>
                <p className="capacity">
                  Capacity <span>|</span> {capacityText(h)}
                </p>
                {(() => {
                  const cur = p.currency || "INR";
                  const loc = p.locale || "en-IN";
                  const slots = [
                    ["Half day", h.rates?.halfDay],
                    ["Full day", h.rates?.fullDay],
                  ].filter(([, amount]) => Number(amount) > 0);
                  if (!slots.length) return null;
                  return (
                    <ul className="venue-packages">
                      {slots.map(([label, amount]) => (
                        <li key={label}>
                          <span>{label}</span>
                          <strong>{money(amount, cur, loc)}</strong>
                        </li>
                      ))}
                    </ul>
                  );
                })()}
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

        <section className="stay-page stay-hero-page reveal" id="stay">
          <RetreatOffer
            part="hero"
            onBook={() =>
              goBooking({
                eventType: "Family retreat",
                notes: "Royal Family Retreat — ₹30,000 · 4 rooms, kitchen, dining hall, lobby",
                guests: "8",
              })
            }
          />
        </section>

        <section className="stay-page stay-story-page reveal" id="stay-space">
          <RetreatOffer part="space" />
        </section>

        <section className="gallery reveal" id="gallery">
          <p className="kicker">Gallery</p>
          <h2 className="gallery-title">Seen from the sky, felt in the hall</h2>
          <p className="gallery-lead">Night lights, full ceremonies, and the grove around Palagummi. Tap a photo or video to open it.</p>
          <div className="gallery-mosaic">
            {GALLERY.map((item, index) => (
              <button
                key={item.src}
                type="button"
                className={`gallery-item${item.span ? ` is-${item.span}` : ""}${isGalleryVideo(item) ? " is-video" : ""}`}
                style={{ "--i": index }}
                onClick={() => setLightbox({ ...item, index })}
              >
                {isGalleryVideo(item) ? (
                  <video
                    src={item.src}
                    poster={item.poster || undefined}
                    muted
                    playsInline
                    preload="metadata"
                    aria-label={item.alt}
                  />
                ) : (
                  <img src={item.src} alt={item.alt} loading="lazy" />
                )}
                <span className="gallery-caption">
                  {isGalleryVideo(item) ? <em className="gallery-play">Play</em> : null}
                  {item.label}
                </span>
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
                <button type="button" className="btn btn-ghost dark" onClick={() => setDone(null)}>
                  Back
                </button>
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
                if (!form.venue) {
                  setError("Please select a hall.");
                  return;
                }
                if (!form.name.trim() || !form.email.trim() || !form.eventType || !form.eventDate || !form.guests || !phoneOk) {
                  setError(phoneOk ? "Please complete the required fields." : "Enter a valid 10-digit phone number.");
                  return;
                }
                if (dateAvail.blocked) {
                  setError(dateAvail.message);
                  return;
                }
                if (!agreedTerms) {
                  setError("Please read and agree to the Terms & Conditions.");
                  return;
                }
                setError("");
                const wishes = form.notes.trim();
                const payload = {
                  name: form.name.trim(),
                  phone: form.phone.trim(),
                  email: form.email.trim(),
                  date: form.eventDate,
                  hall: form.venue,
                  guests: form.guests,
                  type: form.eventType,
                  message: wishes,
                  agreeHall: true,
                  agreeRoom: true,
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
                setAgreedTerms(false);
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
                <label htmlFor="eventType">Event type *</label>
                <select
                  id="eventType"
                  name="eventType"
                  required
                  value={form.eventType}
                  onChange={(e) => setForm({ ...form, eventType: e.target.value })}
                >
                  <option value="">Choose event type</option>
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
                <label htmlFor="notes">Notes</label>
                <input
                  id="notes"
                  name="notes"
                  type="text"
                  placeholder="Hall setup, rooms…"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>

              <label className="hall-picks-label">Hall *</label>
              <div className="hall-picks">
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
                <div className="avail-board-head">
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
                        : form.venue
                          ? `${form.venue} — free`
                          : "Select a hall to check availability"}
                  </p>
                  <div className="avail-view-toggle" role="group" aria-label="Calendar view">
                    <button
                      type="button"
                      className={availView === "month" ? "is-on" : ""}
                      onClick={() => setAvailView("month")}
                    >
                      Month
                    </button>
                    <button
                      type="button"
                      className={availView === "strip" ? "is-on" : ""}
                      onClick={() => setAvailView("strip")}
                    >
                      14 days
                    </button>
                  </div>
                </div>

                {availView === "month" ? (
                  <div className="avail-month">
                    <div className="avail-month-nav">
                      <button type="button" className="avail-month-shift" onClick={() => shiftAvailMonth(-1)} aria-label="Previous month">
                        ‹
                      </button>
                      <strong>{availMonthLabel}</strong>
                      <button type="button" className="avail-month-shift" onClick={() => shiftAvailMonth(1)} aria-label="Next month">
                        ›
                      </button>
                    </div>
                    <div className="avail-month-grid" role="grid" aria-label="Availability calendar">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((w) => (
                        <span key={w} className="avail-wd">
                          {w}
                        </span>
                      ))}
                      {availMonthCells.map((cell, i) =>
                        !cell ? (
                          <span key={`e${i}`} className="avail-day is-empty" />
                        ) : (
                          <button
                            key={cell.iso}
                            type="button"
                            disabled={cell.past}
                            aria-label={`${cell.iso} ${cell.past ? "past" : cell.booked ? "booked" : "free"}`}
                            className={`avail-day${cell.booked ? " is-booked" : ""}${cell.past ? " is-past" : ""}${
                              cell.iso === form.eventDate ? " is-on" : ""
                            }`}
                            onClick={() => {
                              if (cell.past) return;
                              setError("");
                              setForm((f) => ({ ...f, eventDate: cell.iso }));
                            }}
                          >
                            <strong>{cell.day}</strong>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ) : (
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
                )}
              </div>
              {error ? <p className="form-error">{error}</p> : null}
              <label className="book-agree">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => {
                    setAgreedTerms(e.target.checked);
                    if (e.target.checked) setError("");
                  }}
                />
                <span>
                  I have read and agree to the{" "}
                  <a href="#terms" onClick={(e) => onPageNav(e, "terms")}>Terms & Conditions</a>
                  {" "}(English · తెలుగు · हिन्दी).
                </span>
              </label>
              <button className="btn btn-gold full" type="submit" disabled={dateAvail.blocked || !form.venue}>
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
              title="Gayatri Water and Beverages, Palagummi on Google Maps"
              src={mapSrc}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
          <div className="contact-actions">
            <a
              className="btn btn-ghost dark"
              href={mapLink}
              target="_blank"
              rel="noreferrer"
            >
              Open in Google Maps <span>↗</span>
            </a>
            <a className="btn btn-gold" href="/Gayatri-Brochure.pdf?v=20260902d" download="Gayatri-Brochure.pdf">
              Download brochure PDF
            </a>
          </div>
        </section>

        <section className="terms-page reveal" id="terms">
          <div className="terms-panel">
            <header className={`terms-banner lang-${termLang}`}>
              <div className="terms-banner-inner">
                <h2>{termLoc.ui.title}</h2>
              </div>
            </header>
            <div className="terms-body">
              <aside className="terms-side" aria-label="Terms navigation">
                <div className="terms-lang-drop" ref={termLangDropRef}>
                  <button
                    type="button"
                    className={`terms-lang-trigger${termLangOpen ? " is-open" : ""}`}
                    aria-expanded={termLangOpen}
                    aria-haspopup="listbox"
                    onClick={() => setTermLangOpen((open) => !open)}
                  >
                    <span className="terms-lang-kicker">{termLoc.ui.langLabel}</span>
                    <span className="terms-lang-current">{termLangLabel}</span>
                    <span className="terms-lang-chevron" aria-hidden="true" />
                  </button>
                  {termLangOpen && (
                    <ul className="terms-lang-menu" role="listbox" aria-label={termLoc.ui.langLabel}>
                      {TERM_LANGS.map((l) => (
                        <li key={l.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={termLang === l.id}
                            className={termLang === l.id ? "is-on" : ""}
                            onClick={() => {
                              setTermLang(l.id);
                              setTermLangOpen(false);
                            }}
                          >
                            {l.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <nav className={`terms-toc lang-${termLang}`} aria-label={termLoc.ui.tocLabel}>
                  <p className="terms-toc-kicker">{termLoc.ui.tocLabel}</p>
                  {TERM_SECTIONS.map((sec, i) => {
                    const lines = sectionLines(termLoc.sections[sec.id], p);
                    if (!lines.length) return null;
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        className="terms-toc-item"
                        onClick={() => scrollToTermSection(sec.id)}
                      >
                        <span className="terms-toc-num">{String(i + 1).padStart(2, "0")}</span>
                        <span className="terms-toc-label">{termLoc.labels[sec.id] || sec.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </aside>
              <div className="terms-scroll">
                <div className={`terms-articles lang-${termLang}`}>
                  {TERM_SECTIONS.map((sec, i) => {
                    const lines = sectionLines(termLoc.sections[sec.id], p);
                    if (!lines.length) return null;
                    return (
                      <article key={sec.id} id={`terms-${sec.id}`} className="terms-article">
                        <div className="terms-article-num">{String(i + 1).padStart(2, "0")}</div>
                        <div className="terms-article-body">
                          <h3>{termLoc.labels[sec.id] || sec.label}</h3>
                          <ul className="terms-list">
                            {lines.map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        </div>
                      </article>
                    );
                  })}
                  <p className={`terms-foot lang-${termLang}`}>{termLoc.ui.disclaimer}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="contact staff-gate reveal" id="staff">
          <p className="kicker">Staff</p>
          <h2>Convention desk</h2>
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
        {lightbox ? (
          <>
            <button
              type="button"
              className="lightbox-nav prev"
              aria-label="Previous photo"
              onClick={(e) => {
                e.stopPropagation();
                const i = (lightbox.index - 1 + GALLERY.length) % GALLERY.length;
                setLightbox({ ...GALLERY[i], index: i });
              }}
            >
              ‹
            </button>
            <figure className="lightbox-frame" onClick={(e) => e.stopPropagation()}>
              {isGalleryVideo(lightbox) ? (
                <video key={lightbox.src} src={lightbox.src} poster={lightbox.poster || undefined} controls autoPlay playsInline />
              ) : (
                <img src={lightbox.src} alt={lightbox.alt} />
              )}
              <figcaption>{lightbox.label || lightbox.alt}</figcaption>
            </figure>
            <button
              type="button"
              className="lightbox-nav next"
              aria-label="Next photo"
              onClick={(e) => {
                e.stopPropagation();
                const i = (lightbox.index + 1) % GALLERY.length;
                setLightbox({ ...GALLERY[i], index: i });
              }}
            >
              ›
            </button>
          </>
        ) : null}
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
