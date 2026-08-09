// Preisvergleichs-Links für den gewählten Wechselrichter sowie eine
// Überspannungsschutz-/Kombinierer-Empfehlung (Weidmüller PVN DC, CG-Steckverbinder)
// je nach Anzahl paralleler Strings an einem Tracker.
//
// Datenstand anhand der vollständigen Weidmüller-eShop-Filterliste "Anschlussart
// String" (CG-Steckverbinder, alle MPP-/Eingangszahlen, siehe Chat): in der CG-Reihe
// gibt es NUR für 2 Strings eine echte "2 Eingänge -> 1 Ausgang"-Kombinierer-Box (pro
// MPP-Tracker, unabhängig davon wie viele MPP-Tracker das Gerät insgesamt hat).
// Ab 3 Strings existieren zwar "3I/3O"-Boxen, die führen die Strings aber NICHT
// zusammen (3 Eingänge -> 3 separate Ausgänge, nur Einzelschutz je String) – dafür
// braucht es keinen Kombinierer, sondern schlicht so viele geschützte Einzeleingänge
// wie Strings, oder eine andere Lösung (Wechselrichter mit mehr MPPT, Verteiler).

export function geizhalsSearchUrl(query: string): string {
  return `https://geizhals.de/?fs=${encodeURIComponent(query)}`;
}

export function idealoSearchUrl(query: string): string {
  return `https://www.idealo.de/preisvergleich/MainSearchProductCategory.html?q=${encodeURIComponent(query)}`;
}

export interface WeidmuellerBox {
  name: string;
  url: string;
  note: string;
}

// SPD2R (Typ II, steckbares Schutzmodul) – konsistent zur SPD2R-Variante des
// 2-MPP-Pendants (2866330000). Bestätigt im Weidmüller eShop-Filter "CG".
const TWO_STRING_COMBINER: WeidmuellerBox = {
  name: "Weidmüller PVN DC 2I 1O 1MPP SPD2R CG 11 (2791950000)",
  url: "https://eshop.weidmueller.com/de/pvn-dc-2i-1o-1mpp-spd2r-cg-11/p/2791950000",
  note: "kombiniert 2 Strings auf 1 geschützten Ausgang",
};

// stringsParallel < 2: kein Kombinierer nötig (nur ein String).
// stringsParallel === 2: einzige echte "N->1"-Kombinierer-Box der CG-Reihe.
// stringsParallel >= 3: es gibt keine kombinierende CG-Box (nur Einzelschutz je
// String ohne Zusammenführung) – daher kein Produktlink, nur Hinweis.
export function weidmuellerBoxFor(stringsParallel: number): WeidmuellerBox | null {
  return stringsParallel === 2 ? TWO_STRING_COMBINER : null;
}

export function noCombinerNote(stringsParallel: number): string | null {
  if (stringsParallel < 3) return null;
  return `${stringsParallel} Strings: In der Weidmüller-PVN-DC-CG-Reihe gibt es dafür keine kombinierende Box (nur Einzelschutz je String ohne Zusammenführung) – Strings einzeln geschützt an den Tracker führen oder Wechselrichter mit mehr MPPT-Eingängen wählen.`;
}
