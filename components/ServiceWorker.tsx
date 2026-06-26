"use client";

import { useEffect } from "react";

/** Registers the service worker (public/sw.js) for offline use. Production only —
 *  no caching during local dev. Renders nothing. */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* offline support is a progressive enhancement; ignore failures */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
