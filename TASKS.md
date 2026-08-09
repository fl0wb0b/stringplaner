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
- [x] PWA-Icons (192/512 px + apple-touch-icon) aus icon.svg gerendert und
      in Manifest/index.html eingebunden
- [x] GitHub Pages in den Repo-Settings auf "GitHub Actions" umstellen (manuell
      erledigt; Custom Domain planer.fl0wb0b.com eingerichtet)

## Schritt 2: Datenbeschaffung

- [x] 2a: Import-Script `/scripts/import-cec.mjs` – CEC-CSV → `public/data/modules.json` (21.641 Module)
- [x] 2b: GitHub Action: monatlicher Cron + manueller Trigger für CEC-Update (`update-cec.yml`)
- [x] 2c: Victron-MPPT-Laderegler erfasst → `public/data/inverters_victron.json`
      (komplette aktuelle SmartSolar-Palette 75/10 bis 250/100 inkl. 36V-Varianten
      + RS 450/100 und RS 450/200; Werte per Web-Recherche gegen offizielle
      Victron-Datenblätter abgeglichen, Quelle je Gerät in `source_url`)
- [x] 2d: Allgemeines String-Wechselrichter-Set erfasst →
      `public/data/inverters_manual.json` (SMA Sunny Boy 5.0 / Tripower 10.0,
      Fronius Primo GEN24 5.0 / Symo GEN24 10.0, Huawei SUN2000-6KTL-M1 /
      12KTL-M5, Growatt MIN 5000TL-X, Hoymiles HMS-800W-2T / HMS-2000-4T;
      Werte per Web-Recherche gegen Herstellerangaben abgeglichen;
      Erweiterung per PR, Schema siehe README)

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

## Schritt 5: Datenpflege-Automatik

- [x] 5a: Datenblatt-Scanner (`scripts/scan-modules.mjs`): scannt konfigurierte
      Quellen (`data-sources/module_sources.json`) nach Datenblatt-PDFs,
      extrahiert STC-Tabellen (pdftotext), validiert (Vmp×Imp≈Pmax u.a.)
      und schlägt neue Module vor
- [x] 5b: Workflow `scan-modules.yml`: wöchentlicher Cron + manueller Trigger,
      öffnet einen Pull Request mit den Vorschlägen (Review-Schleuse, kein
      Auto-Merge); Bild-PDFs ohne Textlayer werden im Report gelistet (OCR offen)
- [x] 5c: Erster echter Scan-Lauf geprüft und Parser nachgezogen: Aiko-Layout
      (STC/NOCT-Spalten interleaved, Kurzlabels "Pmax [W]"), Modellcodes mit
      Kleinbuchstaben, Koeffizienten-Vorzeichen mit Leerzeichen; Quellen:
      solarhandel24, venturama, tepto, solarscouts → erster Vorschlags-PR mit
      18 Aiko-Neostar-Klassen (PR #1)
      - venturama: Produktseiten verlinken keine PDFs direkt (JS) → 0 Treffer
      - JA-Solar-/Sunman-PDFs vielfach ohne Textlayer → OCR weiterhin offen
      - Repo-Einstellung "Allow GitHub Actions to create and approve pull
        requests" muss manuell aktiviert werden, bis dahin PR manuell
- [x] 5d: Trina/Longi-Parser-Tuning anhand der echten scan-debug-Logs (Job
      93215789633) behoben: Vmp-Zeile "Spannung im MPP-UMPP" (Trina, U- statt
      V-Präfix, umgekehrte Wortreihenfolge) erkannt; Temperaturkoeffizienten-
      Suche fand bei zweispaltigen Layouts teils falsche Werte, weil
      `pdftotext -layout` linke und rechte Spalte auf eine Zeile flacht (z.B.
      Longi: "Bifaciality 70±5%" stand vor dem echten Voc-Koeffizienten auf
      derselben Zeile) – Zahlensuche jetzt ab der Schlüsselwort-Position
      statt über die ganze Zeile; Vorzeichen-Erkennung um En-/Em-Dash
      erweitert (pdftotext rendert das Minus in einigen Datenblättern so statt
      als ASCII-Hyphen); Celsius-Erkennung um das Einzelzeichen-Glyph "℃"
      (U+2103) erweitert, das manche PDFs statt "°C" verwenden. Gegen echte
      Datenblatt-Extrakte aus dem Scan-Log verifiziert, 2 neue Regressions-
      Fixtures in `--parse-test` ergänzt. BNPI-dreifach-interleaved-Layout
      (ein einzelnes Trina-Doppelglas-Blatt mit STC/NOCT/BNPI-Spalten) bleibt
      offen – seltener Sonderfall, wird weiterhin sauber übersprungen statt
      falsch geparst.

## Schritt 6: Feinschliff

- [ ] Offline-Caching der JSON-Daten prüfen (iOS Safari + Android Chrome)
- [ ] "Zum Home-Bildschirm"-Test auf iPhone/iPad
- [ ] Lighthouse-PWA-Audit
