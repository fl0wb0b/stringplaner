// Preisvergleichs-Links für den gewählten Wechselrichter sowie eine
// Überspannungsschutz-/Kombinierer-Empfehlung (Weidmüller PVN DC, CG-Steckverbinder)
// je nach Anzahl paralleler Strings an einem Tracker.
//
// Nur Boxen mit einer im Weidmüller-Shop/Geizhals bestätigten Artikelnummer werden
// konkret verlinkt (aktuell: 2 Strings -> 1 kombinierter Ausgang). Für andere
// Stringzahlen gibt es keine zuverlässig verifizierte "N Eingänge -> 1 Ausgang"-CG-
// Variante, daher dort nur ein allgemeiner Such-Link statt einer geratenen Artikelnummer.

export function geizhalsSearchUrl(query: string): string {
  return `https://geizhals.de/?fs=${encodeURIComponent(query)}`;
}

export function idealoSearchUrl(query: string): string {
  return `https://www.idealo.de/preisvergleich/MainSearchProductCategory.html?q=${encodeURIComponent(query)}`;
}

export interface WeidmuellerBox {
  name: string;
  url: string;
  exact: boolean; // false = allgemeiner Such-Link, keine konkrete Artikelnummer verifiziert
}

const WEIDMUELLER_CG_COMBINER: Record<number, WeidmuellerBox> = {
  // SPD2R (Typ 2, steckbares Schutzmodul) passend zur SPD2R-Variante des 2-MPP-
  // Pendants (2866330000) – konsistente Schutzklasse. Geizhals-Direktlink noch
  // offen (Artikel-ID nicht verifiziert), bis dahin der bestätigte Weidmüller-Shop-Link.
  2: {
    name: "Weidmüller PVN DC 2I 1O 1MPP SPD2R CG 11 (2791950000)",
    url: "https://eshop.weidmueller.com/de/pvn-dc-2i-1o-1mpp-spd2r-cg-11/p/2791950000",
    exact: true,
  },
};

// stringsParallel < 2: kein Kombinierer nötig (nur ein String, kein Zusammenführen).
export function weidmuellerBoxFor(stringsParallel: number): WeidmuellerBox | null {
  if (stringsParallel < 2) return null;
  return (
    WEIDMUELLER_CG_COMBINER[stringsParallel] ?? {
      name: `Weidmüller PVN DC (${stringsParallel} Strings, CG)`,
      url: geizhalsSearchUrl("Weidmüller PVN DC CG Kombinierer Überspannungsschutz"),
      exact: false,
    }
  );
}
