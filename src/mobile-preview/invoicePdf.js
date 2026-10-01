import { jsPDF } from "jspdf";

const PROPERTY = {
  tagline: "Convention",
  name: "Gayatri Convention",
  address: [
    "Palagummi Village, Razole Mandal",
    "Dr. B.R.A. Konaseema",
    "Andhra Pradesh 533249",
  ],
  phone: "+91 98496 00555",
  email: "gayatriconventionandresorts@gmail.com",
  timezone: "Asia/Kolkata",
  currency: "INR",
};

function inr(n) {
  const value = Math.round(Number(n) || 0);
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `Rs. ${value}`;
  }
}

function payKind(type) {
  if (type === "Advance") return "Advance";
  if (type === "Final") return "Final payment";
  if (type === "Refund" || type === "Deposit return") return "Refund";
  if (type === "Deposit") return "Deposit";
  return "Settlement";
}

function isOut(type) {
  return type === "Refund" || type === "Deposit return";
}

function isCollection(type) {
  return !["Refund", "Deposit return", "Deposit"].includes(type);
}

function slotLabel(booking) {
  const slot = String(booking?.slot || "").trim();
  if (slot) return slot;
  const pack = String(booking?.package || "").toLowerCase();
  if (pack.includes("half")) return "half-day";
  if (pack.includes("full")) return "full-day";
  return "full-day";
}

function slotWindow(booking) {
  const date = String(booking?.date || "").slice(0, 10);
  const slot = slotLabel(booking).toLowerCase();
  if (slot.includes("night")) return date;
  if (slot.includes("half")) return `${date} 09:00 → ${date} 16:00`;
  return `${date} 08:00 → ${date} 23:00`;
}

function whenText(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function modeLine(rows) {
  const map = {};
  rows.forEach((row) => {
    const mode = String(row.mode || "Other").trim() || "Other";
    map[mode] = (map[mode] || 0) + (Number(row.amount) || 0);
  });
  const parts = Object.entries(map).filter(([, amount]) => amount > 0);
  if (!parts.length) return "—";
  return parts.map(([mode, amount]) => `${mode} ${inr(amount)}`).join(" · ");
}

function drawInvoice(booking, bill, hallLabel, payments) {
  const width = 780;
  const height = 1120;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const ink = "#15202b";
  const muted = "#5d6b78";
  const line = "#d8dee6";
  const left = 36;
  const right = width - 36;
  ctx.strokeStyle = "#e4e9ee";
  ctx.strokeRect(18, 18, width - 36, height - 36);

  const slot = slotLabel(booking);
  const pays = (payments || []).filter((payment) => payment.bookingNo === booking.no);
  const collections = pays.filter((payment) => isCollection(payment.type || (payment.kind === "refund" ? "Refund" : "Payment")));
  const refunds = pays.filter((payment) => {
    const type = payment.type || (payment.kind === "refund" ? "Refund" : "");
    return type === "Refund" || type === "Deposit return";
  });
  const sumType = (type) => collections.filter((payment) => (payment.type || "") === type).reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const advance = sumType("Advance");
  const finalPay = sumType("Final");
  const other = collections
    .filter((payment) => !["Advance", "Final"].includes(payment.type || ""))
    .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const refundTotal = refunds.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const paidNet = collections.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0) - refundTotal;
  const total = Number(bill?.total) || Number(booking.total) || 0;
  const withGst = booking.gstMode === "with";
  const gstAmount = withGst ? (Number(bill?.gst) || Math.round((total * 18) / 118)) : 0;
  const hallAmount = withGst ? Math.max(0, total - gstAmount) : total;
  const balance = Math.round(total - paidNet);

  ctx.fillStyle = muted;
  ctx.font = "13px Segoe UI, Noto Sans, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(PROPERTY.tagline, left, 52);
  ctx.fillStyle = ink;
  ctx.font = "32px Georgia, Times New Roman, serif";
  ctx.fillText(PROPERTY.name, left, 86);
  ctx.fillStyle = muted;
  ctx.font = "13px Segoe UI, Noto Sans, sans-serif";
  let y = 108;
  PROPERTY.address.forEach((row) => {
    ctx.fillText(row, left, y);
    y += 18;
  });
  ctx.fillText(`${PROPERTY.phone} · ${PROPERTY.email}`, left, y);
  y += 18;
  ctx.fillText("Gayatri GST —", left, y);

  ctx.textAlign = "right";
  ctx.fillText("Party booking no.", right, 52);
  ctx.fillStyle = ink;
  ctx.font = "700 16px Segoe UI, Noto Sans, sans-serif";
  ctx.fillText(booking.no || "", right, 74);
  ctx.fillStyle = muted;
  ctx.font = "12px Segoe UI, Noto Sans, sans-serif";
  ctx.fillText("Use this number to find the party later", right, 94);
  const status = String(booking.status || "Confirmed").toUpperCase();
  const badgeW = ctx.measureText(status).width + 18;
  const badgeX = right - badgeW;
  ctx.strokeStyle = "#8fd0a8";
  ctx.fillStyle = "#f3fbf6";
  roundRect(ctx, badgeX, 104, badgeW, 22, 6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#1f7a4d";
  ctx.font = "700 11px Segoe UI, Noto Sans, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(status, badgeX + badgeW / 2, 119);
  ctx.textAlign = "right";
  ctx.fillStyle = muted;
  ctx.font = "13px Segoe UI, Noto Sans, sans-serif";
  const gstHead = withGst ? "GST · GST 18%" : "GST · Without GST";
  ctx.fillText(gstHead, right, 148);
  ctx.fillText(`${PROPERTY.currency} · ${PROPERTY.timezone}`, right, 168);

  y = 196;
  for (let x = left; x < right; x += 18) {
    ctx.fillStyle = x % 36 < 8 ? "#7a1f2b" : "#c4a35a";
    ctx.fillRect(x, y, 8, 6);
  }
  y = 232;
  ctx.textAlign = "left";
  ctx.fillStyle = muted;
  ctx.fillText("Bill to", left, y);
  ctx.fillStyle = ink;
  ctx.font = "700 16px Segoe UI, Noto Sans, sans-serif";
  ctx.fillText(booking.guest || "", left, y + 22);
  ctx.font = "14px Segoe UI, Noto Sans, sans-serif";
  ctx.fillText(booking.phone || "", left, y + 42);
  ctx.fillStyle = muted;
  ctx.font = "13px Segoe UI, Noto Sans, sans-serif";
  ctx.fillText(booking.address || "", left, y + 62);
  ctx.fillText(`Customer GST ${booking.gst ? booking.gst : "—"}`, left, y + 82);

  ctx.textAlign = "right";
  ctx.fillStyle = ink;
  ctx.font = "14px Segoe UI, Noto Sans, sans-serif";
  const place = `${hallLabel || "Rooms"} · ${slot} · ${slotWindow(booking)}`;
  wrapRight(ctx, place, right, y + 8, 360, 18);

  y = 360;
  ctx.textAlign = "left";
  ctx.fillStyle = muted;
  ctx.font = "11px Segoe UI, Noto Sans, sans-serif";
  ctx.fillText("CHARGE", left, y);
  ctx.textAlign = "right";
  ctx.fillText("QTY", 470, y);
  ctx.fillText("RATE", 600, y);
  ctx.fillText("AMOUNT", right, y);
  y += 8;
  rule(ctx, left, y, right, line);

  y += 28;
  ctx.textAlign = "left";
  ctx.fillStyle = ink;
  ctx.font = "700 14px Segoe UI, Noto Sans, sans-serif";
  ctx.fillText("Hall", left, y);
  y += 28;
  ctx.font = "14px Segoe UI, Noto Sans, sans-serif";
  ctx.fillText("Booked charges", left, y);
  ctx.fillStyle = muted;
  ctx.font = "12px Segoe UI, Noto Sans, sans-serif";
  ctx.fillText("Hall charge (extra)", left, y + 16);
  ctx.fillStyle = ink;
  ctx.font = "14px Segoe UI, Noto Sans, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("1", 470, y);
  ctx.fillText(inr(0), 600, y);
  ctx.fillText(inr(hallAmount), right, y);
  y += 28;
  rule(ctx, left, y, right, line);

  const rows = [
    ["Hall subtotal", inr(hallAmount), false],
    ["Subtotal", inr(hallAmount), false],
    ["Discount", inr(0), false],
  ];
  if (!withGst) {
    rows.push(["GST", `Without GST · ${inr(0)}`, false]);
  } else {
    const half = Math.round(gstAmount / 2);
    rows.push(["Taxable value", inr(hallAmount), false]);
    rows.push(["CGST (9.0%)", inr(half), false]);
    rows.push(["SGST (9.0%)", inr(gstAmount - half), false]);
    rows.push(["GST 18%", inr(gstAmount), false]);
  }
  rows.push(["Total", inr(total), true]);
  rows.push(["Advance paid", inr(advance), false]);
  rows.push(["Final payment", inr(finalPay), false]);
  rows.push(["Other collections", inr(other), false]);
  rows.push(["Customer paid by mode", modeLine(collections), false]);
  rows.push(["Refund amount", refundTotal > 0 ? inr(refundTotal) : "—", false]);
  rows.push(["Hotel refund by mode", refundTotal > 0 ? modeLine(refunds) : "—", false]);
  rows.push(["Paid (all, net)", inr(paidNet), false]);
  rows.push([balance < 0 ? "Guest credit with hotel" : "Remaining to collect", inr(Math.abs(balance)), true]);

  rows.forEach(([label, value, strong]) => {
    y += 26;
    ctx.textAlign = "left";
    ctx.fillStyle = label === "Remaining to collect" && balance > 0 ? "#b42318" : ink;
    ctx.font = `${strong ? "700 " : ""}14px Segoe UI, Noto Sans, sans-serif`;
    ctx.fillText(label, left, y);
    ctx.textAlign = "right";
    ctx.fillText(value, right, y);
    y += 10;
    rule(ctx, left, y, right, line);
  });

  y += 36;
  ctx.textAlign = "left";
  ctx.fillStyle = muted;
  ctx.font = "11px Segoe UI, Noto Sans, sans-serif";
  const cols = [left, 190, 270, 390, 500, 610, right];
  const heads = ["DATE", "IN / OUT", "KIND", "MODE", "AMOUNT", "RECEIPT / REF", "NOTES"];
  heads.forEach((head, index) => {
    ctx.textAlign = index >= 4 ? "right" : "left";
    ctx.fillText(head, cols[index], y);
  });
  y += 8;
  rule(ctx, left, y, right, line);

  const sorted = [...pays].sort((a, b) => String(a.at || a.date).localeCompare(String(b.at || b.date)));
  sorted.forEach((payment) => {
    y += 26;
    const type = payment.type || (payment.kind === "refund" ? "Refund" : "Payment");
    const cells = [
      whenText(payment.at || payment.date),
      isOut(type) ? "Out" : "In",
      payKind(type),
      payment.mode || "—",
      inr(payment.amount),
      payment.ref || "—",
      "—",
    ];
    ctx.fillStyle = ink;
    ctx.font = "13px Segoe UI, Noto Sans, sans-serif";
    cells.forEach((cell, index) => {
      ctx.textAlign = index >= 4 ? "right" : "left";
      ctx.fillText(String(cell), cols[index], y);
    });
    y += 10;
    rule(ctx, left, y, right, line);
  });

  const used = Math.min(height, y + 36);
  const crop = document.createElement("canvas");
  crop.width = canvas.width;
  crop.height = used * scale;
  crop.getContext("2d").drawImage(canvas, 0, 0, canvas.width, used * scale, 0, 0, canvas.width, used * scale);
  return crop;
}

function rule(ctx, x1, y, x2, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapRight(ctx, text, x, y, maxWidth, step) {
  const words = String(text || "").split(" ");
  let line = "";
  const lines = [];
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line) lines.push(line);
  lines.forEach((row, index) => ctx.fillText(row, x, y + index * step));
}

export async function invoicePdfFile(booking, bill, hallLabel, payments) {
  const canvas = drawInvoice(booking, bill, hallLabel, payments);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const margin = 10;
  const imgW = pageW - margin * 2;
  const imgH = (canvas.height / canvas.width) * imgW;
  pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, imgW, imgH);
  const blob = pdf.output("blob");
  const name = `${booking.no || "invoice"}-invoice.pdf`;
  return new File([blob], name, { type: "application/pdf" });
}

export async function shareInvoiceFile(file, app, phone) {
  const text = `Gayatri Convention invoice ${String(file.name || "").replace(/-invoice\.pdf$/i, "")}`;
  if (navigator.share) {
    const payload = { files: [file], title: file.name, text };
    const allowed = !navigator.canShare || navigator.canShare({ files: [file] });
    if (allowed) {
      try {
        await navigator.share(payload);
        return "shared";
      } catch (err) {
        if (err?.name === "AbortError") return "cancel";
      }
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  if (app === "gmail") {
    const mail = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(file.name)}&body=${encodeURIComponent(`${text}. The invoice PDF is saved on this phone — attach that file if it is not already attached.`)}`;
    window.open(mail, "_blank", "noopener,noreferrer");
  } else {
    const digits = String(phone || "").replace(/\D/g, "");
    const path = digits ? `https://wa.me/${digits}?text=` : "https://wa.me/?text=";
    window.open(`${path}${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }
  return "fallback";
}
