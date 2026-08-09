import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "@fontsource/sedgwick-ave-display";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ("serviceWorker" in navigator) {
  registerSW({ immediate: true });
  // registerType "autoUpdate" only makes the client auto-reload once a new
  // worker has ACTIVATED — with workbox.skipWaiting/clientsClaim set, that
  // now happens on its own once the browser notices a new sw.js. But the
  // browser only checks for a new sw.js on its own throttled schedule
  // (rarely, especially for installed home-screen apps that stay open for
  // days) — registerSW()'s returned updateSW() doesn't force that check in
  // autoUpdate mode. Calling registration.update() directly does, so do it
  // whenever the app regains focus (app switch, relaunch).
  const forceUpdateCheck = () => {
    void navigator.serviceWorker.getRegistration().then((reg) => reg?.update());
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") forceUpdateCheck();
  });
  window.addEventListener("pageshow", forceUpdateCheck);
}
