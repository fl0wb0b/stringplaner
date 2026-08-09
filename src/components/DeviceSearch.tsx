import { useMemo, useRef, useState } from "react";
import uFuzzy from "@leeoniya/ufuzzy";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Inverter } from "../lib/types";
import { inverterSlug } from "../lib/data";

interface Props {
  inverters: Inverter[];
  selected: Inverter | null;
  onSelect: (i: Inverter) => void;
}

const MAX_RESULTS = 500;

const DEVICE_TYPE_LABEL: Record<Inverter["device_type"], string> = {
  mppt_charger: "MPPT-Laderegler",
  string_inverter: "Wechselrichter",
  hybrid: "Hybrid",
};

const isMicro = (i: Inverter) => i.ac_power_nominal_w != null && i.ac_power_nominal_w < 900;

function summaryLine(i: Inverter): string {
  const parts = [DEVICE_TYPE_LABEL[i.device_type]];
  if (i.ac_power_nominal_w) parts.push(`${i.ac_power_nominal_w.toLocaleString("de-DE")} W AC`);
  parts.push(`${i.trackers.length} MPPT-Eingäng${i.trackers.length === 1 ? "" : "e"}`);
  if (isMicro(i)) parts.push("Balkon");
  return parts.join(" · ");
}

// Fuzzy quick-find over all inverters/chargers, same UX as the module search
// in step 2 (uFuzzy + virtualized list) instead of a long grouped <select>.
export function DeviceSearch({ inverters, selected, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const uf = useMemo(() => new uFuzzy({ intraMode: 1, intraIns: 1 }), []);
  const haystack = useMemo(
    () => inverters.map((i) => `${i.manufacturer} ${i.model_name}`),
    [inverters],
  );

  const resultIdxs = useMemo(() => {
    const needle = query.trim();
    if (needle.length < 2) return [];
    const [idxs, info, order] = uf.search(haystack, needle, 0, 1e4);
    if (!idxs) return [];
    const ranked = order && info ? order.map((i) => info.idx[i]) : [...idxs];
    return ranked.slice(0, MAX_RESULTS);
  }, [uf, haystack, query]);

  const virtualizer = useVirtualizer({
    count: resultIdxs.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 52,
    overscan: 10,
  });

  return (
    <div className="relative">
      <label className="field-label">Laderegler / Wechselrichter</label>
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Hersteller oder Modell suchen …"
        className="field"
      />
      {selected && (
        <div className="mt-2 rounded-xl border border-sky-500/30 bg-sky-500/5 px-3 py-2.5 text-sm">
          <div className="font-medium text-slate-100">
            {selected.manufacturer} {selected.model_name}
          </div>
          <div className="mt-0.5 text-slate-400">{summaryLine(selected)}</div>
        </div>
      )}
      {open && resultIdxs.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-20 mt-1.5 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-800 shadow-2xl shadow-black/50"
        >
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((row) => {
              const i = inverters[resultIdxs[row.index]];
              return (
                <button
                  key={inverterSlug(i)}
                  type="button"
                  onClick={() => {
                    onSelect(i);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="absolute left-0 top-0 w-full px-3 py-1.5 text-left transition-colors hover:bg-slate-700/80"
                  style={{ transform: `translateY(${row.start}px)`, height: row.size }}
                >
                  <div className="truncate text-sm text-slate-100">
                    {i.manufacturer} {i.model_name}
                  </div>
                  <div className="text-xs text-slate-400">{summaryLine(i)}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {open && query.trim().length >= 2 && resultIdxs.length === 0 && (
        <div className="absolute z-20 mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-slate-400 shadow-2xl shadow-black/50">
          Keine Treffer
        </div>
      )}
    </div>
  );
}
