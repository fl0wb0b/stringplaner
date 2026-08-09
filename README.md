# Stringplaner

Herstellerunabhängiger PV-String-Rechner als PWA – prüft, ob eine geplante
PV-Modul-Verschaltung (Module in Serie × Strings parallel) zu einem MPPT-
Laderegler oder String-Wechselrichter passt: spannungs-, strom- und
leistungsseitig, unter Berücksichtigung von Temperatureinflüssen und
Kabelverlusten.

Funktioniert wie der Victron String Calculator, unterstützt aber beliebige
Geräte und Module (Victron, Huawei, SMA, Fronius, Deye, Growatt, JA Solar,
Aiko, Trina, …). Rein clientseitig, offline-fähig, gehostet auf GitHub
Pages: **https://planer.fl0wb0b.com/**

## Funktionsumfang

1. **Wechselrichter/MPPT wählen** – Geräteauswahl nach Hersteller, bei
   Geräten mit mehreren unabhängigen MPPT-Eingängen (Wechselrichter) werden
   alle Tracker parallel konfiguriert; Balkonkraftwerk-Mikrowechselrichter
   (<900 W AC) stehen gesammelt am Ende der Liste. Victron-Laderegler mit
   Batteriespannungs-Varianten nutzen einen Einzel-Dropdown.
2. **Modul wählen** – Volltextsuche über die gesamte Modul-Datenbank
   (uFuzzy + virtualisierte Liste) oder eigene Werte manuell eintragen wie
   beim Victron-Rechner. Plus Min./Max.-Temperatur und Kabellänge/-querschnitt
   für die Spannungsfall-Berechnung.
3. **Tracker/Strings konfigurieren** – Module in Serie × Strings parallel je
   Tracker, mit Ampel-Ergebnis (ok/Warnung/Fehler), Spannungs-/Temperatur-
   Graph und optional einem abweichenden Modul pro Tracker (z. B. bei
   Anlagen-Erweiterungen, wenn das Original-Modul nicht mehr lieferbar ist).
4. **Gesamtleistung** – DC/AC-Verhältnis mit Übergrößen-Warnung (>1,3),
   farblich verknüpfte Leistungsverteilung über alle Tracker, PLZ-basierte
   Jahresertrags-Schätzung mit Monatsverlauf.

Konfigurationen lassen sich per URL teilen (Button „Konfiguration
speichern“) oder bleiben lokal per localStorage erhalten. Keine Anmeldung,
keine Cloud, keine Werbung.

## Datenstand

- **~21.680 PV-Module**: CEC-Datenbank (automatisch importiert) + händisch
  gepflegte EU-Markt-Module (Aiko, JA Solar, Trina, Jolywood, SoliTek, Solyco)
- **254 Wechselrichter/Laderegler**: allgemeines Starter-Set großer Marken
  (SMA, Fronius, Huawei, Growatt, GoodWe, Solis, SofarSolar, SolaX, Kaco,
  Fox ESS, Deye, Hoymiles, APsystems, Enphase, Kostal, Sungrow u. a.) plus
  die komplette aktuelle Victron-SmartSolar-/RS-Palette
- **Automatischer Datenblatt-Scan**: ein wöchentlicher GitHub-Actions-Lauf
  durchsucht konfigurierte Shop-/Herstellerseiten (aktuell solarhandel24,
  venturama, tepto, solarscouts) nach neuen Modul-Datenblättern, extrahiert
  die STC-Werte, prüft sie auf Plausibilität (Vmp×Imp ≈ Pmax) und öffnet bei
  Treffern automatisch einen Pull Request zur Prüfung – nichts landet
  ungeprüft auf `main` (siehe `scripts/scan-modules.mjs`,
  `.github/workflows/scan-modules.yml`)

Datenqualität: nur Werte, die eindeutig aus einem Datenblatt hervorgehen,
werden übernommen. Aggregierte Summenwerte (z. B. Gesamtstrom über mehrere
MPPT-Eingänge) werden bewusst ausgelassen statt geraten.

## Entwicklung

```bash
npm install
npm run dev         # Dev-Server
npm run test        # Unit-Tests (Rechenkern)
npm run build       # Produktions-Build nach dist/
npm run preview     # Build lokal testen
npm run import:cec  # CEC-Moduldaten neu importieren
npm run scan        # Datenblatt-Scan lokal ausführen (node scripts/scan-modules.mjs)
```

## Moduldaten erweitern

Die Modulsuche speist sich aus zwei Quellen, die die App zusammenführt:
`public/data/modules.json` (automatisch generiert aus der CEC-Datenbank,
nicht von Hand editieren) und `public/data/modules_manual.json` (händisch
gepflegt – für EU-Markt-Module, die in der CEC-Liste fehlen, oder aus dem
automatischen Scan). Bei gleichem Hersteller+Modell gewinnt der manuelle
Eintrag. Schema pro Modul:

```jsonc
{
  "manufacturer": "Hersteller",
  "model_name": "Modellbezeichnung",
  "power_stc": 450,          // Wp
  "voc": 38.5,               // V bei STC
  "vmp": 32.1,               // V bei STC
  "isc": 14.2,               // A bei STC
  "imp": 13.5,               // A bei STC
  "temp_coeff_voc": -0.25,   // %/°C
  "temp_coeff_pmax": -0.3,   // %/°C
  "temp_coeff_isc": 0.006,   // A/°C absolut (= %/°C-Wert × Isc / 100)
  "source": "manual",
  "source_url": "https://…"  // Pflicht: Datenblatt/Herstellerseite
}
```

## Gerätedaten erweitern

Die Geräteliste ist ein allgemeines, erweiterbares Starter-Set – Ergänzungen
sind willkommen (Pull Request oder Issue). Neue Geräte kommen in
`public/data/inverters_manual.json` (Victron-Laderegler in
`public/data/inverters_victron.json`). Pro Gerät:

```jsonc
{
  "manufacturer": "Hersteller",
  "model_name": "Modellbezeichnung",
  "device_type": "mppt_charger | string_inverter | hybrid",
  "ac_power_nominal_w": 5000,        // nur Wechselrichter/Hybrid
  "tracker_mode": "independent",     // "independent" (Standard, mehrere unabhängige
                                      // Tracker) oder "variants" (Batteriespannungs-
                                      // Varianten wie bei Victron, nur eine aktiv)
  "source_url": "https://…",         // Pflicht: Link zum Datenblatt/Produktseite
  "trackers": [                      // ein Eintrag pro MPPT-Eingang bzw. Variante
    {
      "tracker_label": "MPPT 1",
      "v_mppt_min": 140,             // V, untere MPPT-Grenze
      "v_mppt_max": 980,             // V, obere MPPT-Grenze
      "v_max_absolute": 1100,        // V, absolute Maximalspannung (Geräteschutz)
      "i_max": 22,                   // A, max. Eingangsstrom
      "max_strings_parallel": 2,
      "p_max_w": 9000                // optional: PV-Leistungsgrenze pro Tracker
    }
  ]
}
```

Regeln: nur Zahlenwerte aus Datenblättern übernehmen, niemals Original-PDFs
oder Excel-Dateien committen (siehe CLAUDE.md Abschnitt 5). Alle Werte des
Starter-Sets sind aus Herstellerangaben zusammengetragen und sollten vor
Verlass darauf gegen das aktuelle Original-Datenblatt geprüft werden.

## Automatischer Datenblatt-Scan

`scripts/scan-modules.mjs` durchsucht die in
`data-sources/module_sources.json` konfigurierten Quellen nach PDF-
Datenblättern, extrahiert die elektrischen STC-Werte per `pdftotext`
(Multi-Spalten-Layouts sowie interleavte STC/NOCT-Tabellen wie bei Aiko
werden erkannt), validiert sie (Vmp×Imp ≈ Pmax, plausible Temperatur-
koeffizienten) und dedupliziert gegen die vorhandene Datenbank. Der
Workflow `.github/workflows/scan-modules.yml` läuft wöchentlich (Montag,
5:43 UTC) sowie manuell und öffnet bei neuen Treffern einen Pull Request
zur Prüfung. Bild-Datenblätter ohne Textebene werden im Report als „OCR
nötig“ gelistet statt geraten.

Neue Quelle hinzufügen: Eintrag in `data-sources/module_sources.json` mit
`url`, `pdf_pattern` (Regex für PDF-Links) und optional `follow_pattern`
(Regex für Produktseiten, die zuerst besucht werden).

## Projektkontext

- **[CLAUDE.md](CLAUDE.md)** – vollständige Spezifikation: Architektur,
  Datenmodell, Rechenkern, Lizenz-Regeln. Vor jeder Änderung lesen.
- **[TASKS.md](TASKS.md)** – Umsetzungsplan und Arbeitsstand.

## Stack

React 18 · Vite · TypeScript · Tailwind CSS v4 · vite-plugin-pwa ·
recharts · uFuzzy · @tanstack/react-virtual
