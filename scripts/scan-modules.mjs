#!/usr/bin/env node
/**
 * Scan configured shop/manufacturer pages for PV-module datasheet PDFs,
 * extract STC values and propose new entries for modules_manual.json.
 *
 * Designed to run in GitHub Actions (see .github/workflows/scan-modules.yml):
 * the workflow opens a PULL REQUEST with the proposals — nothing lands on main
 * without review (license rule: only extracted numbers are stored, never the
 * PDFs themselves; each entry carries its source_url).
 *
 * Usage:
 *   node scripts/scan-modules.mjs               # full scan per data-sources/module_sources.json
 *   node scripts/scan-modules.mjs --parse-test  # run the table parser against a built-in fixture
 *
 * Requires `pdftotext` (poppler-utils) on PATH for PDF extraction.
 * Image-only PDFs (no text layer) are skipped and listed in the report.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANUAL_PATH = join(ROOT, "public", "data", "modules_manual.json");
const CEC_PATH = join(ROOT, "public", "data", "modules.json");
const SOURCES_PATH = join(ROOT, "data-sources", "module_sources.json");
const REPORT_PATH = join(ROOT, "scan-report.md");

const UA = "stringplaner-module-scanner (+https://github.com/fl0wb0b/stringplaner)";
const num = (s) => Number.parseFloat(String(s).replace(",", "."));

// ---------------------------------------------------------------- parsing ---

const ROW_PATTERNS = {
  power: /rated max(imum)? power|max(imum)? power\s*\(?pmax|nennleistung|leistung\s*\(?pmax|\bpmax\s*[\[(]/i,
  voc: /open circuit voltage|leerlaufspannung|\(voc\)|\bvoc\b/i,
  // Manche Hersteller (Trina) beschriften die Vmp-Zeile "Spannung im MPP-UMPP"
  // (deutsches U-für-Spannung-Präfix statt V) mit umgekehrter Wortreihenfolge.
  vmp: /max(imum)? power voltage|voltage at max|mpp[- ]?spannung|spannung\s+im\s+mpp|\(vmp p?\)|\bvmpp?\b|\bumpp\b/i,
  isc: /short circuit current|kurzschlussstrom|\(isc\)|\bisc\b/i,
  imp: /max(imum)? power current|current at max|mpp[- ]?strom|\(imp p?\)|\bimpp?\b/i,
};

function numbersIn(line) {
  return [...line.matchAll(/-?\d+(?:[.,]\d+)?/g)].map((m) => num(m[0]));
}

function findRow(lines, pattern, { min, max, count }) {
  for (const line of lines) {
    if (!pattern.test(line)) continue;
    const nums = numbersIn(line).filter((v) => v >= min && v <= max);
    if (nums.length >= Math.min(count, 2)) return nums.slice(0, count);
  }
  return null;
}

function findCoefficient(lines, keyPattern) {
  const celsius = /%\s*\/?\s*(°?c|k|℃)/i;
  for (const line of lines) {
    // Two-column datasheets are flattened onto one physical text line by
    // `pdftotext -layout` — an unrelated left-column value with its own "%"
    // (e.g. "Bifaciality 70±5%") can precede the real "Temperature
    // Coefficient of X ... %/°C" on the right. Slice from the keyword match
    // onward so the number search can't pick up that earlier, unrelated %.
    const keyMatch = keyPattern.exec(line);
    if (!keyMatch) continue;
    const rest = line.slice(keyMatch.index);
    if (!celsius.test(rest)) continue;
    // sign may be separated by a space ("- 0.22%/ °C"), a Unicode minus, or
    // an en-/em-dash (pdftotext often renders the datasheet's typographic
    // minus as one of these instead of a plain ASCII hyphen)
    const m = rest.match(/([+\-−–—]?)\s*(\d+(?:[.,]\d+)?)\s*%/);
    if (m) return num((/^[-−–—]$/.test(m[1]) ? "-" : m[1]) + m[2]);
  }
  return null;
}

// Model base like "JAM54D40", "TSM-NEG9R.28", "JW-HD108N-R2", "AIKO-A-MAH54Db"
// (mixed case allowed after the uppercase start; must contain a digit)
const MODEL_TOKEN = /\b([A-Z]{1,4}[A-Za-z0-9]*[-_][A-Za-z0-9][A-Za-z0-9.\/-]{2,})\b/g;
const TOKEN_JUNK =
  /datenblatt|zertifikat|garantie|anleitung|modul|sheet|solar|neostar|vertex|black|glas|frame|full|plus|bifazial|am1|noct|stc|mc4|vde|iec|iso|din/i;

function modelTokens(s) {
  return [...s.matchAll(MODEL_TOKEN)]
    .map((m) => m[1].replace(/[.,;:_-]+$/, ""))
    .filter((t) => /\d/.test(t) && t.length >= 6 && t.length <= 24 && !TOKEN_JUNK.test(t));
}

// "JAM54D40-445/LR" → "JAM54D40": drop a trailing power-class variant suffix
const stripPowerSuffix = (t) => t.replace(/[-_]\d{3}(\/[A-Za-z]{1,4})?$/, "");

function guessModelBase(text, pdfUrl) {
  const counts = new Map();
  for (const tok of modelTokens(text)) {
    const base = stripPowerSuffix(tok);
    counts.set(base, (counts.get(base) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] >= 2) return best[0];
  // shop filenames usually carry the model code — underscores split the tokens;
  // the extension (sometimes doubled: ".pdf.pdf") is no part of it
  const file = decodeURIComponent(pdfUrl.split("/").pop() ?? "").replace(/(\.pdf)+$/i, "").replace(/_+/g, " ");
  const fromFile = modelTokens(file).sort((a, b) => b.length - a.length)[0];
  if (fromFile) return stripPowerSuffix(fromFile);
  if (best) return best[0];
  return file.trim().replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 40) || "datenblatt";
}

// Trina names its classes "TSM-<Wp><Serie>" (TSM-455NEG9R.28, as in
// modules_manual.json); the sheet prints "TSM-455" and the series apart.
function trinaSeries(text) {
  const counts = new Map();
  // standalone ("NEG9R.28") or inside the type code ("TSM-445NEG9R.28")
  for (const [s] of text.matchAll(/(?:\b|(?<=\d))NE[A-Z0-9]{2,6}\.\d{2}\b/g)) counts.set(s, (counts.get(s) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

const KNOWN_MANUFACTURERS = [
  "JA Solar", "Trina", "Jinko", "Aiko", "Jolywood", "SoliTek", "Solyco",
  "Longi", "Canadian Solar", "Meyer Burger", "Qcells", "Hanwha", "Risen",
  "Astronergy", "Suntech", "DAS Solar", "Bauer", "Heckert", "Luxor",
  "Winaico", "Axitec", "Sonnenstromfabrik", "Ulica", "Sunpro", "Tongwei",
];

function guessManufacturer(text) {
  const lower = text.toLowerCase();
  for (const name of KNOWN_MANUFACTURERS) {
    if (lower.includes(name.toLowerCase())) return name === "Trina" ? "Trina Solar" : name;
  }
  return null;
}

/**
 * Parse pdftotext -layout output of a module datasheet into candidate entries.
 * Multi-column datasheets list one power class per column; rows are zipped.
 */
export function parseDatasheet(text, pdfUrl) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  // Some sheets give each power class several test-condition columns:
  // Aiko "STC NOCT" (440 331 445 335 …), Trina "STC NOCT BNPI" (425 325 471 …).
  // Only the STC column is a power class; the header row tells the stride
  // (also with a single class, where no second "STC" follows).
  const cols = lines.map((l) => l.match(/\bSTC((?:\s+(?:NOCT|NMOT|BNPI)\b)+)/i)).find(Boolean);
  const stride = cols ? cols[1].trim().split(/\s+/).length + 1 : 1;
  const pick = (arr) => (arr && stride > 1 ? arr.filter((_, i) => i % stride === 0) : arr);
  const powers = pick(findRow(lines, ROW_PATTERNS.power, { min: 150, max: 800, count: 8 * stride }));
  if (!powers) return { entries: [], reason: "keine Leistungsklassen gefunden" };
  const n = powers.length;
  const voc = pick(findRow(lines, ROW_PATTERNS.voc, { min: 10, max: 100, count: n * stride }));
  const vmp = pick(findRow(lines, ROW_PATTERNS.vmp, { min: 10, max: 100, count: n * stride }));
  const isc = pick(findRow(lines, ROW_PATTERNS.isc, { min: 5, max: 25, count: n * stride }));
  const imp = pick(findRow(lines, ROW_PATTERNS.imp, { min: 5, max: 25, count: n * stride }));
  if (!voc || !vmp || !isc || !imp)
    return { entries: [], reason: "elektrische Tabelle unvollständig" };

  const tcVoc = findCoefficient(lines, /voc|leerlauf|β/i);
  const tcPmax = findCoefficient(lines, /pmax|pmp|leistung|γ/i);
  const tcIsc = findCoefficient(lines, /isc|kurzschluss|α/i);
  if (tcVoc == null || tcIsc == null)
    return { entries: [], reason: "Temperaturkoeffizienten nicht gefunden" };

  const manufacturer = guessManufacturer(text);
  if (!manufacturer) return { entries: [], reason: "Hersteller nicht erkannt" };
  const base = guessModelBase(text, pdfUrl);
  const series = manufacturer === "Trina Solar" ? trinaSeries(text) : null;

  const entries = [];
  for (let i = 0; i < n; i++) {
    if (voc[i] == null || vmp[i] == null || isc[i] == null || imp[i] == null) continue;
    entries.push({
      manufacturer,
      model_name: series ? `TSM-${powers[i]}${series}` : `${base}-${powers[i]}`,
      power_stc: powers[i],
      voc: voc[i],
      vmp: vmp[i],
      isc: isc[i],
      imp: imp[i],
      temp_coeff_voc: tcVoc,
      temp_coeff_pmax: tcPmax ?? -0.3,
      temp_coeff_isc: Math.round(((Math.abs(tcIsc) * isc[i]) / 100) * 1e5) / 1e5,
      note: "automatisch aus Datenblatt extrahiert – vor Merge prüfen",
      source: "manual",
      source_url: pdfUrl,
    });
  }
  return { entries, reason: null };
}

export function validateEntry(e) {
  if (!(e.voc > e.vmp && e.isc > e.imp)) return "Voc<=Vmp oder Isc<=Imp";
  if (e.temp_coeff_voc >= 0 || e.temp_coeff_voc < -1) return "Voc-Koeffizient implausibel";
  const p = e.vmp * e.imp;
  if (Math.abs(p - e.power_stc) > Math.max(3, e.power_stc * 0.01))
    return `Vmp×Imp=${p.toFixed(1)} passt nicht zu ${e.power_stc} Wp`;
  return null;
}

// ---------------------------------------------------------------- fetching ---

async function fetchText(url) {
  const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function fetchPdfText(url, tmp) {
  const res = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const pdfPath = join(tmp, "ds.pdf");
  writeFileSync(pdfPath, buf);
  const txtPath = join(tmp, "ds.txt");
  execFileSync("pdftotext", ["-layout", pdfPath, txtPath], { stdio: "pipe" });
  const text = readFileSync(txtPath, "utf8");
  // Optional debug dump of extracted text (workflow artifact, aids parser tuning)
  const debugDir = process.env.SCAN_DEBUG_DIR;
  if (debugDir) {
    const name = decodeURIComponent(url.split("/").pop() ?? "ds").replace(/[^A-Za-z0-9._-]+/g, "_");
    mkdirSync(debugDir, { recursive: true });
    writeFileSync(join(debugDir, name + ".txt"), text);
  }
  return text;
}

// Certificates, warranties and manuals share the shops' PDF paths but never
// contain the STC table — skip them before downloading.
const PDF_JUNK = /zert(?:i?f)?ikat|garantie|warranty|certificate|anleitung|manual|installation|erkl(?:ae|ä)rung|declaration|montage|versandinfo/i;

async function collectPdfUrls(source) {
  const urls = new Set();
  if (source.type === "pdf") {
    urls.add(source.url);
    return { urls: [...urls], pages: 0 };
  }
  const html = await fetchText(source.url);
  const debugDir = process.env.SCAN_DEBUG_DIR;
  if (debugDir) {
    mkdirSync(debugDir, { recursive: true });
    writeFileSync(join(debugDir, `${source.name}__index.html`), html);
  }
  const pdfRe = new RegExp(source.pdf_pattern, "gi");
  for (const m of html.matchAll(pdfRe)) urls.add(new URL(m[0], source.url).href);
  let pageCount = 0;
  if (source.follow_pattern) {
    const followRe = new RegExp(source.follow_pattern, "gi");
    const pages = [...new Set([...html.matchAll(followRe)].map((m) => new URL(m[0], source.url).href))];
    pageCount = pages.length;
    let first = true;
    for (const page of pages.slice(0, source.max_pages ?? 30)) {
      try {
        const sub = await fetchText(page);
        if (debugDir && first) {
          writeFileSync(join(debugDir, `${source.name}__page1.html`), sub);
          first = false;
        }
        for (const m of sub.matchAll(new RegExp(source.pdf_pattern, "gi")))
          urls.add(new URL(m[0], page).href);
      } catch {
        // single product page failing must not kill the scan
      }
    }
  }
  return { urls: [...urls].filter((u) => !PDF_JUNK.test(u)), pages: pageCount };
}

// -------------------------------------------------------------------- main ---

const FIXTURE = `
JAM54D40 LR n-type Double Glass Monofacial Modules      JA Solar
ELECTRICAL PARAMETERS AT STC
TYPE                              JAM54D40-445/LR JAM54D40-450/LR JAM54D40-455/LR
Rated Maximum Power(Pmax) [W]          445             450             455
Open Circuit Voltage (Voc) [V]         39.10           39.30           39.50
Maximum Power Voltage(Vmp) [V]         32.65           32.82           33.00
Short Circuit Current(Isc) [A]         14.40           14.48           14.56
Maximum Power Current(Imp) [A]         13.63           13.71           13.79
Temperature Coefficient of Isc(α_Isc)  +0.045%/°C
Temperature Coefficient of Voc (β_Voc) -0.250%/°C
Temperature Coefficient of Pmax(γ_Pmp) -0.290%/°C
`;

// Aiko-style German sheet: short labels (Pmax [W]) and interleaved STC/NOCT columns.
const FIXTURE_AIKO = `
Neostar 2S+                              AIKO-A-MAH54Db
Elektrische Eigenschaften (STC: AM1.5 1000 W/m² 25 ℃ NOCT: AM1.5 800 W/m² 20 ℃ 1 m/s)
Testbedingungen        STC      NOCT      STC       NOCT        STC          NOCT
Pmax [W]               440       331      445        335        450           339
Voc [V]              40,82     38,55    40,88      38,60      40,94         38,66
Vmp [V]              34,38     32,47    34,44      32,52      34,50         32,58
Isc [A]              13,92     11,26    14,02      11,34      14,12         11,42
Imp [A]              12,80     10,22    12,93      10,32      13,05         10,41
Isc-Temperaturkoeffizient    +0,05 %/°C
Voc-Temperaturkoeffizient    -0,22 %/°C
Pmax-Temperaturkoeffizient   -0,26 %/°C
Aiko AIKO-A-MAH54Db
`;

// Trina-style DE-Layout: Vmp-Zeile heißt "Spannung im MPP-UMPP" (U- statt
// V-Präfix, umgekehrte Wortreihenfolge), Koeffizienten-Vorzeichen als
// En-Dash "–" statt ASCII-Minus, echte Werte aus einem realen Datenblatt.
const FIXTURE_TRINA_DE = `
DOPPELGLAS N-Typ i-TOPCon MODUL – Trina Solar Vertex S+ TSM-NEG9R.28
ELEKTRISCHE DATEN (STC)                    NEG9R.28      NEG9R.28 NEG9R.28
 Nominalleistung-PMAX (Wp)*                   440           445          450
 Spannung im MPP-UMPP (V)                    44,0          44,3          44,6
 Strom im MPP-IMPP (A)                       10,01         10,05        10,09
 Leerlaufspannung-UOC (V)                     52,2          52,6         52,9
 Kurzschlusstrom-ISC (A)                    10,67          10,71        10,74
STC: Einstrahlung 1000 W/m2, Zelltemperatur 25 ºC.
Temperaturkoeffizient von PMAX                        –0,29%/°C
Temperaturkoeffizient von VOC                        –0,24%/°C
Temperaturkoeffizient von ISC                         0,04%/°C
`;

// Longi-style EN-Layout: Vmp/Voc-Zeilen normal, aber die Koeffizienten
// nutzen das Einzelzeichen-Celsius-Glyph "℃" (U+2103) statt "°C", UND ein
// zweispaltiges PDF-Layout stellt einen unabhängigen "70±5%"-Wert (Bifaciality,
// linke Spalte) auf derselben physischen Zeile VOR den echten Voc-Koeffizienten
// (rechte Spalte) – die Zahlensuche darf diesen nicht fälschlich aufgreifen.
const FIXTURE_LONGI_EN = `
Longi Solar LR7-54HVD-475M Simple design embodies modern style
Maximum Power (Pmax/W)                    465          470              475
Open Circuit Voltage (Voc/V)             40.20         40.31           40.42
Short Circuit Current (Isc/A)            14.68         14.78           14.88
Voltage at Maximum Power (Vmp/V)         33.18         33.29           33.40
Current at Maximum Power (Imp/A)         14.02         14.13           14.23
Temperature Coefficient of Isc                                                   +0.050%/℃
Bifaciality                                                  70±5%                                                     Temperature Coefficient of Voc                                                 -0.200%/℃
Fire Rating                                              IEC Class C                                                   Temperature Coefficient of Pmax                                                  -0.260%/℃
`;

// Trina-Datenblatt mit drei Spalten je Leistungsklasse (STC, NOCT, BNPI) –
// echte Werte aus „Vertex S+ 440W TSM-NEG9RC27“ (Modul-Scan 09.11.2026). Nur
// die STC-Spalte darf Einträge erzeugen: NOCT (325 W) und BNPI (471 W) sind
// keine Leistungsklassen; ihre Vmp×Imp passen trotzdem zur „Leistung“, die
// Plausibilitätsprüfung fängt sie also nicht ab.
const FIXTURE_TRINA_BNPI = `
BIFAZIALES DOPPELGLAS N-Typ i-TOPCon MODUL – Trina Solar TSM-NEG9RC.27
ELEKTRISCHE DATEN (STC & NOCT & BNPI) NEG9RC.27      NEG9RC.27        NEG9RC.27
 Testbedingungen               STC NOCT BNPI    STC NOCT BNPI    STC NOCT BNPI
 Nominalleistung-PMAX (Wp)*    425  325  471    430  329  476    435  333  482
 Spannung im MPP-UMPP (V)     42,9 40,4 42,9   43,2 40,7 43,2   43,6 41,0 43,6
 Strom im MPP-IMPP (A)        9,92 8,06 10,98  9,96 8,08 11,03  9,99 8,12 11,05
 Leerlaufspannung-UOC (V)     50,9 48,3 50,9   51,4 48,7 51,4   51,8 49,1 51,8
 Kurzschlusstrom-ISC (A)     10,56 8,51 11,70 10,59 8,54 11,73 10,64 8,58 11,79
STC: Einstrahlung 1000 W/m2. NOCT: Einstrahlung 800 W/m2. BNPI: Rückseite 135 W/m2.
Temperaturkoeffizient von PMAX                        –0,29%/°C
Temperaturkoeffizient von VOC                        –0,24%/°C
Temperaturkoeffizient von ISC                         0,04%/°C
`;

// Nur eine Leistungsklasse: die Kopfzeile hat genau eine Gruppe ohne zweites
// "STC" – NOCT/BNPI dürfen trotzdem nicht als eigene Klassen durchrutschen.
const FIXTURE_TRINA_EINE_KLASSE = `
Trina Solar TSM-NEG9RC.27
 Testbedingungen               STC NOCT BNPI
 Nominalleistung-PMAX (Wp)*    425  325  471
 Spannung im MPP-UMPP (V)     42,9 40,4 42,9
 Strom im MPP-IMPP (A)        9,92 8,06 10,98
 Leerlaufspannung-UOC (V)     50,9 48,3 50,9
 Kurzschlusstrom-ISC (A)     10,56 8,51 11,70
Temperaturkoeffizient von VOC                        –0,24%/°C
Temperaturkoeffizient von ISC                         0,04%/°C
`;

// Serie nur in den Typbezeichnungen (TSM-425NEG9RC.27), eine andere Serie
// einmal im Fließtext – die Typbezeichnungen müssen gewinnen.
const FIXTURE_TRINA_EINGEBETTET = `
Trina Solar Vertex S+     TSM-425NEG9RC.27   TSM-430NEG9RC.27
Garantiebedingungen wie bei NEG9R.28
 Nominalleistung-PMAX (Wp)*    425    430
 Spannung im MPP-UMPP (V)     42,9   43,2
 Strom im MPP-IMPP (A)        9,92   9,96
 Leerlaufspannung-UOC (V)     50,9   51,4
 Kurzschlusstrom-ISC (A)     10,56  10,59
Temperaturkoeffizient von VOC                        –0,24%/°C
Temperaturkoeffizient von ISC                         0,04%/°C
`;

if (process.argv.includes("--parse-test")) {
  // powers/names: optionale Erwartungen an Leistungsklassen und Modellnamen
  const cases = [
    { name: "JA Solar (EN, mehrspaltig)", text: FIXTURE, url: "https://example.com/JAM54D40.pdf", expect: 3 },
    { name: "Aiko (DE, STC/NOCT-interleaved)", text: FIXTURE_AIKO, url: "https://example.com/AIKO-A-MAH54Db.pdf", expect: 3 },
    { name: "Trina (DE, UMPP-Label, En-Dash-Vorzeichen)", text: FIXTURE_TRINA_DE, url: "https://example.com/TSM-NEG9R.28.pdf", expect: 3,
      names: ["TSM-440NEG9R.28", "TSM-445NEG9R.28", "TSM-450NEG9R.28"] },
    { name: "Trina (DE, STC/NOCT/BNPI je Klasse)", text: FIXTURE_TRINA_BNPI, url: "https://example.com/TSM-NEG9RC27.pdf", expect: 3,
      powers: [425, 430, 435], names: ["TSM-425NEG9RC.27", "TSM-430NEG9RC.27", "TSM-435NEG9RC.27"] },
    { name: "Trina (eine Klasse, STC/NOCT/BNPI)", text: FIXTURE_TRINA_EINE_KLASSE, url: "https://example.com/TSM-NEG9RC27.pdf", expect: 1,
      powers: [425] },
    { name: "Trina (Serie in der Typbezeichnung)", text: FIXTURE_TRINA_EINGEBETTET, url: "https://example.com/vertex.pdf", expect: 2,
      names: ["TSM-425NEG9RC.27", "TSM-430NEG9RC.27"] },
    { name: "Longi (EN, Unicode-Celsius, Spalten-Kollision)", text: FIXTURE_LONGI_EN, url: "https://example.com/LR7-54HVD.pdf", expect: 3 },
    // Modellname aus dem Dateinamen (Token im Text nur einmal): ohne ".pdf"
    { name: "Modellname aus Dateiname ohne .pdf", text: FIXTURE_LONGI_EN,
      url: "https://example.com/Datenblatt%20-%20Longi%20Solar%20LR7-54HVD-470M.pdf.pdf", expect: 3,
      names: ["LR7-54HVD-470M-465", "LR7-54HVD-470M-470", "LR7-54HVD-470M-475"] },
  ];
  let ok = true;
  for (const c of cases) {
    const { entries, reason } = parseDatasheet(c.text, c.url);
    console.log(`${c.name}: ${reason ?? entries.length + " Einträge extrahiert"}`);
    for (const e of entries) {
      const err = validateEntry(e);
      console.log(` - ${e.manufacturer} ${e.model_name}: ${e.power_stc} Wp, Voc ${e.voc}, tcIsc ${e.temp_coeff_isc} ${err ? "✗ " + err : "✓"}`);
    }
    const same = (want, got) => !want || JSON.stringify(want) === JSON.stringify(got);
    const passed = entries.length === c.expect && entries.every((e) => !validateEntry(e))
      && same(c.powers, entries.map((e) => e.power_stc)) && same(c.names, entries.map((e) => e.model_name));
    if (!passed) console.log("   ✗ Erwartung verfehlt");
    ok &&= passed;
  }
  process.exit(ok ? 0 : 1);
}

const sources = JSON.parse(readFileSync(SOURCES_PATH, "utf8"));
const manual = JSON.parse(readFileSync(MANUAL_PATH, "utf8"));
const cec = JSON.parse(readFileSync(CEC_PATH, "utf8"));
const knownSlugs = new Set([...manual, ...cec].map((m) => `${m.manufacturer}__${m.model_name}`.toLowerCase()));
const knownPowerKeys = new Set(
  [...manual, ...cec].map((m) => `${m.manufacturer.toLowerCase()}|${m.power_stc}|${m.voc.toFixed(1)}`),
);

const accepted = [];
const report = { scanned: 0, skipped: [], rejected: [], sources: {} };
const tmp = mkdtempSync(join(tmpdir(), "modscan-"));
process.on("exit", () => rmSync(tmp, { recursive: true, force: true }));

for (const source of sources) {
  let pdfUrls = [];
  try {
    const collected = await collectPdfUrls(source);
    pdfUrls = collected.urls;
    report.sources[source.name] = `${collected.pages} Produktseiten, ${pdfUrls.length} Datenblatt-PDFs`;
  } catch (e) {
    report.sources[source.name] = `Quelle nicht erreichbar: ${e.message}`;
    continue;
  }
  for (const url of pdfUrls) {
    report.scanned++;
    let text;
    try {
      text = await fetchPdfText(url, tmp);
    } catch (e) {
      report.skipped.push(`${url} (Download/pdftotext: ${e.message})`);
      continue;
    }
    if (text.trim().length < 200) {
      report.skipped.push(`${url} (kein Textlayer – vermutlich Bild-PDF, OCR nötig)`);
      continue;
    }
    const { entries, reason } = parseDatasheet(text, url);
    if (reason) {
      report.skipped.push(`${url} (${reason})`);
      continue;
    }
    for (const e of entries) {
      const err = validateEntry(e);
      if (err) {
        report.rejected.push(`${e.model_name}: ${err} (${url})`);
        continue;
      }
      const slug = `${e.manufacturer}__${e.model_name}`.toLowerCase();
      const powerKey = `${e.manufacturer.toLowerCase()}|${e.power_stc}|${e.voc.toFixed(1)}`;
      if (knownSlugs.has(slug) || knownPowerKeys.has(powerKey)) continue; // schon vorhanden
      knownSlugs.add(slug);
      knownPowerKeys.add(powerKey);
      accepted.push(e);
    }
  }
}

if (accepted.length) {
  const merged = [...manual, ...accepted].sort(
    (a, b) => a.manufacturer.localeCompare(b.manufacturer) || a.model_name.localeCompare(b.model_name),
  );
  writeFileSync(MANUAL_PATH, JSON.stringify(merged, null, 2) + "\n");
}

const md = [
  `# Modul-Scan ${accepted.length ? `– ${accepted.length} neue Module` : "– keine neuen Module"}`,
  "",
  ...Object.entries(report.sources).map(([k, v]) => `- ${k}: ${v}`),
  `- PDFs verarbeitet: ${report.scanned}`,
  "",
  accepted.length ? "## Neu (bitte gegen Datenblatt prüfen)" : "",
  ...accepted.map((e) => `- ${e.manufacturer} ${e.model_name} (${e.power_stc} Wp, Voc ${e.voc} V) – ${e.source_url}`),
  report.rejected.length ? "\n## Abgelehnt (Plausibilität)" : "",
  ...report.rejected.map((r) => `- ${r}`),
  report.skipped.length ? "\n## Übersprungen" : "",
  ...report.skipped.slice(0, 50).map((s) => `- ${s}`),
].filter(Boolean).join("\n");
writeFileSync(REPORT_PATH, md + "\n");
console.log(md);
