# Stringplaner (PV String Calculator PWA) – Projektkontext für Claude Code

Diese Datei ist der zentrale Kontext für Claude Code (oder jede andere KI-Instanz),
die an diesem Repo arbeitet. Sie beschreibt **Zweck, Architektur, Datenmodell,
Regeln und Constraints** des Projekts. Bei jeder neuen Session zuerst diese Datei lesen.

---

## 1. Zweck der App

Web-App (PWA), die wie der **Victron String Calculator** funktioniert, aber
herstellerunabhängig ist: sie prüft, ob eine geplante PV-Modul-Verschaltung
(Anzahl Module in Serie × Strings parallel) zu einem gewählten Laderegler/
Wechselrichter passt – spannungs-, strom- und leistungsseitig, unter
Berücksichtigung von Temperatureinflüssen.

**Zielnutzer:** Der App-Betreiber selbst (IT/OT-Admin, betreibt privat eine
Victron-ESS-Anlage mit mehreren MPPT-Ladereglern, PV-Strings unterschiedlicher
Ausrichtung/Modultypen) sowie ggf. andere PV-Planer/Selbstbauer.

**Kernproblem, das gelöst wird:**
- Bei Kälte steigt die Leerlaufspannung (Voc) eines Moduls – zu viele Module
  in Serie können die maximale Eingangsspannung eines Reglers überschreiten
  (Geräteschaden).
- Bei Hitze sinkt die Spannung im MPP (Vmp) – zu wenige Module in Serie
  können unter das MPPT-Tracking-Fenster fallen (Ertragsverlust/Ausfall).
- Der Kurzschlussstrom (Isc) mehrerer paralleler Strings darf den max.
  Eingangsstrom des Trackers nicht überschreiten.
- Anders als Victrons Tool (nur Victron-Geräte) soll diese App **beliebige
  MPPT-Laderegler UND String-Wechselrichter** (Huawei, SMA, Fronius, etc.)
  unterstützen.

---

## 2. Warum diese App (statt Victrons Original nutzen)

- Victrons Calculator deckt nur Victron-eigene Geräte ab.
- Eigene Anlage nutzt gemischte Hardware (Victron MultiPlus/MPPT + Huawei
  SUN2000-12KTL + Hoymiles Microwechselrichter).
- Ziel: eine Oberfläche für alle Szenarien, offline-fähig als PWA, ohne
  Serverkosten, direkt auf dem iPhone/iPad nutzbar ohne App Store.

---

## 3. Architektur-Entscheidungen (bindend, nicht ohne Rücksprache ändern)

| Bereich | Entscheidung | Begründung |
|---|---|---|
| Hosting | GitHub Pages, **public Repo** | kostenlos, kein Server nötig |
| Frontend | React 18+ + Vite + TypeScript | PWA-fähig, passt zu vorhandenem PhoneTicket-Stack (React) |
| PWA/Offline | `vite-plugin-pwa` (Workbox) | Service Worker + Offline-Caching der JSON-Daten, iOS UND Android |
| Styling | Tailwind CSS v4 | mobile-first, kein Runtime-Overhead |
| Fuzzy-Suche | `uFuzzy` | performanter als Fuse.js bei 20-30k Modul-Einträgen |
| Listen-Virtualisierung | `@tanstack/react-virtual` | flüssiges Scrolling großer Trefferlisten auf Mobile |
| Charts | `recharts` | Spannungs-/Temperatur-Graph (Schritt 4b), ReferenceLine-Support |
| Backend | **keins** – rein clientseitig | keine laufenden Kosten, keine Wartung |
| Datenhaltung | statische JSON-Dateien im Repo (`/data`) | reicht für 20-30k Module, kein DB-Server nötig |
| Modul-Datenquelle | ausschließlich CEC-CSV (California Energy Commission / NREL SAM) | einzige Quelle mit gesicherter freier Nutzbarkeit, automatisierbar |
| Victron-MPPT-Daten | manuell aus offizieller Victron-Excel-Liste **extrahiert** | siehe Lizenz-Regel Abschnitt 5 |
| String-Wechselrichter-Daten | manuell aus Herstellerdatenblättern **extrahiert** | siehe Lizenz-Regel Abschnitt 5 |
| Rechenlogik | eigene Implementierung, an Victron-Formellogik angelehnt, **nicht kopiert** | siehe Abschnitt 5 |
| Build/Deploy | GitHub Actions (Deploy bei Push auf `main`) | vollautomatisch |
| Datenupdate CEC | GitHub Actions, monatlicher Cron + manueller Trigger | Daten bleiben aktuell ohne manuellen Aufwand |
| iOS-Nutzung | Safari → "Zum Home-Bildschirm" (PWA) | kein Apple Developer Account nötig |

---

## 4. Datenmodell

Drei Entitätstypen, als JSON-Dateien im Repo abgelegt (kein DB-Server).

### 4.1 PV-Modul (`data/modules.json`, generiert aus CEC-CSV)

```typescript
interface PVModule {
  manufacturer: string;
  model_name: string;
  power_stc: number;        // Wp
  voc: number;              // V, bei STC (25°C, 1000 W/m²)
  vmp: number;              // V, bei STC
  isc: number;              // A, bei STC
  imp: number;              // A, bei STC
  temp_coeff_voc: number;   // %/°C, i.d.R. negativ
  temp_coeff_pmax: number;  // %/°C, i.d.R. negativ
  source: "CEC";
}
```

### 4.2 Geräte-Basis (Laderegler / Wechselrichter) (`data/inverters_victron.json`, `data/inverters_manual.json`)

```typescript
type DeviceType = "mppt_charger" | "string_inverter" | "hybrid";

interface Inverter {
  manufacturer: string;
  model_name: string;
  device_type: DeviceType;
  ac_power_nominal_w?: number;   // nur relevant bei string_inverter / hybrid
  source_url: string;            // Pflichtfeld – Nachweis, woher extrahiert
  trackers: MpptTracker[];
}
```

### 4.3 MPPT-Tracker (Teil von `Inverter`, nicht eigene Datei)

```typescript
interface MpptTracker {
  tracker_label: string;         // z.B. "MPPT1", "PV-Eingang A"
  v_mppt_min: number;            // V
  v_mppt_max: number;            // V
  v_max_absolute: number;        // V, harte Obergrenze (Geräteschutz)
  i_max: number;                 // A, max. Eingangsstrom
  max_strings_parallel: number;  // Standard 1 bei reinen MPPT-Ladereglern
  p_max_w?: number;              // optional, manche Geräte begrenzen PV-Watt zusätzlich
}
```

**Wichtig:** Ein Gerät kann mehrere Tracker mit unterschiedlichen Grenzwerten haben
(z.B. Huawei SUN2000 mit 2 unabhängigen MPPT-Eingängen) – deshalb Liste, nicht
Einzelfelder auf `Inverter`.

---

## 5. Lizenz-Regeln (unbedingt einhalten)

1. **Niemals** Original-Dateien (Excel, PDF, Screenshots von Datenblättern)
   ins Repo committen – nur die daraus extrahierten **Zahlenwerte**.
2. Jeder manuell erfasste `Inverter`-Eintrag braucht ein `source_url`-Feld
   (Link zur Herstellerseite/zum Datenblatt), nicht die Datei selbst.
3. CEC-CSV-Daten sind unproblematisch (US-Behördendaten, frei nutzbar) –
   automatisierter Import ist ok.
4. Die Rechenlogik wird **eigenständig aus physikalischen Grundlagen**
   implementiert (Temperaturkoeffizienten-Formel ist Industriestandard,
   keine Victron-IP). Falls die Victron-Excel-Liste eigene Formeln/Sicherheits-
   faktoren enthält, werden nur die **Prinzipien** übernommen, keine Formel-
   Strings/Makro-Code aus der Excel-Datei kopiert.

---

## 6. Rechenkern – fachliche Spezifikation

Berechnung läuft **pro Tracker**, nicht pro Gerät (ein Gerät kann mehrere
Tracker mit unterschiedlichen Konfigurationen haben).

**Eingaben:**
- Gewähltes `PVModule`
- Anzahl Module in Serie (`modulesInSeries`)
- Anzahl Strings parallel (`stringsParallel`)
- Gewählter `MpptTracker`
- Standort-Grenztemperaturen: `tempMin` (kältester zu erwartender Wert, DE
  Standard ca. -10°C, konfigurierbar), `tempMax` (heißester Wert, Modul-
  Rückseitentemperatur unter Volllast, DE Standard ca. 70°C, konfigurierbar)

**Verifiziert gegen Victrons offiziellen VE-MPPT-Calc (Excel, Formeln ausgelesen
und nachvollzogen – siehe Abschnitt 6a für Details). Die folgende Spezifikation
entspricht Victrons tatsächlicher Logik, keine Vermutung.**

**Berechnungsschritte:**

1. **Voc-Kälte-Korrektur** (worst case max. Spannung, harte Geräteschutzgrenze,
   **keine** Zusatzkorrektur/Puffer – Victron rechnet hier straight):
   `Voc_cold = Voc_STC × (1 + temp_coeff_voc/100 × (tempMin - 25)) × modulesInSeries`
   → Prüfung: `Voc_cold ≤ tracker.v_max_absolute`

2. **Stromprüfung bei Kälte** (Impp steigt leicht bei Kälte, ebenfalls **ohne**
   Korrektur):
   `I_cold = (Impp_STC + tempCoeffIsc_absolut × -(25 - tempMin)) × stringsParallel`
   → Prüfung: `I_cold ≤ tracker.i_max` UND `stringsParallel ≤ tracker.max_strings_parallel`

3. **Vmp-Hitze-Korrektur MIT Kabel-Spannungsabfall** (einzige Stelle, an der
   Victron tatsächlich eine Korrektur anwendet – physikalisch begründet, kein
   pauschaler Sicherheitsfaktor):
   ```
   Vmp_hot_raw = Vmp_STC × (1 + temp_coeff_voc/100 × (tempMax - 25)) × modulesInSeries
   cableDropFactor = (2 × cableLength_m × copperResistivity) / crossSection_mm2
   // copperResistivity = 0.0178 Ω·mm²/m, feste Konstante
   I_hot = (Impp_STC + tempCoeffIsc_absolut × -(25 - tempMax)) × stringsParallel
   Vmp_hot_corrected = Vmp_hot_raw − (cableDropFactor × I_hot)
   ```
   → Prüfung: `Vmp_hot_corrected > tracker.v_mppt_min`
   (Hinweis: Victron nutzt für die Vmp-Temperaturkorrektur denselben
   `temp_coeff_voc`, keinen separaten Vmp-Koeffizienten – CEC-Daten liefern
   ohnehin meist nur einen kombinierten Spannungskoeffizienten)

4. **Leistungshinweis (kein Blocker, nur Warnung):**
   `powerRatio = (power_stc × modulesInSeries × stringsParallel) / tracker.p_max_w`
   → Warnung, falls `powerRatio > 1.3` ("Überdimensionierung >30%")

5. **Ergebnis:** Ampel-Status (ok / warnung / fehler) pro Einzelprüfung +
   Gesamtstatus, plus errechnete Werte zur Anzeige. Gesamtstatus "Accepted"
   nur wenn alle drei Hart-Prüfungen (1-3) bestehen – exakt wie Victrons
   `G29`-Logik (`IF(Voc_ok, IF(I_ok, IF(Vmp_ok, "Accepted", "NOT accepted"), ...))`).

**Neue Pflicht-Eingabefelder (bisher nicht spezifiziert):**
- `cableLength` (m, einfache Strecke – Victron verdoppelt intern für Hin-/Rückleiter)
- `crossSection` (mm², Kabelquerschnitt)

### 6a. Herkunft dieser Spezifikation

Werte durch Auslesen der Original-Formeln aus `VE-MPPT-Calc-4_0.xlsm`
verifiziert (openpyxl, `data_only=False`). Die Datei selbst liegt NICHT im
Repo (siehe Abschnitt 5, Lizenz-Regel) – nur diese daraus abgeleitete,
in eigenen Worten formulierte Spezifikation.

**Alle Temperatur-Grenzwerte müssen im UI überschreibbar sein** (Standort-
abhängig, nicht hartcodiert).

**Gesamtstatus-Priorisierung:** Geräteschutz-relevante Fehler (Voc-Grenze,
Imax überschritten) sowie die Vmp-Min-Prüfung (jetzt Hart-Kriterium, siehe
Abschnitt 6, Punkt 3) haben Vorrang vor reinen Hinweis-Warnungen (Power-Ratio
>1.3 "Überdimensionierung"). Ein "warnung"-Status darf einen darunterliegenden
"überlastet"-Status niemals verdecken.

**Visualisierung:** Zusätzlich zur tabellarischen Ampel-Anzeige wird ein
Spannungs-/Temperatur-Graph dargestellt (analog Victron-Tool): Voc- und
Vmp-Kurve über einen Temperaturbereich, mit den Gerätegrenzwerten als
horizontale Referenzlinien und den aktuell gewählten Grenztemperaturen als
vertikale Marker. Siehe TASKS.md Schritt 4b.

**Speichern & Teilen:** Kein Server/Login – die vollständige Konfiguration
(Modul, Gerät, Tracker, Serien-/Parallelanzahl, Temperaturgrenzen) wird als
URL-Query-Parameter kodiert. Ergebnis ist damit per Link teilbar und
bookmarkbar, zusätzlich localStorage-Fallback für "letzte Eingabe" ohne Link.
Modul-/Geräte-IDs in der URL müssen stabil bleiben (Slug aus
`manufacturer__model_name`), damit alte geteilte Links nach einem CEC-
Datenupdate nicht brechen. Siehe TASKS.md Schritt 4c.

---

## 7. Nicht-Ziele (bewusst außerhalb des Scopes)

- Keine Ertragsprognose/Simulation (kein PVGIS/PVWatts-Anschluss)
- Keine Verschattungsanalyse
- Keine Nutzerkonten/Login/Backend-Datenbank
- Keine automatisierte Victron-Excel-Aktualisierung (manuell bei neuer
  Victron-Liste)

---

## 8. Konventionen für Code-Änderungen

- Sprache im Code: Englisch (Variablen, Funktionen, Kommentare für Logik)
- UI-Texte: Deutsch
- Commit-Messages: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)
- Jede neue Datenquelle bekommt eigenes Import-Script in `/scripts`
- Rechenkern (`calc.ts`) muss reine Funktionen enthalten, keine UI-Logik
  vermischen – erleichtert spätere Unit-Tests
