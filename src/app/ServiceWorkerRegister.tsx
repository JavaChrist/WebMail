"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker (PWA) uniquement en production et si le
 * navigateur le supporte. Sans effet en développement pour ne rien casser.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* échec silencieux : la PWA reste utilisable sans SW */
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
