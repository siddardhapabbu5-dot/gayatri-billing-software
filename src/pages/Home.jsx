import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { publicAvailability } from "../engine";
import { TERM_LANGS, TERM_SECTIONS, sectionLines, termLocaleOf } from "../policies";
import { capacityText, enquiryAlertText, mapEmbedSrc, mapGoogleUrl, money, monthMatrix, pad, parseISO, smsHref, telHref, todayISO, waMe } from "../lib";
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

/** The Hall tab — still photos from Gallery (no mp4), auto-play stacked flow */
const HALL_SLIDES = (() => {
  const photos = [];
  const seen = new Set();
  for (const item of GALLERY) {
    const src = isGalleryVideo(item) ? item.poster : item.src;
    if (!src || seen.has(src)) continue;
    seen.add(src);
    photos.push({
      src,
      alt: item.alt || item.label || "Gayatri Convention",
      label: item.label || "",
    });
  }
  return photos;
})();

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
    const phone = String(saved.phone || "").replace(/\D/g, "").slice(0, 10);
    return { ...base, ...saved, eventDate, venue, phone };
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

function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function bookFormReady(form, agreedTerms, dateBlocked) {
  const nameOk = String(form.name || "").trim().length >= 2;
  const phoneOk = phoneDigits(form.phone).length === 10;
  const emailOk = isValidEmail(form.email);
  const typeOk = Boolean(String(form.eventType || "").trim());
  const dateOk = Boolean(form.eventDate) && String(form.eventDate) >= todayISO();
  const guestsN = Number(form.guests);
  const guestsOk = Number.isFinite(guestsN) && guestsN >= 30 && guestsN <= 1500;
  const venueOk = Boolean(String(form.venue || "").trim());
  return nameOk && phoneOk && emailOk && typeOk && dateOk && guestsOk && venueOk && agreedTerms && !dateBlocked;
}

export default function Home({ state, onEnquire, onStaff }) {
  const p = state.property;
  const deckRef = useRef(null);
  const pageRef = useRef(0);
  const wheelLock = useRef(false);
  const [page, setPage] = useState(0);
  const [filmFrame, setFilmFrame] = useState(0);
  const [hallFrame, setHallFrame] = useState(0);
  const [form, setForm] = useState(loadDraft);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [done, setDone] = useState(null);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [termLang, setTermLang] = useState("en");
  const [termLangOpen, setTermLangOpen] = useState(false);
  const [termFocusId, setTermFocusId] = useState(null);
  const termLangDropRef = useRef(null);
  const galleryPreviewTimers = useRef({});
  const galleryVideoRefs = useRef({});
  const [lightbox, setLightbox] = useState(null);
  const [galleryFocus, setGalleryFocus] = useState(0);
  const [galleryAutoScroll, setGalleryAutoScroll] = useState(true);
  const [galleryArmed, setGalleryArmed] = useState({});
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

  const canSendBooking = useMemo(
    () => bookFormReady(form, agreedTerms, dateAvail.blocked),
    [form, agreedTerms, dateAvail.blocked]
  );

  const phoneOk = phoneDigits(form.phone).length === 10;
  const phoneHint =
    form.phone && !phoneOk
      ? `Enter a 10-digit mobile number (${phoneDigits(form.phone).length}/10)`
      : "";

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
    if (PAGES[page]?.id !== "home" || FILM.length < 2) return undefined;
    const timer = window.setInterval(() => setFilmFrame((i) => (i + 1) % FILM.length), 5200);
    return () => window.clearInterval(timer);
  }, [page]);

  useEffect(() => {
    if (PAGES[page]?.id !== "about" || HALL_SLIDES.length < 2 || lightbox) return undefined;
    const timer = window.setInterval(
      () => setHallFrame((i) => (i + 1) % HALL_SLIDES.length),
      4600
    );
    return () => window.clearInterval(timer);
  }, [page, lightbox]);

  function lightboxAlbum(item) {
    return item?.source === "hall" ? HALL_SLIDES : GALLERY;
  }

  function stepLightbox(dir) {
    setLightbox((current) => {
      if (!current) return current;
      const album = lightboxAlbum(current);
      if (!album.length) return current;
      const i = (current.index + dir + album.length) % album.length;
      const next = album[i];
      return current.source === "hall"
        ? { ...next, index: i, source: "hall", kind: "image" }
        : { ...next, index: i };
    });
  }

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
    const section = document.getElementById(id);
    if (section instanceof HTMLElement) {
      section.scrollTop = 0;
      section.querySelectorAll(".terms-scroll, .terms-side").forEach((pane) => {
        pane.scrollTop = 0;
      });
    }
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
    function scrollableParent(el) {
      let node = el;
      while (node && node !== document.body) {
        if (node instanceof HTMLElement) {
          const style = window.getComputedStyle(node);
          const canY =
            /(auto|scroll|overlay)/.test(style.overflowY) ||
            /(auto|scroll|overlay)/.test(style.overflow);
          if (canY && node.scrollHeight > node.clientHeight + 4) return node;
        }
        node = node.parentElement;
      }
      return null;
    }

    const onWheel = (e) => {
      if (lightbox) return;
      // Typing in fields — never steal the wheel
      if (e.target?.closest?.("input, textarea, select")) return;

      const dy = e.deltaY + e.deltaX;
      if (Math.abs(dy) < 24) return;

      const pane = scrollableParent(e.target);
      if (pane) {
        const { scrollTop, scrollHeight, clientHeight } = pane;
        const atTop = scrollTop <= 2;
        const atBottom = scrollTop + clientHeight >= scrollHeight - 2;
        // Mid-scroll: keep vertical scroll; at edges: auto-advance tabs
        if (dy > 0 && !atBottom) return;
        if (dy < 0 && !atTop) return;
      }

      e.preventDefault();
      if (wheelLock.current) return;
      wheelLock.current = true;
      goBy(dy > 0 ? 1 : -1);
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
          stepLightbox(1);
        }
        if (e.key === "ArrowLeft" || e.key === "PageUp") {
          e.preventDefault();
          stepLightbox(-1);
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

  function stopGalleryPreview(index) {
    const timer = galleryPreviewTimers.current[index];
    if (timer) {
      window.clearTimeout(timer);
      delete galleryPreviewTimers.current[index];
    }
    const video = galleryVideoRefs.current[index];
    if (video) {
      video.pause();
      try {
        video.currentTime = 0;
      } catch {
        /* ignore */
      }
    }
  }

  function armGalleryMedia(index) {
    setGalleryArmed((prev) => (prev[index] ? prev : { ...prev, [index]: true }));
  }

  function playGalleryPreview(index, seconds = 4) {
    if (reduceMotion) return;
    armGalleryMedia(index);
    window.requestAnimationFrame(() => {
      const video = galleryVideoRefs.current[index];
      if (!video) return;
      stopGalleryPreview(index);
      try {
        video.currentTime = 0;
      } catch {
        /* ignore */
      }
      const play = video.play();
      if (play?.catch) play.catch(() => {});
      galleryPreviewTimers.current[index] = window.setTimeout(() => {
        stopGalleryPreview(index);
      }, Math.round(seconds * 1000));
    });
  }

  useEffect(() => {
    const onGallery = PAGES[page]?.id === "gallery";
    if (!onGallery) {
      Object.keys(galleryPreviewTimers.current).forEach((k) => stopGalleryPreview(Number(k)));
      setGalleryArmed({});
      return undefined;
    }
    armGalleryMedia(galleryFocus);
    if (!galleryAutoScroll || reduceMotion || lightbox) return undefined;
    const timer = window.setInterval(() => {
      setGalleryFocus((i) => {
        const next = (i + 1) % GALLERY.length;
        stopGalleryPreview(i);
        armGalleryMedia(next);
        if (isGalleryVideo(GALLERY[next])) playGalleryPreview(next, 3.5);
        const tile = document.querySelector(`.gallery-item[data-gallery-index="${next}"]`);
        tile?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
        return next;
      });
    }, 4500);
    return () => window.clearInterval(timer);
  }, [page, galleryAutoScroll, reduceMotion, lightbox]);

  useEffect(() => {
    if (!lightbox) return;
    Object.keys(galleryPreviewTimers.current).forEach((k) => stopGalleryPreview(Number(k)));
  }, [lightbox]);

  useEffect(() => () => {
    Object.keys(galleryPreviewTimers.current).forEach((k) => stopGalleryPreview(Number(k)));
  }, []);

  useEffect(() => {
    if (PAGES[page]?.id !== "terms") {
      setTermFocusId(null);
      return;
    }
    const sheet = document.querySelector("#terms .terms-scroll");
    if (sheet) sheet.scrollTop = 0;
  }, [page, termLang]);

  useEffect(() => {
    setTermLangOpen(false);
  }, [page]);

  useEffect(() => {
    if (!termFocusId) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setTermFocusId(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [termFocusId]);

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

  function openTermSection(id) {
    setTermFocusId(id);
  }

  const termFocusSec = termFocusId ? TERM_SECTIONS.find((s) => s.id === termFocusId) : null;
  const termFocusLines = termFocusSec ? sectionLines(termLoc.sections[termFocusSec.id], p) : [];
  const termFocusIndex = termFocusSec ? TERM_SECTIONS.findIndex((s) => s.id === termFocusSec.id) : -1;

  const currentId = PAGES[page]?.id || "home";
  const lightPage = !DARK_PAGES.has(currentId);
  const loadHome = currentId === "home";
  const loadAbout = currentId === "about";
  const loadVenues = currentId === "venues";
  const loadStay = currentId === "stay" || currentId === "stay-space";
  const loadGallery = currentId === "gallery";
  const loadVisit = currentId === "contact";

  return (
    <div className={`lux-root${lightPage ? " is-light" : ""}${currentId === "booking" ? " is-book" : ""}`}>
      <header className={`site-header${lightPage ? " scrolled" : ""}`} id="header">
        <div className="logo" aria-label={`${p.brandName || "Gayatri"} · ${p.place || ""}`}>
          <img className="logo-mark" src={`${IMG}/logo-mark.png`} alt="" />
          <span>
            <strong>{p.brandName || "Gayatri"}</strong>
            <em>{currentId.startsWith("stay") ? "The Royal Family Retreat" : (p.place || "")}</em>
          </span>
        </div>
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
            {FILM.map((frame, i) => {
              const n = FILM.length;
              const near = loadHome && (i === filmFrame || i === (filmFrame + n - 1) % n);
              return (
                <img
                  key={frame.src}
                  className={`film-slide${i === filmFrame ? " is-on" : ""}`}
                  src={near ? frame.src : undefined}
                  alt=""
                  loading={near ? "eager" : "lazy"}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              );
            })}
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
            <p className="hero-place">
              <span className="hero-place-ico" aria-hidden="true">📍</span>
              <span className="hero-place-text">{p.place}</span>
            </p>
          </div>
        </section>

        <section className="intro reveal" id="about">
          <p className="ghost-title">Exclusive getaway in</p>
          <div className="intro-layout">
            <p className="intro-copy">
              {p.about}
            </p>
            <div
              className="intro-photos hall-flow hall-atelier"
              aria-roledescription="carousel"
              aria-label="Hall photos from gallery"
            >
              <div className="hall-glow" aria-hidden="true" />
              {HALL_SLIDES.map((slide, i) => {
                const n = HALL_SLIDES.length;
                const front = i === hallFrame;
                const back = i === (hallFrame + 1) % n;
                const outgoing = i === (hallFrame + n - 1) % n;
                const active = loadAbout && (front || back || outgoing);
                const openable = front || back;
                return (
                  <figure
                    key={slide.src}
                    className={[
                      "hall-slide",
                      front ? "is-front" : "",
                      back ? "is-back" : "",
                      outgoing ? "is-out" : "",
                      openable ? "is-openable" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    role={openable ? "button" : undefined}
                    tabIndex={openable ? 0 : undefined}
                    aria-label={openable ? `View larger: ${slide.alt}` : undefined}
                    onClick={() => {
                      if (!openable) return;
                      setHallFrame(i);
                      setLightbox({ ...slide, index: i, source: "hall", kind: "image" });
                    }}
                    onKeyDown={(e) => {
                      if (!openable) return;
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setHallFrame(i);
                        setLightbox({ ...slide, index: i, source: "hall", kind: "image" });
                      }
                    }}
                  >
                    {active ? (
                      <img src={slide.src} alt={slide.alt} draggable={false} />
                    ) : null}
                  </figure>
                );
              })}
            </div>
          </div>
        </section>

        <section className="locations reveal" id="venues">
          <h2 className="page-title">Convention halls</h2>
          <p className="page-sub">Venues</p>
          <div className="venue-grid">
            {halls.map((h) => (
              <article key={h.id} className="venue-card">
                <div className="venue-media">
                  {loadVenues ? (
                    <img src={h.photo} alt={h.name} loading="lazy" />
                  ) : (
                    <div className="media-slot venue-media-slot" aria-hidden="true" />
                  )}
                </div>
                <div className="venue-body">
                  <div className="venue-head">
                    <p className="venue-jp">{h.jp}</p>
                    <h3>{h.name}</h3>
                    <p className="venue-copy">{h.copy}</p>
                  </div>
                  <div className="venue-meta">
                    <p className="capacity" title="Seating capacity">
                      <span className="capacity-ico" aria-hidden="true">🪑</span>
                      <span className="capacity-text">
                        Capacity <span className="capacity-sep">|</span> {capacityText(h)}
                      </span>
                    </p>
                    {(() => {
                      const cur = p.currency || "INR";
                      const loc = p.locale || "en-IN";
                      const slots = [
                        ["Half day", h.rates?.halfDay],
                        ["Full day", h.rates?.fullDay],
                      ].filter(([, amount]) => Number(amount) > 0);
                      return (
                        <ul className="venue-packages" aria-hidden={!slots.length}>
                          {slots.map(([label, amount]) => (
                            <li key={label}>
                              <span className="venue-pkg-label">{label}</span>
                              <span className="venue-pkg-dash" aria-hidden="true" />
                              <strong className="venue-pkg-price">{money(amount, cur, loc)}</strong>
                            </li>
                          ))}
                        </ul>
                      );
                    })()}
                    {(() => {
                      const todayHold = publicAvailability(state, h.name, todayISO());
                      const w = todayHold.rows[0]?.windows[0];
                      return todayHold.blocked ? (
                        <p className="venue-hold is-booked" role="status">
                          <span className="venue-hold-label">Booked today</span>
                          {w ? (
                            <span className="venue-hold-note">
                              {w.windowLabel || `${w.startLabel} – ${w.endLabel}`}
                            </span>
                          ) : null}
                        </p>
                      ) : (
                        <p className="venue-hold is-free" role="status">
                          <span className="venue-hold-label">Free today</span>
                          <span className="venue-hold-note">Available to reserve — tap Book now</span>
                        </p>
                      );
                    })()}
                    <button
                      type="button"
                      className="btn btn-gold venue-book-btn"
                      onClick={() => goBooking({ venue: h.name })}
                    >
                      Book now
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="stay-page stay-hero-page reveal" id="stay">
          <RetreatOffer
            part="hero"
            loadMedia={loadStay}
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
          <RetreatOffer part="space" loadMedia={loadStay} />
        </section>

        <section className="gallery reveal" id="gallery">
          <p className="kicker">Gallery</p>
          <h2 className="gallery-title">Seen from the sky, felt in the hall</h2>
          <p className="gallery-lead">
            Hover a video clip for a short preview. Tap to open full screen. Scroll down to move to the next tab.
          </p>
          <div className="gallery-toolbar">
            <button
              type="button"
              className={`gallery-auto-btn${galleryAutoScroll ? " is-on" : ""}`}
              onClick={() => setGalleryAutoScroll((on) => !on)}
              aria-pressed={galleryAutoScroll}
            >
              {galleryAutoScroll ? "⏸ Auto-scroll on" : "▶ Auto-scroll off"}
            </button>
          </div>
          <div className="gallery-mosaic">
            {GALLERY.map((item, index) => (
              <button
                key={item.src}
                type="button"
                data-gallery-index={index}
                className={`gallery-item${item.span ? ` is-${item.span}` : ""}${isGalleryVideo(item) ? " is-video" : ""}${
                  galleryFocus === index ? " is-focus" : ""
                }`}
                style={{ "--i": index }}
                onClick={() => setLightbox({ ...item, index })}
                onMouseEnter={() => {
                  setGalleryFocus(index);
                  if (isGalleryVideo(item)) {
                    armGalleryMedia(index);
                    playGalleryPreview(index, 4);
                  }
                }}
                onMouseLeave={() => {
                  if (isGalleryVideo(item)) stopGalleryPreview(index);
                }}
                onFocus={() => {
                  setGalleryFocus(index);
                  if (isGalleryVideo(item)) {
                    armGalleryMedia(index);
                    playGalleryPreview(index, 4);
                  }
                }}
                onBlur={() => {
                  if (isGalleryVideo(item)) stopGalleryPreview(index);
                }}
              >
                {isGalleryVideo(item) ? (
                  loadGallery ? (
                    <video
                      ref={(el) => {
                        if (el) galleryVideoRefs.current[index] = el;
                        else delete galleryVideoRefs.current[index];
                      }}
                      src={galleryArmed[index] ? item.src : undefined}
                      poster={item.poster || undefined}
                      muted
                      playsInline
                      loop
                      preload={galleryArmed[index] ? "auto" : "none"}
                      aria-label={item.alt}
                    />
                  ) : (
                    <div className="media-slot" aria-hidden="true" />
                  )
                ) : loadGallery ? (
                  <img src={item.src} alt={item.alt} loading="lazy" />
                ) : (
                  <div className="media-slot" aria-hidden="true" />
                )}
                {isGalleryVideo(item) ? (
                  <span className="gallery-emoji-play" aria-hidden="true">🎬</span>
                ) : null}
                <span className="gallery-caption">{item.label}</span>
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
                const digits = phoneDigits(form.phone);
                if (!form.venue) {
                  setError("Please select a hall.");
                  return;
                }
                if (!form.name.trim() || form.name.trim().length < 2) {
                  setError("Please enter your full name.");
                  return;
                }
                if (digits.length !== 10) {
                  setError("Enter a valid 10-digit mobile number.");
                  return;
                }
                if (!isValidEmail(form.email)) {
                  setError("Enter a valid email address.");
                  return;
                }
                if (!form.eventType) {
                  setError("Please choose an event type.");
                  return;
                }
                const guestsN = Number(form.guests);
                if (!Number.isFinite(guestsN) || guestsN < 30 || guestsN > 1500) {
                  setError("Guests must be between 30 and 1,500.");
                  return;
                }
                if (!form.eventDate || form.eventDate < todayISO()) {
                  setError("Please choose a valid event date.");
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
                  phone: digits,
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
                const desk = state.property.notifyPhone || "+91 72043 01779";
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
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="10-digit number"
                  required
                  maxLength={10}
                  pattern="[0-9]{10}"
                  value={form.phone}
                  aria-invalid={form.phone ? !phoneOk : undefined}
                  onChange={(e) => {
                    const next = e.target.value.replace(/\D/g, "").slice(0, 10);
                    setForm({ ...form, phone: next });
                    if (error) setError("");
                  }}
                />
                {phoneHint ? <span className="field-hint is-warn">{phoneHint}</span> : null}
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

              <div className="field">
                <label htmlFor="venue">Hall *</label>
                <select
                  id="venue"
                  name="venue"
                  required
                  value={form.venue}
                  onChange={(e) => {
                    setError("");
                    setForm({ ...form, venue: e.target.value });
                  }}
                >
                  <option value="">Choose hall</option>
                  {halls.map((h) => {
                    const hold = publicAvailability(state, h.name, form.eventDate);
                    const short =
                      /imperial/i.test(h.name) ? "Imperial"
                      : /garden/i.test(h.name) ? "Garden"
                      : /heritage/i.test(h.name) ? "Heritage"
                      : h.name;
                    return (
                      <option key={h.id} value={h.name} disabled={hold.blocked}>
                        {short}{hold.blocked ? " — booked" : ""}
                      </option>
                    );
                  })}
                </select>
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
                </div>

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
              </div>
              {error ? <p className="form-error">{error}</p> : null}
              {!canSendBooking && !error ? (
                <p className="form-hint">
                  Complete name, 10-digit mobile, email, event type, guests, date, hall, and Terms to send.
                </p>
              ) : null}
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
                  <a href="#terms" onClick={(e) => onPageNav(e, "terms")}>Terms & Conditions</a>.
                </span>
              </label>
              <button
                className="btn btn-gold full"
                type="submit"
                disabled={!canSendBooking}
              >
                {dateAvail.blocked
                  ? "Choose a free date"
                  : canSendBooking
                    ? "Send booking request"
                    : "Fill required fields"}
              </button>
            </form>
          )}
          </div>
        </section>

        <section className="contact reveal" id="contact">
          <p className="kicker visit-thanks">🙏 With thanks</p>
          <h2>Visit our convention hall again</h2>
          <p className="page-sub">We look forward to welcoming you back to {p.name || "Gayatri Convention"}.</p>
          <h3 className="visit-place-name">{p.name}</h3>
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
            {loadVisit ? (
              <iframe
                title="Gayatri Water and Beverages, Palagummi on Google Maps"
                src={mapSrc}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            ) : (
              <div className="media-slot map-slot" aria-hidden="true" />
            )}
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
                        className={`terms-toc-item${termFocusId === sec.id ? " is-on" : ""}`}
                        onClick={() => openTermSection(sec.id)}
                      >
                        <span className="terms-toc-num">{String(i + 1).padStart(2, "0")}</span>
                        <span className="terms-toc-label">{termLoc.labels[sec.id] || sec.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </aside>
              <div className="terms-scroll">
                {termFocusSec ? (
                  <div className={`terms-focus lang-${termLang}`} role="dialog" aria-modal="true" aria-labelledby="terms-focus-title">
                    <button
                      type="button"
                      className="terms-focus-close"
                      aria-label="Close section"
                      onClick={() => setTermFocusId(null)}
                    >
                      ×
                    </button>
                    <div className="terms-focus-card">
                      <div className="terms-focus-num">{String(termFocusIndex + 1).padStart(2, "0")}</div>
                      <h3 id="terms-focus-title">{termLoc.labels[termFocusSec.id] || termFocusSec.label}</h3>
                      <ul className="terms-list">
                        {termFocusLines.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className={`terms-articles lang-${termLang}`}>
                    <p className="terms-pick-hint">Select a section on the left to read it in full.</p>
                    {TERM_SECTIONS.map((sec, i) => {
                      const lines = sectionLines(termLoc.sections[sec.id], p);
                      if (!lines.length) return null;
                      return (
                        <button
                          key={sec.id}
                          type="button"
                          className="terms-article terms-article-btn"
                          onClick={() => openTermSection(sec.id)}
                        >
                          <div className="terms-article-num">{String(i + 1).padStart(2, "0")}</div>
                          <div className="terms-article-body">
                            <h3>{termLoc.labels[sec.id] || sec.label}</h3>
                            <p className="terms-article-preview">{lines[0]}</p>
                          </div>
                        </button>
                      );
                    })}
                    <p className={`terms-foot lang-${termLang}`}>{termLoc.ui.disclaimer}</p>
                  </div>
                )}
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
                stepLightbox(-1);
              }}
            >
              ‹
            </button>
            <figure className="lightbox-frame" onClick={(e) => e.stopPropagation()}>
              {isGalleryVideo(lightbox) && lightbox.source !== "hall" ? (
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
                stepLightbox(1);
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
      {page > 0 ? (
        <a
          className="to-top is-on"
          href="#home"
          aria-label="Back to home"
          onClick={(e) => onPageNav(e, "home")}
        >
          ⌃<span>Home</span>
        </a>
      ) : null}
      <div className="toast" hidden={!toast}>
        {toast}
      </div>
    </div>
  );
}
