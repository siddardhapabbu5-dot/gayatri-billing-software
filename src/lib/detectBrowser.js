/** In-app and system browser flags from the user agent. */
export function detectBrowser(userAgent) {
  const ua = userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "") || "";

  return {
    isFacebook: ua.includes("FBAN") || ua.includes("FBAV"),

    isInstagram: ua.includes("Instagram"),

    isTelegram: ua.includes("Telegram"),

    isWhatsApp: ua.includes("WhatsApp"),

    isChrome:
      (ua.includes("Chrome") || ua.includes("CriOS")) &&
      !ua.includes("Edg") &&
      !ua.includes("FBAN") &&
      !ua.includes("FBAV") &&
      !ua.includes("Instagram") &&
      !ua.includes("Telegram") &&
      !ua.includes("WhatsApp"),

    isAndroid: /Android/i.test(ua),

    isIOS: /iPhone|iPad|iPod/i.test(ua),
  };
}

export function isInAppBrowser(browser = detectBrowser()) {
  return Boolean(browser.isFacebook || browser.isInstagram || browser.isTelegram || browser.isWhatsApp);
}

export function browserName(browser = detectBrowser()) {
  if (browser.isFacebook) return "Facebook";
  if (browser.isInstagram) return "Instagram";
  if (browser.isTelegram) return "Telegram";
  if (browser.isWhatsApp) return "WhatsApp";
  if (browser.isChrome) return "Chrome";
  if (browser.isIOS) return "Safari";
  return "Browser";
}

/** Steps to leave the in-app browser and install from Chrome. */
export function inAppInstallSteps(browser = detectBrowser()) {
  if (browser.isFacebook) {
    return ["Tap Menu (⋮)", "Open in Browser", "Open in Chrome", "Install App"];
  }
  if (browser.isInstagram) {
    return ["Tap Menu (⋮)", "Open in Browser", "Chrome", "Install App"];
  }
  if (browser.isTelegram) {
    return ["Tap Menu (⋮)", "Open in External Browser", "Chrome", "Install App"];
  }
  if (browser.isWhatsApp) {
    return ["Tap Menu (⋮)", "Open in Browser", "Chrome", "Install App"];
  }
  return [];
}

/** Android Chrome intent, or the iOS Chrome scheme. Desktop stays on the https link. */
export function chromeLaunchUrl(href) {
  const url = new URL(href, typeof window !== "undefined" ? window.location.origin : "https://gayatriconvention.com");
  const bare = `${url.host}${url.pathname}${url.search}${url.hash}`;
  const browser = detectBrowser();
  if (browser.isAndroid) {
    return `intent://${bare}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url.href)};end`;
  }
  if (browser.isIOS) {
    return `googlechromes://${bare}`;
  }
  return url.href;
}
