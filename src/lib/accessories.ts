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

export interface OvervoltageAdvice {
  text: string;
  productQuery?: string; // gesetzt, wenn ein konkretes Produkt existiert (für Preisvergleichs-Links)
}

// Liefert für JEDE Stringzahl eine Aussage (auch 1 String) – die Einkaufshilfe
// soll nie kommentarlos leer bleiben, nur weil die Konfiguration nicht genau
// 2 Strings hat. Verlinkt wird – wie beim Wechselrichter selbst – auf
// Preisvergleichsportale (Idealo/Geizhals), nicht auf den Hersteller-Shop.
export function overvoltageAdviceFor(stringsParallel: number): OvervoltageAdvice {
  if (stringsParallel <= 1) {
    return {
      text: "Weidmüller PVI DC 1I 1O 1MPP SPD1 MC4 10 (3108220000) – Einzelstring-Überspannungsschutz, kein Kombinierer nötig",
      productQuery: "Weidmüller PVI DC 1I 1O 1MPP SPD1 MC4 10 3108220000",
    };
  }
  if (stringsParallel === 2) {
    return {
      text: "Weidmüller PVN DC 2I 1O 1MPP SPD2R CG 11 (2791950000) – kombiniert 2 Strings auf 1 geschützten Ausgang",
      productQuery: "Weidmüller PVN DC 2I 1O 1MPP SPD2R CG 11 2791950000",
    };
  }
  return {
    text: `${stringsParallel} Strings – dafür gibt es in der Weidmüller-PVN-DC-CG-Reihe keine kombinierende Box (nur Einzelschutz je String ohne Zusammenführung); Strings einzeln geschützt an den Tracker führen oder Wechselrichter mit mehr MPPT-Eingängen wählen.`,
  };
}

// Wenn ein Gerät genau 2 MPPT-Tracker hat und BEIDE aktiv mit derselben
// Stringzahl genutzt werden, deckt EIN "2MPP"-Kasten beide Eingänge ab –
// sinnvoller als zwei baugleiche Einzelboxen zu empfehlen.
const TWO_MPPT_ONE_STRING_EACH: OvervoltageAdvice = {
  text: "Weidmüller PVI DC 1I 1O 2MPP SPD1 MC4 10 (3108230000) – ein Kasten für beide MPPT-Eingänge (je 1 String)",
  productQuery: "Weidmüller PVI DC 1I 1O 2MPP SPD1 MC4 10 3108230000",
};

const TWO_MPPT_TWO_STRINGS_EACH: OvervoltageAdvice = {
  text: "Weidmüller PVN DC 2I 1O 2MPP SPD2R CG 11 (2866330000) – ein Kasten für beide MPPT-Eingänge (je 2 Strings)",
  productQuery: "Weidmüller PVN DC 2I 1O 2MPP SPD2R CG 11 2866330000",
};

export interface TrackerStrings {
  label: string;
  stringsParallel: number;
}

export interface DeviceOvervoltageAdvice {
  combined: boolean; // true = eine Empfehlung für alle Tracker zusammen
  items: Array<{ label: string; advice: OvervoltageAdvice }>;
}

// Betrachtet ALLE aktiven Tracker eines Geräts: bei genau 2 Trackern mit
// gleicher Stringzahl wird ein gemeinsamer 2-MPP-Kasten empfohlen, sonst
// pro Tracker einzeln (siehe overvoltageAdviceFor).
export function overvoltageAdviceForDevice(trackers: TrackerStrings[]): DeviceOvervoltageAdvice {
  if (trackers.length === 2 && trackers[0].stringsParallel === trackers[1].stringsParallel) {
    const n = trackers[0].stringsParallel;
    const label = `${trackers[0].label} + ${trackers[1].label}`;
    if (n === 1) return { combined: true, items: [{ label, advice: TWO_MPPT_ONE_STRING_EACH }] };
    if (n === 2) return { combined: true, items: [{ label, advice: TWO_MPPT_TWO_STRINGS_EACH }] };
  }
  return {
    combined: false,
    items: trackers.map((t) => ({ label: t.label, advice: overvoltageAdviceFor(t.stringsParallel) })),
  };
}
