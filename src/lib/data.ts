import type { Inverter, PVModule } from "./types";

// Stable slugs (manufacturer__model_name) keep shared URLs valid across CEC data updates.
export const moduleSlug = (m: Pick<PVModule, "manufacturer" | "model_name">) =>
  `${m.manufacturer}__${m.model_name}`;

export const inverterSlug = (i: Pick<Inverter, "manufacturer" | "model_name">) =>
  `${i.manufacturer}__${i.model_name}`;

const base = import.meta.env.BASE_URL;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`Laden von ${path} fehlgeschlagen (HTTP ${res.status})`);
  return res.json() as Promise<T>;
}

// CEC bulk data merged with hand-curated entries (EU-market modules missing
// from the CEC list). On slug collision the manual entry wins.
export async function loadModules(): Promise<PVModule[]> {
  const [cec, manual] = await Promise.all([
    fetchJson<PVModule[]>("data/modules.json"),
    fetchJson<PVModule[]>("data/modules_manual.json"),
  ]);
  const bySlug = new Map<string, PVModule>();
  for (const m of cec) bySlug.set(moduleSlug(m), m);
  for (const m of manual) bySlug.set(moduleSlug(m), m);
  return [...bySlug.values()].sort(
    (a, b) =>
      a.manufacturer.localeCompare(b.manufacturer) ||
      a.model_name.localeCompare(b.model_name),
  );
}

export async function loadInverters(): Promise<Inverter[]> {
  const [victron, manual] = await Promise.all([
    fetchJson<Inverter[]>("data/inverters_victron.json"),
    fetchJson<Inverter[]>("data/inverters_manual.json"),
  ]);
  return [...victron, ...manual];
}
