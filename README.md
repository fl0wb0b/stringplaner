# Stringplaner

Herstellerunabhängiger PV-String-Rechner als PWA – prüft, ob eine geplante
PV-Modul-Verschaltung (Module in Serie × Strings parallel) zu einem MPPT-
Laderegler oder String-Wechselrichter passt: spannungs-, strom- und
leistungsseitig, unter Berücksichtigung von Temperatureinflüssen.

Funktioniert wie der Victron String Calculator, unterstützt aber beliebige
Geräte (Victron, Huawei, SMA, Fronius, …). Rein clientseitig, offline-fähig,
gehostet auf GitHub Pages.

## Entwicklung

```bash
npm install
npm run dev         # Dev-Server
npm run test        # Unit-Tests (Rechenkern)
npm run build       # Produktions-Build nach dist/
npm run preview     # Build lokal testen
npm run import:cec  # CEC-Moduldaten neu importieren
```

## Moduldaten erweitern

Die Modulsuche speist sich aus zwei Quellen, die die App zusammenführt:
`public/data/modules.json` (automatisch generiert aus der CEC-Datenbank,
nicht von Hand editieren) und `public/data/modules_manual.json` (händisch
gepflegt – für EU-Markt-Module, die in der CEC-Liste fehlen). Bei gleichem
Hersteller+Modell gewinnt der manuelle Eintrag. Schema pro Modul:

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
  "source_url": "https://…",         // Pflicht: Link zum Datenblatt/Produktseite
  "trackers": [                      // ein Eintrag pro MPPT-Eingang
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

## Projektkontext

- **[CLAUDE.md](CLAUDE.md)** – vollständige Spezifikation: Architektur,
  Datenmodell, Rechenkern, Lizenz-Regeln. Vor jeder Änderung lesen.
- **[TASKS.md](TASKS.md)** – Umsetzungsplan und Arbeitsstand.

## Stack

React 18 · Vite · TypeScript · Tailwind CSS v4 · vite-plugin-pwa ·
recharts · uFuzzy · @tanstack/react-virtual
