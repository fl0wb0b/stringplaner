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

## Projektkontext

- **[CLAUDE.md](CLAUDE.md)** – vollständige Spezifikation: Architektur,
  Datenmodell, Rechenkern, Lizenz-Regeln. Vor jeder Änderung lesen.
- **[TASKS.md](TASKS.md)** – Umsetzungsplan und Arbeitsstand.

## Stack

React 18 · Vite · TypeScript · Tailwind CSS v4 · vite-plugin-pwa ·
recharts · uFuzzy · @tanstack/react-virtual
