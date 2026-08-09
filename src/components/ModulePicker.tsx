import type { PVModule } from "../lib/types";
import { CUSTOM_MODULE_SLUG, type CustomModuleValues } from "../lib/urlState";
import { moduleSlug } from "../lib/data";
import { ModuleSearch } from "./ModuleSearch";
import { NumberField } from "./NumberField";

interface Props {
  modules: PVModule[];
  selectedSlug: string | null;
  selectedModule: PVModule | null; // resolved (database or custom)
  custom: CustomModuleValues | null;
  onSelect: (slug: string) => void;
  onCustomChange: (patch: Partial<CustomModuleValues>) => void;
}

// Module selection = database search plus a free-value entry ("Eigene Werte"),
// like the custom-panel option in Victron's MPPT calculator.
export function ModulePicker({
  modules,
  selectedSlug,
  selectedModule,
  custom,
  onSelect,
  onCustomChange,
}: Props) {
  const isCustom = selectedSlug === CUSTOM_MODULE_SLUG;

  return (
    <div className="space-y-3">
      <div>
        <ModuleSearch
          modules={modules}
          selected={isCustom ? null : selectedModule}
          onSelect={(m) => onSelect(moduleSlug(m))}
        />
        <button
          type="button"
          onClick={() => onSelect(CUSTOM_MODULE_SLUG)}
          className={`mt-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
            isCustom
              ? "border-sky-500/50 bg-sky-500/10 text-sky-300"
              : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
          }`}
        >
          Eigene Werte eingeben
        </button>
      </div>

      {isCustom && custom && (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <NumberField
              label="Leistung"
              unit="Wp"
              value={custom.power_stc}
              min={1}
              step={5}
              onChange={(v) => onCustomChange({ power_stc: v })}
            />
            <NumberField
              label="Voc"
              unit="V"
              value={custom.voc}
              min={0.1}
              step={0.1}
              onChange={(v) => onCustomChange({ voc: v })}
            />
            <NumberField
              label="Vmp"
              unit="V"
              value={custom.vmp}
              min={0.1}
              step={0.1}
              onChange={(v) => onCustomChange({ vmp: v })}
            />
            <NumberField
              label="Isc"
              unit="A"
              value={custom.isc}
              min={0.1}
              step={0.1}
              onChange={(v) => onCustomChange({ isc: v })}
            />
            <NumberField
              label="Imp"
              unit="A"
              value={custom.imp}
              min={0.1}
              step={0.1}
              onChange={(v) => onCustomChange({ imp: v })}
            />
            <NumberField
              label="Koeff. Voc"
              unit="%/°C"
              value={custom.temp_coeff_voc}
              step={0.01}
              onChange={(v) => onCustomChange({ temp_coeff_voc: v })}
            />
            <NumberField
              label="Koeff. Isc"
              unit="%/°C"
              value={custom.temp_coeff_isc_pct}
              step={0.005}
              onChange={(v) => onCustomChange({ temp_coeff_isc_pct: v })}
            />
          </div>
          {Math.abs(custom.vmp * custom.imp - custom.power_stc) > custom.power_stc * 0.02 && (
            <p className="mt-2 text-xs text-amber-400">
              Hinweis: Vmp × Imp = {(custom.vmp * custom.imp).toFixed(0)} W weicht von{" "}
              {custom.power_stc} Wp ab – Werte prüfen.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
