export const GA_ID = process.env.REACT_APP_GA_ID || "G-4JSRS1M7HR";

function hasGtag() {
  return typeof window !== "undefined" && typeof window.gtag === "function";
}

export function pageview(path) {
  if (!hasGtag()) return;
  window.gtag("config", GA_ID, { page_path: path });
}

export function event(name, params = {}) {
  if (!hasGtag()) return;
  window.gtag("event", name, params);
}
