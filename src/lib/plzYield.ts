// Simple annual-yield estimate by German postal-code region.
// Values are typical specific yields (kWh/kWp·a, south-facing ~30° tilt),
// derived from DWD global-irradiation maps — an estimate, not a simulation
// (PVGIS/PVWatts integration is explicitly out of scope, see CLAUDE.md §7).

interface PlzZone {
  from: number; // first two digits of the postal code
  to: number;
  yield: number;
  region: string;
}

const ZONES: PlzZone[] = [
  { from: 1, to: 9, yield: 1000, region: "Sachsen / Ost-Thüringen" },
  { from: 10, to: 16, yield: 990, region: "Berlin / Brandenburg" },
  { from: 17, to: 19, yield: 970, region: "Mecklenburg-Vorpommern" },
  { from: 20, to: 25, yield: 930, region: "Hamburg / Schleswig-Holstein" },
  { from: 26, to: 27, yield: 950, region: "Ostfriesland / Küste" },
  { from: 28, to: 29, yield: 930, region: "Bremen / Niedersachsen" },
  { from: 30, to: 34, yield: 930, region: "Hannover / Nordhessen" },
  { from: 35, to: 36, yield: 950, region: "Mittelhessen" },
  { from: 37, to: 39, yield: 960, region: "Südniedersachsen / Sachsen-Anhalt" },
  { from: 40, to: 48, yield: 920, region: "Rheinland / Ruhrgebiet / Münsterland" },
  { from: 49, to: 49, yield: 930, region: "Osnabrück / Emsland" },
  { from: 50, to: 53, yield: 930, region: "Köln / Bonn / Aachen" },
  { from: 54, to: 56, yield: 960, region: "Mosel / Mittelrhein" },
  { from: 57, to: 59, yield: 910, region: "Sauerland / Siegerland" },
  { from: 60, to: 65, yield: 980, region: "Rhein-Main" },
  { from: 66, to: 69, yield: 1000, region: "Saarland / Kurpfalz" },
  { from: 70, to: 75, yield: 1040, region: "Stuttgart / Nordschwarzwald" },
  { from: 76, to: 77, yield: 1030, region: "Karlsruhe / Ortenau" },
  { from: 78, to: 79, yield: 1080, region: "Südbaden / Bodensee-West" },
  { from: 80, to: 86, yield: 1100, region: "Oberbayern / Schwaben" },
  { from: 87, to: 87, yield: 1120, region: "Allgäu" },
  { from: 88, to: 89, yield: 1090, region: "Bodensee / Ulm" },
  { from: 90, to: 96, yield: 1020, region: "Franken / Oberpfalz" },
  { from: 97, to: 97, yield: 1000, region: "Würzburg / Mainfranken" },
  { from: 98, to: 99, yield: 980, region: "Thüringen" },
];

export const DEFAULT_YIELD = 950; // Deutschland-Mittel

export function yieldForPlz(plz: string): { value: number; region: string } | null {
  const trimmed = plz.trim();
  if (!/^\d{5}$/.test(trimmed)) return null;
  const prefix = Number.parseInt(trimmed.slice(0, 2), 10);
  const zone = ZONES.find((z) => prefix >= z.from && prefix <= z.to);
  return zone ? { value: zone.yield, region: zone.region } : null;
}
