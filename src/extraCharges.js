export const GENERATORS = ["125 KVA", "250 KVA", "320 KVA", "500 KVA"];

export const EXTRA_FIELDS = [
  ["security", "Security", "Security charges"],
  ["cleaning", "Cleaning", "Cleaning charges"],
  ["dumping", "Dumping", "Dumping charges"],
  ["other", "Other", "Other charges"],
];

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function powerAmount(units, rate) {
  return Math.max(0, Math.round(num(units) * num(rate)));
}

export function emptyExtras() {
  return { generator: "", units: "", rate: "", security: "", cleaning: "", dumping: "", other: "" };
}

export function formFromCharges(lines) {
  const form = emptyExtras();
  for (const line of lines || []) {
    const category = String(line.category || "").toLowerCase();
    if (category === "power") {
      const match = String(line.description || "").match(/(\d+(?:\.\d+)?)\s*kva/i);
      form.generator = match ? `${match[1]} KVA` : "";
      form.units = line.qty != null ? String(line.qty) : "";
      form.rate = line.unitPrice != null ? String(line.unitPrice) : "";
    } else if (category === "security") form.security = String(line.amount || line.unitPrice || "");
    else if (category === "cleaning") form.cleaning = String(line.amount || line.unitPrice || "");
    else if (category === "dumping") form.dumping = String(line.amount || line.unitPrice || "");
    else if (category === "other" || category === "othercharge") form.other = String(line.amount || line.unitPrice || "");
  }
  return form;
}

export function chargesTotal(lines) {
  return (lines || []).reduce((sum, line) => sum + Math.round(num(line.amount)), 0);
}

export function draftExtrasTotal(form) {
  return powerAmount(form.units, form.rate)
    + Math.round(num(form.security))
    + Math.round(num(form.cleaning))
    + Math.round(num(form.dumping))
    + Math.round(num(form.other));
}

export function linesFromExtras(form) {
  const lines = [];
  const units = num(form.units);
  const rate = num(form.rate);
  const power = powerAmount(units, rate);
  if (power > 0) {
    const generator = String(form.generator || "").trim();
    lines.push({
      category: "Power",
      description: [generator, units ? `${units} units` : ""].filter(Boolean).join(" · ") || "Power bill",
      qty: units || 1,
      unitPrice: rate || power,
    });
  }
  for (const [key, category, label] of EXTRA_FIELDS) {
    const amount = Math.round(num(form[key]));
    if (amount > 0) {
      lines.push({ category, description: label, qty: 1, unitPrice: amount });
    }
  }
  return lines;
}
