export const TERM_SECTIONS = [
  { id: "hall", label: "Convention T&C" },
  { id: "room", label: "Room Booking T&C" },
  { id: "cancel", label: "Cancellation Policy" },
  { id: "payment", label: "Payment Policy" },
  { id: "catering", label: "Catering Policy" },
  { id: "damage", label: "Damage Policy" },
  { id: "general", label: "General Property Rules" },
];

export const TERM_LANGS = [
  { id: "en", label: "English" },
  { id: "te", label: "తెలుగు" },
  { id: "hi", label: "हिन्दी" },
];

export const TERM_SECTION_LABELS = {
  en: Object.fromEntries(TERM_SECTIONS.map((s) => [s.id, s.label])),
  te: {
    hall: "కన్వెన్షన్ నిబంధనలు",
    room: "గది బుకింగ్ నిబంధనలు",
    cancel: "రద్దు విధానం",
    payment: "చెల్లింపు విధానం",
    catering: "క్యాటరింగ్ విధానం",
    damage: "నష్టం విధానం",
    general: "సాధారణ ఆస్తి నియమాలు",
  },
  hi: {
    hall: "कन्वेंशन नियम",
    room: "कमरा बुकिंग नियम",
    cancel: "रद्दीकरण नीति",
    payment: "भुगतान नीति",
    catering: "खानपान नीति",
    damage: "क्षति नीति",
    general: "सामान्य संपत्ति नियम",
  },
};

export const TERM_UI = {
  en: {
    kicker: "Terms",
    title: "Terms and conditions",
    langLabel: "Language",
    tocLabel: "Sections",
    helpTitle: "Need help?",
    helpSub: "Speak to the convention desk.",
    sub: (name, version) => `These apply to bookings at ${name}. Version v${version}.`,
    disclaimer: "These are a business policy for this property, not a substitute for a lawyer's contract.",
  },
  te: {
    kicker: "నిబంధనలు",
    title: "నిబంధనలు మరియు షరతులు",
    langLabel: "భాష",
    tocLabel: "విభాగాలు",
    helpTitle: "సహాయం కావాలా?",
    helpSub: "కన్వెన్షన్ డెస్క్‌ను సంప్రదించండి.",
    sub: (name, version) => `ఇవి ${name} వద్ద బుకింగ్‌లకు వర్తిస్తాయి. వెర్షన్ v${version}.`,
    disclaimer: "ఇవి ఈ ఆస్తి కోసం వ్యాపార విధానం మాత్రమే. న్యాయవాది ఒప్పందానికి బదులు కావు.",
  },
  hi: {
    kicker: "नियम",
    title: "नियम और शर्तें",
    langLabel: "भाषा",
    tocLabel: "खंड",
    helpTitle: "सहायता चाहिए?",
    helpSub: "कन्वेंशन डेस्क से बात करें।",
    sub: (name, version) => `ये ${name} पर बुकिंग पर लागू होते हैं। संस्करण v${version}.`,
    disclaimer: "ये इस संपत्ति की व्यावसायिक नीति हैं, वकील के अनुबंध का विकल्प नहीं।",
  },
};

export const DEFAULT_POLICIES = {
  advancePercent: 30,
  cancellationPercent: 100,
  refundAdvance: false,
  roomCheckInOut: "24 hrs",
  checkInTime: "12:00",
  checkOutTime: "11:00",
  extraHourHall: 5000,
  extraPersonCharge: 0,
  extraBedCharge: 800,
  lateCheckoutFee: 1000,
  securityDeposit: 0,
  minHallAmount: 0,
  paymentDueDays: 0,
  graceMinutes: 30,
};

export const DEFAULT_TERM_SECTIONS = {
  hall: [
    "A convention booking is confirmed only after Gayatri Convention receives the agreed advance and issues a receipt.",
    "Venue timing includes setup and clearing as written on the booking. Extra hours are charged at the extra-hour rate in property policy if the venue is not vacated on time.",
    "A grace period applies after the booked end time, as set in property policy, before extra-hour charges begin.",
    "Music, loudspeakers and fireworks must follow local rules and the time limit given by the desk.",
    "Gayatri Convention may refuse or stop an event that is illegal, unsafe, or against these terms.",
  ].join("\n"),
  room: [
    "Room rent is charged per night from check-in date to check-out date.",
    "Room check-in and check-out follow a 24-hour stay from the time of check-in.",
    "An extra bed is billed if a child or guest needs one. Children are not billed a separate child fee.",
    "The guest must show identification at the desk. Room check-in needs ID as required by law.",
    "Room assignment may change to an equal or higher type if the original room cannot be used.",
  ].join("\n"),
  cancel: [
    "To confirm a booking, Gayatri Convention collects an advance of {advancePercent}% of the bill.",
    "Cancellation charge under current property policy: {cancellationPercent}% of the booking total.",
    "Refund of advance on guest cancel: {refundAdvanceLabel}.",
    "If refund is No, the advance is forfeited on cancel or no-show.",
    "If refund is Yes, any refund is paid only after deducting the {cancellationPercent}% cancellation charge.",
    "A date change is possible only if the new date is free, at the desk's discretion.",
    "A no-show is treated as a cancellation on the check-in / event date.",
  ].join("\n"),
  payment: [
    "The remaining balance must be paid before the event starts, or before room check-in, unless a later due date is written on the booking.",
    "GST / tax is extra if applicable, at the rate set for the property.",
    "Accepted modes: cash, UPI, card, net banking and bank transfer. Each collection is recorded with date, mode and receipt.",
    "A security deposit, if collected, is held separately from room and hall revenue and is settled at check-out after any damage charges.",
  ].join("\n"),
  catering: [
    "Gayatri Convention provides the venue and guest rooms. Catering, decoration, AV and photography are arranged by the organiser unless a separate written contract says otherwise.",
    "Outside caterers must follow kitchen, waste and timing rules given by the desk.",
    "The guest is responsible for food safety, staff and equipment brought by their caterer.",
  ].join("\n"),
  damage: [
    "The guest is responsible for all attendees and for any damage to the hall, rooms, furniture, lights or garden.",
    "Repair or replacement cost will be added to the bill, and may be taken from the security deposit if one was collected.",
    "Vehicles park at the owner's risk. Gayatri Convention is not responsible for loss of valuables.",
  ].join("\n"),
  general: [
    "Electricity, generator (if provided) and water are as available on the day. The desk will help with a backup plan where possible.",
    "These terms are a business policy for bookings at this property. They are not a substitute for a lawyer's contract.",
    "The version number printed on the booking is the version the guest agreed to.",
  ].join("\n"),
};

export const DEFAULT_TERM_SECTIONS_TE = {
  hall: [
    "గాయత్రి కన్వెన్షన్ అంగీకరించిన అడ్వాన్స్ స్వీకరించి రసీదు ఇచ్చిన తర్వాతే వేదిక బుకింగ్ నిర్ధారణ అవుతుంది.",
    "హాల్ సమయంలో బుకింగ్‌లో రాసిన సెటప్ మరియు క్లియరింగ్ ఉంటాయి. సమయానికి హాల్ ఖాళీ చేయకపోతే, ఆస్తి విధానంలోని అదనపు గంట రేటు ప్రకారం అదనపు గంటలు వసూలు అవుతాయి.",
    "బుక్ చేసిన ముగింపు సమయం తర్వాత ఆస్తి విధానంలో పేర్కొన్న గ్రేస్ పీరియడ్ ఉంటుంది. ఆ తర్వాతే అదనపు గంట ఛార్జీలు మొదలవుతాయి.",
    "సంగీతం, లౌడ్ స్పీకర్లు మరియు పటాకులు స్థానిక నియమాలు మరియు డెస్క్ ఇచ్చిన సమయ పరిమితిని పాటించాలి.",
    "చట్టవిరుద్ధం, అసురక్షితం లేదా ఈ నిబంధనలకు విరుద్ధమైన కార్యక్రమాన్ని గాయత్రి కన్వెన్షన్ తిరస్కరించవచ్చు లేదా ఆపవచ్చు.",
  ].join("\n"),
  room: [
    "గది అద్దె చెక్-ఇన్ తేదీ నుంచి చెక్-అవుట్ తేదీ వరకు రాత్రికి వసూలు అవుతుంది.",
    "గది చెక్-ఇన్ మరియు చెక్-అవుట్ చెక్-ఇన్ సమయం నుంచి 24 గంటల స్టే పాలసీని అనుసరిస్తాయి.",
    "పిల్లవాడు లేదా అతిథికి అదనపు మంచం కావాలంటే దాని ఛార్జీ వసూలు అవుతుంది. పిల్లలకు వేరే పిల్లల ఫీజు వసూలు చేయరు.",
    "అతిథి డెస్క్ వద్ద గుర్తింపు పత్రం చూపాలి. చట్టం ప్రకారం గది చెక్-ఇన్‌కు ఐడి అవసరం.",
    "అసలు గది ఉపయోగించలేకపోతే, సమాన లేదా ఉన్నత రకం గదికి మార్చవచ్చు.",
  ].join("\n"),
  cancel: [
    "బుకింగ్ ధృవీకరణకు గాయత్రి కన్వెన్షన్ బిల్లులో {advancePercent}% అడ్వాన్స్ తీసుకుంటుంది.",
    "ప్రస్తుత ఆస్తి విధానం ప్రకారం రద్దు ఛార్జీ: బుకింగ్ మొత్తంపై {cancellationPercent}%.",
    "అతిథి రద్దుపై అడ్వాన్స్ రీఫండ్: {refundAdvanceLabel}.",
    "రీఫండ్ లేదు అయితే, రద్దు లేదా నో-షోలో అడ్వాన్స్ ఉంచుకుంటారు.",
    "రీఫండ్ అవును అయితే, {cancellationPercent}% రద్దు ఛార్జీ తగ్గించి మిగిలినది చెల్లిస్తారు.",
    "కొత్త తేదీ ఖాళీగా ఉంటేనే, డెస్క్ అభీష్టం మేరకు తేదీ మార్పు సాధ్యం.",
    "హాజరుకాని (నో-షో) సందర్భం చెక్-ఇన్ / కార్యక్రమ తేదీన రద్దుగా పరిగణిస్తారు.",
  ].join("\n"),
  payment: [
    "కార్యక్రమం మొదలయ్యే ముందు, లేదా గది చెక్-ఇన్ ముందు, మిగిలిన బ్యాలెన్స్ చెల్లించాలి — బుకింగ్‌లో వేరే చివరి తేదీ రాసినట్లయితే మినహా.",
    "వర్తించే చోట GST / పన్ను అదనం, ఆస్తికి నిర్ణయించిన రేటు ప్రకారం.",
    "అంగీకరించే విధాలు: నగదు, UPI, కార్డు, నెట్ బ్యాంకింగ్ మరియు బ్యాంకు బదిలీ. ప్రతి వసూలు తేదీ, విధం మరియు రసీదుతో నమోదు అవుతుంది.",
    "సెక్యూరిటీ డిపాజిట్ తీసుకుంటే, అది గది మరియు హాల్ ఆదాయం నుంచి వేరుగా ఉంచి, ఏదైనా నష్టం ఛార్జీల తర్వాత చెక్-అవుట్‌లో సర్దుబాటు అవుతుంది.",
  ].join("\n"),
  catering: [
    "గాయత్రి కన్వెన్షన్ వేదిక మరియు అతిథి గదులు మాత్రమే అందిస్తుంది. క్యాటరింగ్, అలంకరణ, AV మరియు ఫోటోగ్రఫీని నిర్వాహకులే ఏర్పాటు చేస్తారు — వేరే రాతపూర్వక ఒప్పందం ఉంటే మినహా.",
    "బయటి క్యాటరర్లు డెస్క్ ఇచ్చిన వంటగది, వ్యర్థాలు మరియు సమయ నియమాలు పాటించాలి.",
    "క్యాటరర్ తెచ్చిన ఆహార భద్రత, సిబ్బంది మరియు పరికరాలకు అతిథి బాధ్యత వహిస్తారు.",
  ].join("\n"),
  damage: [
    "హాజరైన వారందరికీ, మరియు హాల్, గదులు, ఫర్నిచర్, లైట్లు లేదా గార్డెన్‌కు ఏదైనా నష్టానికి అతిథి బాధ్యత వహిస్తారు.",
    "మరమ్మత్తు లేదా మార్పిడి ఖర్చు బిల్లుకు జోడించబడుతుంది, సెక్యూరిటీ డిపాజిట్ తీసుకుంటే అందులో నుంచి కూడా తీసుకోవచ్చు.",
    "వాహనాలు యజమాని బాధ్యతతో పార్క్ అవుతాయి. విలువైన వస్తువుల నష్టానికి గాయత్రి కన్వెన్షన్ బాధ్యత వహించదు.",
  ].join("\n"),
  general: [
    "విద్యుత్, జనరేటర్ (ఇస్తే) మరియు నీరు ఆ రోజు అందుబాటులో ఉన్నంత వరకు. సాధ్యమైన చోట డెస్క్ బ్యాకప్ ప్రణాళికలో సహాయం చేస్తుంది.",
    "ఈ నిబంధనలు ఈ ఆస్తిలో బుకింగ్‌ల కోసం వ్యాపార విధానం. న్యాయవాది ఒప్పందానికి బదులు కావు.",
    "బుకింగ్‌పై ముద్రించిన వెర్షన్ నంబర్, అతిథి అంగీకరించిన వెర్షన్.",
  ].join("\n"),
};

export const DEFAULT_TERM_SECTIONS_HI = {
  hall: [
    "गायत्री कन्वेंशन निर्धारित अग्रिम राशि प्राप्त कर रसीद देने के बाद ही वेन्यू बुकिंग पक्की मानी जाएगी।",
    "हॉल समय में बुकिंग पर लिखे अनुसार सेटअप और खाली करना शामिल है। समय पर हॉल खाली न करने पर संपत्ति नीति के अतिरिक्त घंटे दर से शुल्क लगेगा।",
    "बुक किए गए समाप्ति समय के बाद संपत्ति नीति में तय ग्रेस पीरियड लागू होता है। उसके बाद ही अतिरिक्त घंटे का शुल्क शुरू होता है।",
    "संगीत, लाउडस्पीकर और पटाखों को स्थानीय नियमों और डेस्क द्वारा दी गई समय सीमा का पालन करना होगा।",
    "अवैध, असुरक्षित या इन नियमों के विरुद्ध कार्यक्रम को गायत्री कन्वेंशन मना कर सकती है या रोक सकती है।",
  ].join("\n"),
  room: [
    "कमरे का किराया चेक-इन तिथि से चेक-आउट तिथि तक प्रति रात लिया जाता है।",
    "कमरा चेक-इन और चेक-आउट चेक-इन समय से 24 घंटे की स्टे नीति का पालन करते हैं।",
    "बच्चे या अतिथि को अतिरिक्त बिस्तर चाहिए तो उसका शुल्क लगेगा। बच्चों से अलग बाल शुल्क नहीं लिया जाता।",
    "अतिथि को डेस्क पर पहचान पत्र दिखाना होगा। कानून के अनुसार कमरा चेक-इन के लिए आईडी आवश्यक है।",
    "मूल कमरा उपयोग न हो सके तो समान या ऊँचे प्रकार के कमरे में बदला जा सकता है।",
  ].join("\n"),
  cancel: [
    "बुकिंग पक्की करने के लिए गायत्री कन्वेंशन बिल का {advancePercent}% अग्रिम लेता है।",
    "वर्तमान संपत्ति नीति के अनुसार रद्दीकरण शुल्क: बुकिंग कुल का {cancellationPercent}%.",
    "अतिथि रद्द करने पर अग्रिम रिफंड: {refundAdvanceLabel}.",
    "रिफंड नहीं है तो रद्द या नो-शो पर अग्रिम जब्त रहेगा।",
    "रिफंड हाँ हो तो {cancellationPercent}% रद्दीकरण शुल्क काटकर शेष दिया जाएगा।",
    "नई तिथि खाली हो तो ही, डेस्क के विवेक पर तिथि बदली जा सकती है।",
    "न आने (नो-शो) को चेक-इन / कार्यक्रम तिथि पर रद्दीकरण माना जाएगा।",
  ].join("\n"),
  payment: [
    "कार्यक्रम शुरू होने से पहले, या कमरा चेक-इन से पहले, शेष राशि चुकानी होगी — जब तक बुकिंग पर बाद की देय तिथि न लिखी हो।",
    "लागू होने पर GST / कर अतिरिक्त है, संपत्ति पर तय दर के अनुसार।",
    "स्वीकृत माध्यम: नकद, UPI, कार्ड, नेट बैंकिंग और बैंक ट्रांसफर। हर वसूली तिथि, माध्यम और रसीद के साथ दर्ज होगी।",
    "सिक्योरिटी डिपॉजिट लिया गया हो तो वह कमरा और हॉल आय से अलग रखा जाएगा और किसी क्षति शुल्क के बाद चेक-आउट पर निपटाया जाएगा।",
  ].join("\n"),
  catering: [
    "गायत्री कन्वेंशन स्थल और अतिथि कमरे प्रदान करता है। खानपान, सजावट, AV और फोटोग्राफी आयोजक स्वयं व्यवस्था करेंगे — जब तक अलग लिखित अनुबंध न हो।",
    "बाहरी कैटरर को डेस्क के रसोई, कचरा और समय नियमों का पालन करना होगा।",
    "कैटरर द्वारा लाए गए भोजन की सुरक्षा, स्टाफ और उपकरणों की जिम्मेदारी अतिथि की है।",
  ].join("\n"),
  damage: [
    "सभी उपस्थित लोगों और हॉल, कमरों, फर्नीचर, लाइट या बगीचे की किसी क्षति की जिम्मेदारी अतिथि की है।",
    "मरम्मत या बदलने का खर्च बिल में जोड़ा जाएगा, और सिक्योरिटी डिपॉजिट लिया गया हो तो उसमें से भी काटा जा सकता है।",
    "वाहन मालिक के जोखिम पर पार्क होते हैं। कीमती सामान की हानि के लिए गायत्री कन्वेंशन जिम्मेदार नहीं है।",
  ].join("\n"),
  general: [
    "बिजली, जनरेटर (यदि उपलब्ध) और पानी उस दिन जितना उपलब्ध हो। जहाँ संभव हो डेस्क बैकअप योजना में मदद करेगा।",
    "ये नियम इस संपत्ति पर बुकिंग की व्यावसायिक नीति हैं। ये वकील के अनुबंध का विकल्प नहीं हैं।",
    "बुकिंग पर छपा संस्करण नंबर वही है जिससे अतिथि सहमत हुए।",
  ].join("\n"),
};

export const DEFAULT_TERM_LOCALES = {
  en: DEFAULT_TERM_SECTIONS,
  te: DEFAULT_TERM_SECTIONS_TE,
  hi: DEFAULT_TERM_SECTIONS_HI,
};

export function policiesOf(property) {
  return { ...DEFAULT_POLICIES, ...(property?.policies || {}) };
}

export function roomCheckInOutText(pol) {
  const label = String(pol?.roomCheckInOut || "").trim();
  if (label) return label;
  const inT = pol?.checkInTime || "12:00";
  const outT = pol?.checkOutTime || "11:00";
  return `${inT} / ${outT}`;
}

export function defaultTermSets() {
  return {
    version: 1,
    publishedAt: "",
    sections: { ...DEFAULT_TERM_SECTIONS },
    locales: {
      en: { ...DEFAULT_TERM_SECTIONS },
      te: { ...DEFAULT_TERM_SECTIONS_TE },
      hi: { ...DEFAULT_TERM_SECTIONS_HI },
    },
  };
}

function mergeLocale(base, extra) {
  const out = { ...base };
  for (const [key, value] of Object.entries(extra || {})) {
    if (value == null) continue;
    // Empty stored sections must not wipe built-in defaults (e.g. Cancellation Policy).
    if (!String(value).trim()) continue;
    out[key] = value;
  }
  return out;
}

export function termSetsOf(property) {
  const raw = property?.termSets;
  if (raw?.sections || raw?.locales) {
    const en = mergeLocale(DEFAULT_TERM_SECTIONS, raw.sections || raw.locales?.en);
    return {
      version: Number(raw.version) || 1,
      publishedAt: raw.publishedAt || "",
      sections: en,
      locales: {
        en,
        te: mergeLocale(DEFAULT_TERM_SECTIONS_TE, raw.locales?.te),
        hi: mergeLocale(DEFAULT_TERM_SECTIONS_HI, raw.locales?.hi),
      },
    };
  }
  const legacy = String(property?.terms || "").trim();
  if (legacy) {
    const en = { ...DEFAULT_TERM_SECTIONS, general: legacy };
    return {
      version: 1,
      publishedAt: "",
      sections: en,
      locales: {
        en,
        te: { ...DEFAULT_TERM_SECTIONS_TE },
        hi: { ...DEFAULT_TERM_SECTIONS_HI },
      },
    };
  }
  return defaultTermSets();
}

export function termLocaleOf(property, lang = "en") {
  const id = TERM_LANGS.some((l) => l.id === lang) ? lang : "en";
  const sets = termSetsOf(property);
  return {
    id,
    version: sets.version,
    sections: sets.locales?.[id] || sets.sections,
    labels: TERM_SECTION_LABELS[id] || TERM_SECTION_LABELS.en,
    ui: TERM_UI[id] || TERM_UI.en,
  };
}

export function fillPolicyVars(text, property) {
  const pol = policiesOf(property);
  const map = {
    ...pol,
    advancePercent: Number(pol.advancePercent) || 0,
    cancellationPercent: Number(pol.cancellationPercent) || 0,
    refundAdvanceLabel: pol.refundAdvance ? "Yes" : "No",
    taxPercent: property?.taxPercent ?? 0,
    taxName: property?.taxName || "GST",
    name: property?.name || "Gayatri Convention",
  };
  return String(text || "").replace(/\{(\w+)\}/g, (_, key) => (map[key] != null ? String(map[key]) : `{${key}}`));
}

/** Concrete cancellation figures from Master / Settings policies — always shown to guests. */
export function cancelPolicyNumberLines(property, lang = "en") {
  const pol = policiesOf(property);
  const advance = Number(pol.advancePercent) || 0;
  const cancelPct = Number(pol.cancellationPercent) || 0;
  const refund = !!pol.refundAdvance;
  if (lang === "te") {
    return [
      `బుకింగ్ ధృవీకరణకు అడ్వాన్స్: ${advance}%.`,
      `రద్దు ఛార్జీ: బుకింగ్ మొత్తంపై ${cancelPct}%.`,
      `అతిథి రద్దుపై అడ్వాన్స్ రీఫండ్: ${refund ? "అవును (రద్దు ఛార్జీ తర్వాత)" : "లేదు"}.`,
      refund
        ? `రీఫండ్ ఉంటే, ${cancelPct}% రద్దు ఛార్జీ తగ్గించి మిగిలినది చెల్లిస్తారు.`
        : `అతిథి రద్దు లేదా నో-షోలో అడ్వాన్స్ ఉంచుకుంటారు (${cancelPct}% రద్దు ఛార్జీ).`,
    ];
  }
  if (lang === "hi") {
    return [
      `बुकिंग पक्की करने के लिए अग्रिम: ${advance}%.`,
      `रद्दीकरण शुल्क: बुकिंग कुल का ${cancelPct}%.`,
      `अतिथि रद्द करने पर अग्रिम रिफंड: ${refund ? "हाँ (शुल्क काटने के बाद)" : "नहीं"}.`,
      refund
        ? `रिफंड हो तो ${cancelPct}% रद्दीकरण शुल्क काटकर शेष दिया जाएगा।`
        : `अतिथि रद्द या नो-शो पर अग्रिम जब्त (${cancelPct}% रद्दीकरण शुल्क)।`,
    ];
  }
  return [
    `Advance to confirm booking: ${advance}%.`,
    `Cancellation charge: ${cancelPct}% of the booking total.`,
    `Refund of advance on guest cancel: ${refund ? "Yes (after cancellation charge)" : "No"}.`,
    refund
      ? `If a refund is paid, ${cancelPct}% cancellation charge is deducted first.`
      : `On guest cancel or no-show, advance is forfeited (${cancelPct}% cancellation charge).`,
  ];
}

export function sectionLines(text, property) {
  return fillPolicyVars(text, property)
    .split(/\n+/)
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
}

/** Cancellation T&C lines with Master policy numbers always filled in. */
export function cancelSectionLines(property, lang = "en") {
  const sets = termSetsOf(property);
  const prose = sectionLines(sets.locales?.[lang]?.cancel || sets.sections.cancel, property);
  const numbers = cancelPolicyNumberLines(property, lang);
  // Prefer number lines first; keep prose clauses that are not duplicates of the % facts.
  const seen = new Set(numbers.map((l) => l.toLowerCase()));
  const rest = prose.filter((line) => {
    const low = line.toLowerCase();
    if (seen.has(low)) return false;
    if (/\d+\s*%/.test(line) && /cancel|refund|advance|రద్దు|అడ్వాన్స్|रद्द|अग्रिम/i.test(line)) return false;
    return true;
  });
  return [...numbers, ...rest];
}

export function allTermLines(property) {
  const sets = termSetsOf(property);
  return TERM_SECTIONS.flatMap((sec) => {
    const lines = sectionLines(sets.sections[sec.id], property);
    return lines.length ? [sec.label, ...lines] : [];
  });
}

export function termsLines(property) {
  const sets = termSetsOf(property);
  return TERM_SECTIONS.flatMap((sec) => sectionLines(sets.sections[sec.id], property));
}

export function suggestedAdvance(total, property) {
  const pct = Number(policiesOf(property).advancePercent) || 0;
  return Math.max(0, Math.round((Number(total) || 0) * pct / 100));
}

export function cancellationCharge(total, property) {
  const pol = policiesOf(property);
  if (pol.refundAdvance) return Math.round((Number(total) || 0) * (Number(pol.cancellationPercent) || 0) / 100);
  return Number(total) || 0;
}

export function occupancyOf(room) {
  const occ = ["Available", "Reserved", "Occupied", "Out of order", "Maintenance"];
  if (occ.includes(room?.status)) return room.status;
  return "Available";
}

export function housekeepingOf(room) {
  const hk = ["Clean", "Dirty", "Cleaning", "Inspected"];
  if (hk.includes(room?.hkStatus)) return room.hkStatus;
  if (hk.includes(room?.status)) return room.status;
  return "Clean";
}
