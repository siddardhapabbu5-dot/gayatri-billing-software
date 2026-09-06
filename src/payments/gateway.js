/**
 * Gayatri payment gateway client.
 * Modes: mock (local demo) | razorpay (live/test keys via backend).
 */

const SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

export function gatewayConfigFromProperty(property) {
  const g = property?.paymentGateway || {};
  return {
    enabled: g.enabled !== false,
    mode: g.mode === "razorpay" ? "razorpay" : "mock",
    keyId: String(g.keyId || "").trim(),
    businessName: property?.name || "Gayatri Convention",
  };
}

function loadRazorpayScript() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`);
    if (existing) {
      if (window.Razorpay) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Razorpay script failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load Razorpay checkout"));
    document.body.appendChild(s);
  });
}

async function createOrderApi(payload, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch("/api/payments/gateway/order", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    throw new Error("Staff login required (JWT) before Razorpay orders. Sign in again, then retry.");
  }
  if (!res.ok) throw new Error(data.error || data.message || "Could not create payment order");
  return data;
}

async function verifyApi(payload, token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch("/api/payments/gateway/verify", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    throw new Error("Staff login expired during payment. Sign in again and verify the Razorpay dashboard before posting manually.");
  }
  if (!res.ok) throw new Error(data.error || data.message || "Payment verification failed");
  return data;
}

/**
 * Opens checkout (mock or Razorpay). Resolves with payment result for posting to folio.
 */
export async function collectViaGateway({
  amountInr,
  bookingNumber,
  guestName,
  guestPhone,
  guestEmail,
  description,
  property,
  authToken,
  preferMethod,
}) {
  const amount = Math.round(Number(amountInr) || 0);
  if (amount < 1) throw new Error("Enter an amount greater than zero");

  const cfg = gatewayConfigFromProperty(property);
  if (!cfg.enabled) throw new Error("Payment gateway is disabled in Settings");

  const amountPaise = amount * 100;
  const receipt = String(bookingNumber || `rcpt_${Date.now()}`).slice(0, 40);
  const method = preferMethod && preferMethod !== "Cash" ? preferMethod : "UPI";

  // Mock gateway — no bank keys / backend required
  if (cfg.mode === "mock") {
    await new Promise((r) => setTimeout(r, 400));
    const ok = window.confirm(
      `Mock gateway\n\nCollect ₹${amount.toLocaleString("en-IN")} for ${bookingNumber || "bill"}?\n\nGuest: ${guestName || "—"}\nThis simulates UPI / Card / NetBanking success.`
    );
    if (!ok) {
      const err = new Error("Payment cancelled");
      err.cancelled = true;
      throw err;
    }
    return {
      ok: true,
      provider: "mock",
      method,
      amount,
      ref: `MOCK-${Date.now().toString(36).toUpperCase()}`,
      orderId: `order_mock_${Date.now()}`,
      paymentId: `pay_mock_${Date.now()}`,
    };
  }

  // Razorpay — require public key + staff JWT + live backend keys
  if (!cfg.keyId) {
    throw new Error("Razorpay Key ID missing. Add it in Settings → Payment gateway, or switch mode to Mock.");
  }
  if (!authToken) {
    throw new Error("Staff login required for Razorpay. Sign in on the desk, then retry Pay via gateway.");
  }

  const order = await createOrderApi(
    {
      amountPaise,
      currency: "INR",
      receipt,
      notes: {
        booking: bookingNumber || "",
        guest: guestName || "",
        description: description || "Gayatri Convention payment",
      },
    },
    authToken
  );

  if (order.mode !== "razorpay" || !order.orderId || String(order.orderId).startsWith("order_mock_")) {
    throw new Error(
      "Backend Razorpay is not live. Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and app.razorpay.enabled=true, restart API, then retry."
    );
  }

  const checkoutKey = order.keyId || cfg.keyId;
  if (!checkoutKey) {
    throw new Error("Razorpay key not returned by server. Check backend app.razorpay.key-id.");
  }

  await loadRazorpayScript();

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: checkoutKey,
      amount: order.amountPaise || amountPaise,
      currency: order.currency || "INR",
      name: cfg.businessName,
      description: description || `Payment · ${bookingNumber || ""}`,
      order_id: order.orderId,
      prefill: {
        name: guestName || "",
        contact: String(guestPhone || "").replace(/\D/g, "").slice(-10),
        email: guestEmail || "",
      },
      theme: { color: "#0f766e" },
      handler: async (response) => {
        try {
          await verifyApi(
            {
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            },
            authToken
          );
          resolve({
            ok: true,
            provider: "razorpay",
            method,
            amount,
            ref: response.razorpay_payment_id,
            orderId: response.razorpay_order_id,
            paymentId: response.razorpay_payment_id,
          });
        } catch (e) {
          reject(e);
        }
      },
      modal: {
        ondismiss: () => {
          const err = new Error("Payment cancelled");
          err.cancelled = true;
          reject(err);
        },
      },
    });
    rzp.on("payment.failed", (resp) => {
      reject(new Error(resp?.error?.description || "Payment failed"));
    });
    rzp.open();
  });
}
