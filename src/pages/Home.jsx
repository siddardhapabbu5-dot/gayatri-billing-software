import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { publicAvailability } from "../engine";
import { TERM_LANGS, TERM_SECTIONS, cancelSectionLines, policiesOf, sectionLines, termLocaleOf } from "../policies";
import { capacityText, enquiryAlertText, mapEmbedSrc, mapGoogleUrl, money, monthMatrix, pad, parseISO, smsHref, telHref, todayISO, waMe } from "../lib";
import RetreatOffer from "./RetreatOffer.jsx";
import "../home.css";

const PAGES = [
  { id: "home", label: "Home" },
  { id: "about", label: "The Hall" },
  { id: "venues", label: "Venues" },
  { id: "stay", label: "The Royal Family Retreat" },
  { id: "stay-space", label: "The Royal Family Retreat", hideNav: true },
  { id: "rooms", label: "Rooms" },
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

const GALLERY_PHOTOS = GALLERY.filter((item) => !isGalleryVideo(item));
const GALLERY_VIDEOS = GALLERY.filter((item) => isGalleryVideo(item));

/** Still frames for The Hall page — Gallery photos + hall/venue stills (12 frames, no mp4). */
const HALL_GALLERY_SLIDES = (() => {
  const seen = new Set();
  const slides = [];
  const push = (src, label, alt = label) => {
    if (!src || seen.has(src)) return;
    seen.add(src);
    slides.push({ id: src, src, alt, label });
  };

  GALLERY_PHOTOS.forEach((item) => push(item.src, item.label, item.alt));
  GALLERY_VIDEOS.forEach((item) => {
    if (item.poster) push(item.poster, item.label, item.alt);
  });

  [
    [`${IMG}/gallery/wedding-bouquet-glow.jpg`, "Golden hour bouquet"],
    [`${IMG}/venue-imperial.jpg`, "Imperial Ballroom"],
    [`${IMG}/venue-garden.jpg`, "Garden Pavilion"],
    [`${IMG}/venue-courtyard.jpg`, "Heritage Courtyard"],
    [`${IMG}/film/agni.jpg`, "Stage and light"],
    [`${IMG}/gallery-1.jpg`, "Guests in the hall"],
    [`${IMG}/gallery-5.jpg`, "Dining setup"],
    [`${IMG}/hero.jpg`, "Evening programme"],
    [`${IMG}/about.jpg`, "The convention grounds"],
  ].forEach(([src, label]) => push(src, label));

  return slides.slice(0, 12);
})();

/** Loads src only when the tile is on-screen inside the Gallery tab. */
function GalleryTile({ item, index, tabActive, onOpen, kind }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  const video = kind === "video" || isGalleryVideo(item);

  useEffect(() => {
    if (!tabActive) {
      setInView(false);
      return undefined;
    }
    const el = ref.current;
    if (!el) return undefined;
    const root = document.querySelector("#gallery");
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setInView(true);
      },
      { root: root || null, rootMargin: "120px 0px", threshold: 0.05 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [tabActive]);

  const showMedia = tabActive && inView;
  const thumbSrc = video ? item.poster || null : item.src;

  return (
    <button
      ref={ref}
      type="button"
      className={`gallery-item${item.span && video ? ` is-${item.span}` : ""}${video ? " is-video" : " is-photo"}`}
      style={{ "--i": index }}
      onClick={() => onOpen({ ...item, index, listKind: video ? "video" : "photo" })}
    >
      {showMedia && thumbSrc ? (
        <img src={thumbSrc} alt={item.alt} loading="lazy" decoding="async" />
      ) : (
        <span className="gallery-media-slot" aria-hidden="true" />
      )}
      <span className="gallery-caption">
        {video ? <em className="gallery-play" aria-hidden="true">▶️</em> : null}
        {item.label}
      </span>
    </button>
  );
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
const BOOK_WHATSAPP = "7204301779";

function phoneDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isTenDigitPhone(value) {
  const d = phoneDigits(value);
  if (d.length === 10) return true;
  if (d.length === 12 && d.startsWith("91")) return true;
  return false;
}

function hallSelectLabel(h) {
  if (/imperial/i.test(h.name)) return "Imperial Garden";
  if (/heritage/i.test(h.name)) return "Heritage";
  if (/garden/i.test(h.name)) return "Garden Pavilion";
  return h.name;
}

function roomTypePhoto(t) {
  const name = String(t?.name || "");
  const id = String(t?.id || "");
  if (id === "rt-suite" || /suite/i.test(name)) return `${IMG}/rooms/suite-ac.jpg`;
  if (id === "rt-dlx" || /deluxe/i.test(name)) return `${IMG}/rooms/deluxe-ac.jpg`;
  if (id === "rt-std" || /standard/i.test(name)) return `${IMG}/rooms/standard-ac.jpg`;
  return `${IMG}/rooms/deluxe-ac.jpg`;
}

const BOOK_STAY_OPTIONS = [
  { name: "Rooms", label: "Rooms" },
  { name: "The Royal Family Retreat", label: "The Royal Family Retreat" },
];

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
  const [galleryMode, setGalleryMode] = useState("photos"); // photos | videos
  const [availMonth, setAvailMonth] = useState(() => todayISO().slice(0, 7));
  const [hallFilm, setHallFilm] = useState(0);
  const hallImgRef = useRef(null);
  const [termFocus, setTermFocus] = useState(null);
  pageRef.current = page;
  const currentId = PAGES[page]?.id || "home";
  const lightPage = !DARK_PAGES.has(currentId);
  const loadHomeMedia = currentId === "home";
  const loadAboutMedia = currentId === "about";
  const loadVenueMedia = currentId === "venues";
  const loadGalleryMedia = currentId === "gallery";
  const loadStayMedia = currentId === "stay";
  const loadContactMedia = currentId === "contact";

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
  const roomTypesPublic = useMemo(() => {
    return (state.roomTypes || []).filter(
      (t) => t && t.name && t.id !== "rt-retreat" && !/royal family retreat/i.test(t.name)
    );
  }, [state.roomTypes]);
  const occasions = p.eventTypes?.length ? p.eventTypes : [];
  const mapSrc = mapEmbedSrc(p);
  const mapLink = mapGoogleUrl(p);
  const termLoc = termLocaleOf(p, termLang);
  const termLangLabel = TERM_LANGS.find((l) => l.id === termLang)?.label || "English";
  const bookPol = policiesOf(p);
  const publicTermSections = useMemo(() => {
    const cancel = TERM_SECTIONS.find((s) => s.id === "cancel");
    const rest = TERM_SECTIONS.filter((s) => s.id !== "cancel");
    return cancel ? [cancel, ...rest] : TERM_SECTIONS;
  }, []);

  function openCancellationPolicy(e) {
    if (e) e.preventDefault();
    goTo("terms");
    window.setTimeout(() => scrollToTermSection("cancel"), 120);
  }

  const dateAvail = useMemo(
    () => publicAvailability(state, form.venue, form.eventDate),
    [state, form.venue, form.eventDate]
  );

  const bookHallOptions = useMemo(() => {
    const imperial = halls.find((h) => /imperial/i.test(h.name));
    const garden = halls.find((h) => /garden|pavilion/i.test(h.name) && !/imperial/i.test(h.name));
    const heritage = halls.find((h) => /heritage|courtyard/i.test(h.name));
    const list = [imperial, garden, heritage].filter(Boolean);
    const fallback = halls.filter((h) => !list.some((x) => x.id === h.id));
    const hallOpts = [...list, ...fallback].map((h) => ({ name: h.name, label: hallSelectLabel(h) }));
    return [...hallOpts, ...BOOK_STAY_OPTIONS];
  }, [halls]);

  const phoneOk = isTenDigitPhone(form.phone);
  const bookReady =
    Boolean(form.name.trim()) &&
    Boolean(form.email.trim()) &&
    Boolean(form.eventType) &&
    Boolean(form.eventDate) &&
    Boolean(form.guests) &&
    Boolean(form.venue) &&
    phoneOk &&
    agreedTerms &&
    !dateAvail.blocked;

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
    if (FILM.length < 2 || currentId !== "home") return undefined;
    const timer = window.setInterval(() => setFilmFrame((i) => (i + 1) % FILM.length), 5200);
    return () => window.clearInterval(timer);
  }, [currentId]);

  useEffect(() => {
    if (currentId !== "about") return undefined;
    if (HALL_GALLERY_SLIDES.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setHallFilm((i) => (i + 1) % HALL_GALLERY_SLIDES.length);
    }, 9500);
    return () => window.clearInterval(timer);
  }, [currentId]);

  useEffect(() => {
    if (currentId === "about") setHallFilm(0);
  }, [currentId]);

  /* PowerPoint-style Grow/Shrink — starts after soft crossfade */
  useEffect(() => {
    if (currentId !== "about" || !loadAboutMedia) return undefined;

    let anim = null;
    let delayTimer = 0;
    let tries = 0;

    const start = () => {
      const img = hallImgRef.current;
      if (!img) {
        if (tries++ < 12) window.requestAnimationFrame(start);
        return;
      }
      if (typeof img.animate !== "function") {
        img.classList.add("is-growing");
        return;
      }
      img.classList.remove("is-growing");
      img.getAnimations().forEach((a) => a.cancel());
      // Gentle settle, then Grow/Shrink loop
      anim = img.animate(
        [
          { transform: "scale(1.02)", opacity: 1 },
          { transform: "scale(1.28)", opacity: 1 },
          { transform: "scale(1.02)", opacity: 1 },
        ],
        {
          duration: 5500,
          easing: "ease-in-out",
          iterations: Infinity,
          delay: 1500,
        }
      );
    };

    delayTimer = window.setTimeout(() => {
      window.requestAnimationFrame(start);
    }, 200);

    return () => {
      window.clearTimeout(delayTimer);
      if (anim) anim.cancel();
      const img = hallImgRef.current;
      if (img) {
        img.getAnimations?.().forEach((a) => a.cancel());
        img.classList.remove("is-growing");
      }
    };
  }, [currentId, hallFilm, loadAboutMedia]);

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
    if (currentId !== "gallery" || reduceMotion) return undefined;
    const sheet = document.querySelector("#gallery");
    if (!sheet) return undefined;

    let dir = 1;
    let paused = false;
    let pauseTimer = 0;

    const pause = () => {
      paused = true;
      window.clearTimeout(pauseTimer);
      pauseTimer = window.setTimeout(() => {
        paused = false;
      }, 3500);
    };

    const tick = window.setInterval(() => {
      if (paused || lightbox) return;
      const max = sheet.scrollHeight - sheet.clientHeight;
      if (max <= 12) return;
      if (sheet.scrollTop >= max - 2) dir = -1;
      else if (sheet.scrollTop <= 2) dir = 1;
      sheet.scrollTop += dir * 1.35;
    }, 35);

    sheet.addEventListener("wheel", pause, { passive: true });
    sheet.addEventListener("touchstart", pause, { passive: true });
    sheet.addEventListener("pointerdown", pause);

    return () => {
      window.clearInterval(tick);
      window.clearTimeout(pauseTimer);
      sheet.removeEventListener("wheel", pause);
      sheet.removeEventListener("touchstart", pause);
      sheet.removeEventListener("pointerdown", pause);
    };
  }, [currentId, reduceMotion, lightbox]);

  useEffect(() => {
    // Trackpad / mouse wheel must NOT change site pages — only left/right arrows (and keys) do.
    // Allow normal vertical scroll inside nested panels (terms, gallery, book form).
    const onWheel = (e) => {
      if (lightbox) return;
      const sheet = e.target?.closest?.(
        ".terms-scroll, #gallery, .booking-form, .organize, .book-shell, textarea, input, select"
      );
      if (sheet) return;
      // Stop wheel from driving the horizontal page deck.
      e.preventDefault();
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setLightbox(null);
        setTermFocus(null);
        return;
      }
      if (termFocus) return;
      if (lightbox) {
        if (e.key === "ArrowRight") {
          e.preventDefault();
          shiftLightbox(1);
        }
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          shiftLightbox(-1);
        }
        return;
      }
      if (e.target?.closest?.("input, textarea, select")) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goBy(1);
      }
      if (e.key === "ArrowLeft") {
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
  }, [lightbox, termFocus, reduceMotion]);

  useEffect(() => {
    saveDraft(form);
  }, [form]);

  useEffect(() => {
    setTermFocus(null);
  }, [page, termLang]);

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

  function lightboxList(item = lightbox) {
    if (!item) return GALLERY_PHOTOS;
    if (item.listKind === "video" || isGalleryVideo(item)) return GALLERY_VIDEOS;
    return GALLERY_PHOTOS;
  }

  function shiftLightbox(dir) {
    if (!lightbox) return;
    const list = lightboxList(lightbox);
    if (!list.length) return;
    const cur = Math.max(0, list.findIndex((g) => g.src === lightbox.src));
    const i = (cur + dir + list.length) % list.length;
    const next = list[i];
    setLightbox({
      ...next,
      index: i,
      listKind: isGalleryVideo(next) ? "video" : "photo",
    });
  }

  function goBooking(patch) {
    if (patch) setForm((f) => ({ ...f, ...patch }));
    goTo("booking");
  }

  function onPageNav(e, id) {
    e.preventDefault();
    goTo(id);
  }

  function scrollToTermSection(id) {
    setTermFocus(id);
  }

  return (
    <div className={`lux-root${lightPage ? " is-light" : ""}${currentId === "booking" ? " is-book" : ""}`}>
      <header className={`site-header${lightPage ? " scrolled" : ""}`} id="header">
        <div className="logo logo-static" aria-label={p.brandName || "Gayatri"}>
          <img className="logo-mark" src={`${IMG}/logo-mark.png`} alt="" />
          <span>
            <strong>{p.brandName || "Gayatri"}</strong>
            <em>{p.place || ""}</em>
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
          <a
            className="btn btn-gold"
            href="#booking"
            onClick={(e) => {
              e.preventDefault();
              goBooking();
            }}
          >
            Book Now <span>↗</span>
          </a>
        </div>
      </header>

      <main className="lux-deck" ref={deckRef}>
        <section className="hero" id="home">
          <div className="hero-film" aria-hidden="true">
            <div className="hero-aurora"></div>
            <div className="hero-rays"></div>
            {loadHomeMedia && FILM[filmFrame] ? (
              <img
                key={FILM[filmFrame].src}
                className="film-slide is-on"
                src={FILM[filmFrame].src}
                alt=""
                loading="eager"
                decoding="async"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ) : null}
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
              <span className="hero-place-pin" aria-hidden="true">📍</span>
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
            <div className="intro-photos hall-autoscroll" aria-label="Hall gallery photos">
              {loadAboutMedia ? (
                <>
                  {HALL_GALLERY_SLIDES.map((slide, i) => {
                    const active = i === hallFilm;
                    const prev = i === (hallFilm - 1 + HALL_GALLERY_SLIDES.length) % HALL_GALLERY_SLIDES.length;
                    return (
                      <figure
                        key={slide.id}
                        className={`hall-slide${active ? " is-on" : ""}${prev ? " is-prev" : ""}`}
                        aria-hidden={!active}
                      >
                        <img
                          ref={active ? hallImgRef : null}
                          className="hall-slide-img"
                          src={slide.src}
                          alt={slide.alt}
                          loading={active || prev ? "eager" : "lazy"}
                          decoding="async"
                        />
                      </figure>
                    );
                  })}
                  <div className="hall-slide-caption">
                    <strong>{HALL_GALLERY_SLIDES[hallFilm]?.label}</strong>
                  </div>
                </>
              ) : (
                <div className="gallery-media-slot" />
              )}
            </div>
          </div>
        </section>

        <section className="locations venues-page reveal" id="venues">
          <div className="venues-leaf venues-leaf-tr" aria-hidden="true" />
          <div className="venues-leaf venues-leaf-bl" aria-hidden="true" />
          <div className="venues-leaf venues-leaf-br" aria-hidden="true" />

          <div className="venues-stage">
            <div className="venue-grid">
              {halls.map((h) => {
                const cur = p.currency || "INR";
                const loc = p.locale || "en-IN";
                const title = h.name.replace(/\s*\(MINI\)\s*$/i, "");
                const half = Number(h.rates?.halfDay) || 0;
                const full = Number(h.rates?.fullDay) || 0;
                return (
                  <article key={h.id} className="venue-card">
                    {loadVenueMedia ? (
                      <img src={h.photo} alt={title} loading="lazy" decoding="async" />
                    ) : (
                      <div className="venue-photo-slot" aria-hidden="true" />
                    )}
                    <div className="venue-card-body">
                      <h3 title={h.name}>{title}</h3>
                      <p className="venue-copy">{h.copy}</p>
                      <p className="capacity" title="Seating capacity">
                        <span className="venues-ico venues-ico-people" aria-hidden="true" />
                        <span className="capacity-label">Capacity</span>
                        <strong>{capacityText(h)}</strong>
                      </p>
                      <ul className="venue-packages">
                        {half > 0 ? (
                          <li>
                            <span className="venue-pkg-label">
                              <span className="venues-ico venues-ico-moon" aria-hidden="true" />
                              Half day
                            </span>
                            <strong className="venue-pkg-price">{money(half, cur, loc)}</strong>
                          </li>
                        ) : null}
                        {full > 0 ? (
                          <li>
                            <span className="venue-pkg-label">
                              <span className="venues-ico venues-ico-sun" aria-hidden="true" />
                              Full day
                            </span>
                            <strong className="venue-pkg-price">{money(full, cur, loc)}</strong>
                          </li>
                        ) : null}
                      </ul>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <footer className="venues-reserve-bar">
            {halls.map((h) => (
              <button
                key={`reserve-${h.id}`}
                type="button"
                className="venues-reserve-btn"
                onClick={() => goBooking({ venue: h.name })}
              >
                <span className="venues-ico venues-ico-cal" aria-hidden="true" />
                Reserve the hall
                <span aria-hidden="true">→</span>
              </button>
            ))}
          </footer>
        </section>

        <section className="stay-page stay-hero-page reveal" id="stay">
          <RetreatOffer
            part="hero"
            loadMedia={loadStayMedia}
            onBook={() =>
              goBooking({
                venue: "The Royal Family Retreat",
                eventType: "Family retreat",
                notes: "Royal Family Retreat — ₹30,000 · 4 rooms, kitchen, dining hall, lobby",
                guests: "8",
              })
            }
          />
        </section>

        <section className="stay-page stay-story-page reveal" id="stay-space">
          <RetreatOffer part="space" loadMedia={loadStayMedia} />
        </section>

        <section className="rooms-page reveal" id="rooms">
          <div className="rooms-page-inner">
            <p className="rooms-kicker">Guest rooms</p>
            <h2 className="rooms-title">Room types &amp; rates</h2>
            <p className="rooms-lead">
              Same rates as at the desk. Extra bed charged when needed.
            </p>
            {roomTypesPublic.length ? (
              <div className="rooms-rate-grid">
                {roomTypesPublic.map((t) => {
                  const cur = p.currency || "INR";
                  const loc = p.locale || "en-IN";
                  const base = Number(t.baseRate) || 0;
                  const extra = Number(t.extraBed) || 0;
                  return (
                    <article key={t.id} className="rooms-rate-card">
                      <div className="rooms-rate-photo">
                        <img src={roomTypePhoto(t)} alt={t.name} loading="lazy" decoding="async" />
                      </div>
                      <div className="rooms-rate-body">
                        <h3>{t.name}</h3>
                        <p className="rooms-rate-price">
                          {money(base, cur, loc)} <span>/ night</span>
                        </p>
                        <p className="rooms-rate-guests">
                          Max guests <strong>{Number(t.extraBeds) > 0 ? `2+${Number(t.extraBeds)}` : String(t.maxGuests || 2)}</strong>
                        </p>
                        {extra > 0 ? (
                          <p className="rooms-rate-extra">Extra bed {money(extra, cur, loc)}</p>
                        ) : (
                          <p className="rooms-rate-extra is-blank" aria-hidden="true">
                            &nbsp;
                          </p>
                        )}
                        <button
                          type="button"
                          className="btn rooms-rate-book"
                          onClick={() =>
                            goBooking({
                              venue: "Rooms",
                              eventType: "Rooms",
                              notes: `${t.name} — ${money(base, cur, loc)} / night`,
                              guests: String(t.maxGuests || 2),
                            })
                          }
                        >
                          Enquire
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="rooms-empty muted">Room rates will appear here once added in Master data.</p>
            )}
          </div>
        </section>

        <section className="gallery reveal" id="gallery">
          <p className="kicker">Gallery</p>
          <h2 className="gallery-title">Seen from the sky, felt in the hall</h2>
          <p className="gallery-lead">
            Night lights, full ceremonies, and the grove around Palagummi.
          </p>
          <div className="gallery-mode" role="tablist" aria-label="Gallery type">
            <button
              type="button"
              role="tab"
              aria-selected={galleryMode === "photos"}
              className={galleryMode === "photos" ? "is-on" : ""}
              onClick={() => setGalleryMode("photos")}
            >
              Photos ({GALLERY_PHOTOS.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={galleryMode === "videos"}
              className={galleryMode === "videos" ? "is-on" : ""}
              onClick={() => setGalleryMode("videos")}
            >
              Videos ({GALLERY_VIDEOS.length})
            </button>
          </div>
          <div className={`gallery-mosaic is-${galleryMode}`}>
            {(galleryMode === "photos" ? GALLERY_PHOTOS : GALLERY_VIDEOS).map((item, index) => (
              <GalleryTile
                key={item.src}
                item={item}
                index={index}
                kind={galleryMode === "videos" ? "video" : "photo"}
                tabActive={loadGalleryMedia}
                onOpen={setLightbox}
              />
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
                const desk = BOOK_WHATSAPP;
                const text = enquiryAlertText({ ...payload, number: out.booking.number });
                const wa = waMe(desk, text);
                const sent = { number: out.booking.number, wa, sms: smsHref(desk, text), tel: telHref(desk), desk };
                setDone(sent);
                setAgreedTerms(false);
                setToast(`Thank you, ${payload.name.split(" ")[0]}. Opening WhatsApp to the desk.`);
                clearDraft();
                setForm({ ...emptyForm, eventDate: todayISO() });
                if (wa) {
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
                  maxLength={14}
                  required
                  value={form.phone}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d+\s-]/g, "");
                    setForm({ ...form, phone: raw });
                    if (error) setError("");
                  }}
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
                  step="1"
                  placeholder="e.g. 400"
                  required
                  value={form.guests}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setForm({ ...form, guests: "" });
                      return;
                    }
                    const n = Number(raw);
                    if (!Number.isFinite(n) || n < 0) {
                      setForm({ ...form, guests: "30" });
                      return;
                    }
                    setForm({ ...form, guests: String(Math.min(1500, Math.floor(n))) });
                  }}
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
                <label htmlFor="venue">Hall / stay *</label>
                <select
                  id="venue"
                  name="venue"
                  required
                  value={form.venue}
                  onChange={(e) => {
                    setError("");
                    const venue = e.target.value;
                    if (venue === "The Royal Family Retreat") {
                      setForm((f) => ({
                        ...f,
                        venue,
                        eventType: f.eventType || "Family retreat",
                        guests: f.guests || "8",
                        notes:
                          f.notes?.trim() ||
                          "Royal Family Retreat — ₹30,000 · 4 rooms, kitchen, dining hall, lobby",
                      }));
                      return;
                    }
                    if (venue === "Rooms") {
                      setForm((f) => ({
                        ...f,
                        venue,
                        notes: f.notes?.trim() || "Room stay enquiry",
                      }));
                      return;
                    }
                    setForm({ ...form, venue });
                  }}
                >
                  <option value="">Choose hall or stay</option>
                  {bookHallOptions.map((h) => (
                    <option key={h.name} value={h.name}>
                      {h.label}
                    </option>
                  ))}
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
              <div className="book-cancel-policy">
                <p>
                  <strong>Cancellation:</strong>{" "}
                  Advance {Number(bookPol.advancePercent) || 0}% · Charge {Number(bookPol.cancellationPercent) || 0}% · Refund{" "}
                  {bookPol.refundAdvance ? "Yes" : "No"}
                  {" · "}
                  <button type="button" className="book-cancel-link" onClick={openCancellationPolicy}>
                    Full policy
                  </button>
                </p>
              </div>
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
                  <a
                    href="#terms-cancel"
                    onClick={(e) => {
                      openCancellationPolicy(e);
                    }}
                  >
                    Terms &amp; Cancellation Policy
                  </a>
                  .
                </span>
              </label>
              <button className="btn btn-gold full" type="submit" disabled={!bookReady}>
                {dateAvail.blocked ? "Choose a free date" : "Send booking request"}
              </button>
            </form>
          )}
          </div>
        </section>

        <section className="contact visit-page reveal" id="contact">
          <div className="visit-ornament visit-ornament-top" aria-hidden="true" />
          <div className="visit-leaf visit-leaf-tl" aria-hidden="true" />
          <div className="visit-leaf visit-leaf-tr" aria-hidden="true" />
          <div className="visit-leaf visit-leaf-bl" aria-hidden="true" />
          <div className="visit-leaf visit-leaf-br" aria-hidden="true" />

          <header className="visit-head">
            <p className="visit-thanks">With thanks 🙏 visit again our convention hall.</p>
            <h2>GAYATRI CONVENTION</h2>
            <p className="visit-tagline">
              <span>A premium destination for weddings, celebrations &amp; corporate events</span>
            </p>
          </header>

          <div className="visit-main">
            <figure className="visit-photo">
              {loadContactMedia ? (
                <img
                  src={`${IMG}/visit-building.jpg`}
                  alt="Gayatri Convention night view"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <div className="venue-photo-slot" aria-hidden="true" />
              )}
            </figure>

            <aside className="visit-card">
              <div className="visit-address">
                <span className="visit-ico visit-ico-pin" aria-hidden="true" />
                <p>
                  Palagummi Village, Razole Mandal
                  <br />
                  Dr. B.R.A. Konaseema
                  <br />
                  Andhra Pradesh 533249
                </p>
              </div>

              <div className="visit-card-rule" aria-hidden="true" />

              <div className="visit-card-contacts">
                <a className="visit-contact-link" href="tel:+919849600555">
                  <span className="visit-ico visit-ico-phone" aria-hidden="true" />
                  +91 98496 00555
                </a>
                <a className="visit-contact-link" href="mailto:events@gayatrifunctionhall.com">
                  <span className="visit-ico visit-ico-mail" aria-hidden="true" />
                  events@gayatrifunctionhall.com
                </a>
              </div>

              <p className="visit-appoint">
                <span className="visit-ico visit-ico-person" aria-hidden="true" />
                Tours by appointment
              </p>
            </aside>
          </div>

          <div className="map-wrap">
            {loadContactMedia ? (
              <iframe
                title="Gayatri Convention, Palagummi on Google Maps"
                src={mapSrc}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            ) : (
              <div className="map-slot" />
            )}
          </div>

          <div className="contact-actions">
            <a className="btn visit-btn-maps" href={mapLink} target="_blank" rel="noreferrer">
              <span className="visit-ico visit-ico-map" aria-hidden="true" />
              Open in Google Maps
              <span aria-hidden="true">↗</span>
            </a>
            <a className="btn visit-btn-pdf" href="/Gayatri-Brochure.pdf?v=20260902d" download="Gayatri-Brochure.pdf">
              <span className="visit-ico visit-ico-doc" aria-hidden="true" />
              Download Brochure PDF
              <span aria-hidden="true">↓</span>
            </a>
          </div>

          <div className="visit-ornament visit-ornament-bottom" aria-hidden="true" />
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
                  {publicTermSections.map((sec, i) => {
                    const lines =
                      sec.id === "cancel"
                        ? cancelSectionLines(p, termLang)
                        : sectionLines(termLoc.sections[sec.id], p);
                    if (!lines.length) return null;
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        className={`terms-toc-item${termFocus === sec.id ? " is-on" : ""}`}
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
                  {publicTermSections.map((sec, i) => {
                    const lines =
                      sec.id === "cancel"
                        ? cancelSectionLines(p, termLang)
                        : sectionLines(termLoc.sections[sec.id], p);
                    if (!lines.length) return null;
                    return (
                      <article key={sec.id} id={`terms-${sec.id}`} className={`terms-article${sec.id === "cancel" ? " is-cancel" : ""}`}>
                        <div className="terms-article-num">{String(i + 1).padStart(2, "0")}</div>
                        <div className="terms-article-body">
                          <h3>{termLoc.labels[sec.id] || sec.label}</h3>
                          {sec.id === "cancel" ? (
                            <p className="terms-cancel-figures">
                              Advance {Number(bookPol.advancePercent) || 0}% · Cancellation{" "}
                              {Number(bookPol.cancellationPercent) || 0}% · Refund on cancel{" "}
                              {bookPol.refundAdvance ? "Yes" : "No"}
                            </p>
                          ) : null}
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

      {termFocus ? (() => {
        const sec = TERM_SECTIONS.find((s) => s.id === termFocus);
        const lines = sec
          ? sec.id === "cancel"
            ? cancelSectionLines(p, termLang)
            : sectionLines(termLoc.sections[sec.id], p)
          : [];
        if (!sec || !lines.length) return null;
        const idx = TERM_SECTIONS.findIndex((s) => s.id === sec.id);
        return (
          <div className="terms-focus" role="dialog" aria-modal="true" aria-label={termLoc.labels[sec.id] || sec.label}>
            <button type="button" className="terms-focus-close" aria-label="Close section" onClick={() => setTermFocus(null)}>
              ×
            </button>
            <article className={`terms-focus-card lang-${termLang}`}>
              <div className="terms-article-num">{String(idx + 1).padStart(2, "0")}</div>
              <h3>{termLoc.labels[sec.id] || sec.label}</h3>
              <ul className="terms-list">
                {lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </article>
          </div>
        );
      })() : null}

      <div
        className={`lightbox${lightbox && isGalleryVideo(lightbox) ? " is-video" : " is-photo"}`}
        hidden={!lightbox}
        onClick={() => setLightbox(null)}
      >
        <button
          type="button"
          className="lightbox-close"
          aria-label="Close"
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
              aria-label={isGalleryVideo(lightbox) ? "Previous video" : "Previous photo"}
              onClick={(e) => {
                e.stopPropagation();
                shiftLightbox(-1);
              }}
            >
              ‹
            </button>
            <figure
              className={`lightbox-frame${isGalleryVideo(lightbox) ? " is-video" : " is-photo"}`}
              onClick={(e) => e.stopPropagation()}
            >
              {isGalleryVideo(lightbox) ? (
                <video
                  key={lightbox.src}
                  src={lightbox.src}
                  poster={lightbox.poster || undefined}
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                />
              ) : (
                <img key={lightbox.src} src={lightbox.src} alt={lightbox.alt} decoding="async" />
              )}
              <figcaption>{lightbox.label || lightbox.alt}</figcaption>
            </figure>
            <button
              type="button"
              className="lightbox-nav next"
              aria-label={isGalleryVideo(lightbox) ? "Next video" : "Next photo"}
              onClick={(e) => {
                e.stopPropagation();
                shiftLightbox(1);
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
      <div className="toast" hidden={!toast}>
        {toast}
      </div>
    </div>
  );
}
