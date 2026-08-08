import { useMemo, useRef, useState } from "react";
import uFuzzy from "@leeoniya/ufuzzy";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { PVModule } from "../lib/types";
import { moduleSlug } from "../lib/data";

interface Props {
  modules: PVModule[];
  selected: PVModule | null;
  onSelect: (m: PVModule) => void;
}

const MAX_RESULTS = 1000;

export function ModuleSearch({ modules, selected, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const uf = useMemo(() => new uFuzzy({ intraMode: 1, intraIns: 1 }), []);
  const haystack = useMemo(
    () => modules.map((m) => `${m.manufacturer} ${m.model_name}`),
    [modules],
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
      <label className="mb-1 block text-sm font-medium text-slate-300">
        PV-Modul suchen ({modules.length.toLocaleString("de-DE")} Module, CEC + manuell gepflegt)
      </label>
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Hersteller oder Modell, z.B. Trina 425"
        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
      />
      {selected && (
        <div className="mt-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm">
          <div className="font-medium text-slate-100">
            {selected.manufacturer} {selected.model_name}
          </div>
          <div className="mt-0.5 text-slate-400">
            {selected.power_stc} Wp · Voc {selected.voc} V · Vmp {selected.vmp} V · Imp{" "}
            {selected.imp} A · β(Voc) {selected.temp_coeff_voc} %/°C
          </div>
        </div>
      )}
      {open && resultIdxs.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-600 bg-slate-800 shadow-xl"
        >
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((row) => {
              const m = modules[resultIdxs[row.index]];
              return (
                <button
                  key={moduleSlug(m)}
                  type="button"
                  onClick={() => {
                    onSelect(m);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="absolute left-0 top-0 w-full px-3 py-1.5 text-left hover:bg-slate-700"
                  style={{ transform: `translateY(${row.start}px)`, height: row.size }}
                >
                  <div className="truncate text-sm text-slate-100">
                    {m.manufacturer} {m.model_name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {m.power_stc} Wp · Voc {m.voc} V · Imp {m.imp} A
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
      {open && query.trim().length >= 2 && resultIdxs.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-400 shadow-xl">
          Keine Treffer
        </div>
      )}
    </div>
  );
}
