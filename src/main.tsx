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
  const updateSW = registerSW({ immediate: true });
  // iOS home-screen apps rarely re-check the service worker on their own —
  // force it whenever the installed app regains focus (app switch, relaunch).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void updateSW();
  });
  window.addEventListener("pageshow", () => void updateSW());
}
