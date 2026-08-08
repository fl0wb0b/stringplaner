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

- [x] 2a: Import-Script `/scripts/import-cec.mjs` – CEC-CSV → `public/data/modules.json` (21.641 Module)
- [x] 2b: GitHub Action: monatlicher Cron + manueller Trigger für CEC-Update (`update-cec.yml`)
- [x] 2c: Victron-MPPT-Laderegler erfasst → `public/data/inverters_victron.json`
      (SmartSolar 75/15 bis 250/100 + RS 450/100 und RS 450/200;
      **Werte vor Verlass darauf gegen aktuelle Datenblätter prüfen!**)
- [x] 2d: Allgemeines String-Wechselrichter-Starter-Set erfasst →
      `public/data/inverters_manual.json` (SMA Sunny Boy, Fronius Primo/Symo,
      Huawei SUN2000, Growatt MIN, Hoymiles HM – **ebenfalls gegen Datenblätter
      prüfen**; Erweiterung per PR, Schema siehe README)

## Schritt 3: Rechenkern

- [x] 3a: `src/lib/calc.ts` – reine Funktionen gemäß CLAUDE.md Abschnitt 6
- [x] 3b: Unit-Tests (Vitest, `src/lib/calc.test.ts`, 13 Tests) – handgerechnete
      Referenzwerte; TODO: zusätzlich echte Victron-Tool-Referenzfälle ergänzen
- [x] 3c: Statusmodell (ok / warnung / fehler) + Gesamtstatus-Priorisierung
      (Warnung überdeckt nie einen Fehler)

## Schritt 4: UI

- [x] 4a: Eingabe-Flow – Modulsuche (uFuzzy + react-virtual), Geräteauswahl,
      Tracker-Auswahl, Serien-/Parallelanzahl, Temperaturgrenzen,
      Kabellänge/Querschnitt; Ergebnis als Ampel-Tabelle
- [x] 4b: Spannungs-/Temperatur-Graph (recharts): Voc-/Vmp-Kurven über
      Temperaturbereich, Gerätegrenzen als ReferenceLines, gewählte
      Grenztemperaturen als vertikale Marker
- [x] 4c: Speichern & Teilen – Konfiguration als URL-Query-Parameter
      (stabile Slugs `manufacturer__model_name`), localStorage-Fallback,
      Teilen-Button (Clipboard)

## Schritt 5: Feinschliff

- [ ] Offline-Caching der JSON-Daten prüfen (iOS Safari + Android Chrome)
- [ ] "Zum Home-Bildschirm"-Test auf iPhone/iPad
- [ ] Lighthouse-PWA-Audit
