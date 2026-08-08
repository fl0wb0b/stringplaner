# TASKS.md – Umsetzungsplan Stringplaner

Arbeitsstand-Tracking für die Umsetzung. Erledigte Punkte abhaken (`[x]`),
neue Erkenntnisse als Unterpunkte ergänzen. Referenziert aus CLAUDE.md.

---

## Schritt 1: Projekt-Setup

- [x] Repo anlegen (public, GitHub Pages)
- [x] Vite + React + TypeScript Scaffold
- [x] Tailwind CSS v4 (`@tailwindcss/vite`)
- [x] `vite-plugin-pwa` Grundkonfiguration (Manifest, Service Worker)
- [x] GitHub Actions: Build + Deploy auf GitHub Pages bei Push auf `main`
- [ ] PWA-Icons (192/512 px, maskable) erzeugen und einbinden
- [ ] GitHub Pages in den Repo-Settings auf "GitHub Actions" umstellen (manuell)

## Schritt 2: Datenbeschaffung

- [ ] 2a: Import-Script `/scripts/import-cec.ts` – CEC-CSV → `data/modules.json`
- [ ] 2b: GitHub Action: monatlicher Cron + manueller Trigger für CEC-Update
- [ ] 2c: Victron-MPPT-Geräte manuell erfassen → `data/inverters_victron.json`
- [ ] 2d: Eigene Geräte erfassen (Huawei SUN2000-12KTL, Hoymiles) → `data/inverters_manual.json`

## Schritt 3: Rechenkern

- [ ] 3a: `src/lib/calc.ts` – reine Funktionen gemäß CLAUDE.md Abschnitt 6
- [ ] 3b: Unit-Tests (Vitest) mit Referenzwerten aus dem Victron-Tool
- [ ] 3c: Statusmodell (ok / warnung / fehler) + Gesamtstatus-Priorisierung

## Schritt 4: UI

- [ ] 4a: Eingabe-Flow – Modulsuche (uFuzzy + react-virtual), Geräteauswahl,
      Tracker-Auswahl, Serien-/Parallelanzahl, Temperaturgrenzen,
      Kabellänge/Querschnitt; Ergebnis als Ampel-Tabelle
- [ ] 4b: Spannungs-/Temperatur-Graph (recharts): Voc-/Vmp-Kurven über
      Temperaturbereich, Gerätegrenzen als ReferenceLines, gewählte
      Grenztemperaturen als vertikale Marker
- [ ] 4c: Speichern & Teilen – Konfiguration als URL-Query-Parameter
      (stabile Slugs `manufacturer__model_name`), localStorage-Fallback

## Schritt 5: Feinschliff

- [ ] Offline-Caching der JSON-Daten prüfen (iOS Safari + Android Chrome)
- [ ] "Zum Home-Bildschirm"-Test auf iPhone/iPad
- [ ] Lighthouse-PWA-Audit
