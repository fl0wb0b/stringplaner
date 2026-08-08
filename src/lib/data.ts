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

export function loadModules(): Promise<PVModule[]> {
  return fetchJson<PVModule[]>("data/modules.json");
}

export async function loadInverters(): Promise<Inverter[]> {
  const [victron, manual] = await Promise.all([
    fetchJson<Inverter[]>("data/inverters_victron.json"),
    fetchJson<Inverter[]>("data/inverters_manual.json"),
  ]);
  return [...victron, ...manual];
}
