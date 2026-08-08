#!/usr/bin/env node
/**
 * Import CEC module data (California Energy Commission via NREL SAM) into
 * public/data/modules.json — see CLAUDE.md sections 3 and 4.1.
 *
 * Usage:
 *   node scripts/import-cec.mjs [path-to-local-csv]
 *
 * Without an argument the CSV is downloaded from the NREL SAM repository.
 * CSV layout: row 1 = column names, row 2 = units, row 3 = SAM variable
 * names, data starts at row 4.
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CSV_URL =
  "https://raw.githubusercontent.com/NREL/SAM/develop/deploy/libraries/CEC%20Modules.csv";
const OUT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "data",
  "modules.json",
);

function parseCsvLine(line) {
  const fields = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

async function loadCsv() {
  const localPath = process.argv[2];
  if (localPath) {
    console.log(`Reading local CSV: ${localPath}`);
    return readFile(localPath, "utf8");
  }
  console.log(`Downloading ${CSV_URL} ...`);
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  return res.text();
}

const text = await loadCsv();
const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
const header = parseCsvLine(lines[0]);
const col = Object.fromEntries(header.map((name, i) => [name, i]));

for (const required of [
  "Name",
  "Manufacturer",
  "STC",
  "I_sc_ref",
  "V_oc_ref",
  "I_mp_ref",
  "V_mp_ref",
  "alpha_sc",
  "beta_oc",
  "gamma_pmp",
]) {
  if (!(required in col)) throw new Error(`Missing CSV column: ${required}`);
}

const round = (x, digits) => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

const modules = [];
const seen = new Set();
let skipped = 0;

// rows 2 and 3 are units / SAM variable names
for (const line of lines.slice(3)) {
  const f = parseCsvLine(line);
  const name = f[col.Name]?.trim();
  const manufacturer = f[col.Manufacturer]?.trim();
  if (!name || !manufacturer) {
    skipped++;
    continue;
  }
  const num = (key) => Number.parseFloat(f[col[key]]);
  const power_stc = num("STC");
  const voc = num("V_oc_ref");
  const vmp = num("V_mp_ref");
  const isc = num("I_sc_ref");
  const imp = num("I_mp_ref");
  const alpha_sc = num("alpha_sc"); // A/°C, absolute
  const beta_oc = num("beta_oc"); // V/°C, absolute
  const gamma_pmp = num("gamma_pmp"); // %/°C

  const values = [power_stc, voc, vmp, isc, imp, alpha_sc, beta_oc, gamma_pmp];
  if (values.some((v) => !Number.isFinite(v)) || voc <= 0 || vmp <= 0 || isc <= 0) {
    skipped++;
    continue;
  }

  // "Name" is usually "<Manufacturer> <Model>" — strip the prefix for model_name
  const model_name = name.startsWith(manufacturer)
    ? name.slice(manufacturer.length).trim() || name
    : name;

  const slugKey = `${manufacturer}__${model_name}`;
  if (seen.has(slugKey)) {
    skipped++;
    continue;
  }
  seen.add(slugKey);

  modules.push({
    manufacturer,
    model_name,
    power_stc: round(power_stc, 1),
    voc: round(voc, 2),
    vmp: round(vmp, 2),
    isc: round(isc, 2),
    imp: round(imp, 2),
    temp_coeff_voc: round((beta_oc / voc) * 100, 4), // convert V/°C → %/°C
    temp_coeff_pmax: round(gamma_pmp, 4),
    temp_coeff_isc: round(alpha_sc, 5), // A/°C, absolute (needed for I_cold check)
    source: "CEC",
  });
}

modules.sort(
  (a, b) =>
    a.manufacturer.localeCompare(b.manufacturer) ||
    a.model_name.localeCompare(b.model_name),
);

await mkdir(dirname(OUT_PATH), { recursive: true });
await writeFile(OUT_PATH, JSON.stringify(modules));
console.log(`Wrote ${modules.length} modules to ${OUT_PATH} (${skipped} rows skipped)`);
