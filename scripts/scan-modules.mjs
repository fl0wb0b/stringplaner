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
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
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
  power: /rated max(imum)? power|max(imum)? power\s*\(?pmax|nennleistung|leistung\s*\(?pmax/i,
  voc: /open circuit voltage|leerlaufspannung|\(voc\)|\bvoc\b/i,
  vmp: /max(imum)? power voltage|voltage at max|mpp[- ]?spannung|\(vmp p?\)|\bvmpp?\b/i,
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
  for (const line of lines) {
    if (!keyPattern.test(line) || !/%\s*\/?\s*(°?c|k)/i.test(line)) continue;
    const m = line.match(/([+-]?\d+(?:[.,]\d+)?)\s*%/);
    if (m) return num(m[1]);
  }
  return null;
}

// Model base like "JAM54D40", "TSM-NEG9R.28", "JW-HD108N-R2", "A___-MCE54Db"
const MODEL_TOKEN = /\b([A-Z]{1,4}[A-Z0-9]*[-_][A-Z0-9][A-Z0-9._\/-]{2,})\b/g;

function guessModelBase(text, pdfUrl) {
  const counts = new Map();
  for (const m of text.matchAll(MODEL_TOKEN)) {
    const tok = m[1].replace(/[.,;:]$/, "");
    if (/^\d+$/.test(tok) || tok.length > 24) continue;
    counts.set(tok, (counts.get(tok) ?? 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (best && best[1] >= 2) return best[0];
  const file = decodeURIComponent(pdfUrl.split("/").pop() ?? "datenblatt");
  return file.replace(/\.pdf$/i, "").replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 40);
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
  const powers = findRow(lines, ROW_PATTERNS.power, { min: 150, max: 800, count: 8 });
  if (!powers) return { entries: [], reason: "keine Leistungsklassen gefunden" };
  const n = powers.length;
  const voc = findRow(lines, ROW_PATTERNS.voc, { min: 10, max: 100, count: n });
  const vmp = findRow(lines, ROW_PATTERNS.vmp, { min: 10, max: 100, count: n });
  const isc = findRow(lines, ROW_PATTERNS.isc, { min: 5, max: 25, count: n });
  const imp = findRow(lines, ROW_PATTERNS.imp, { min: 5, max: 25, count: n });
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

  const entries = [];
  for (let i = 0; i < n; i++) {
    if (voc[i] == null || vmp[i] == null || isc[i] == null || imp[i] == null) continue;
    entries.push({
      manufacturer,
      model_name: `${base}-${powers[i]}`,
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

async function collectPdfUrls(source) {
  const urls = new Set();
  if (source.type === "pdf") {
    urls.add(source.url);
    return [...urls];
  }
  const html = await fetchText(source.url);
  const pdfRe = new RegExp(source.pdf_pattern, "g");
  for (const m of html.matchAll(pdfRe)) urls.add(new URL(m[0], source.url).href);
  if (source.follow_pattern) {
    const followRe = new RegExp(source.follow_pattern, "g");
    const pages = [...new Set([...html.matchAll(followRe)].map((m) => new URL(m[0], source.url).href))];
    for (const page of pages.slice(0, source.max_pages ?? 30)) {
      try {
        const sub = await fetchText(page);
        for (const m of sub.matchAll(new RegExp(source.pdf_pattern, "g")))
          urls.add(new URL(m[0], page).href);
      } catch {
        // single product page failing must not kill the scan
      }
    }
  }
  return [...urls];
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

if (process.argv.includes("--parse-test")) {
  const { entries, reason } = parseDatasheet(FIXTURE, "https://example.com/JAM54D40.pdf");
  console.log(reason ?? `${entries.length} Einträge extrahiert`);
  for (const e of entries) {
    const err = validateEntry(e);
    console.log(` - ${e.manufacturer} ${e.model_name}: ${e.power_stc} Wp, Voc ${e.voc}, tcIsc ${e.temp_coeff_isc} ${err ? "✗ " + err : "✓"}`);
  }
  process.exit(entries.length === 3 && entries.every((e) => !validateEntry(e)) ? 0 : 1);
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

for (const source of sources) {
  let pdfUrls = [];
  try {
    pdfUrls = await collectPdfUrls(source);
  } catch (e) {
    report.sources[source.name] = `Quelle nicht erreichbar: ${e.message}`;
    continue;
  }
  report.sources[source.name] = `${pdfUrls.length} PDFs gefunden`;
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
