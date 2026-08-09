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

// Ab 3 MPPT gibt es in der CG-Reihe nur noch "2 Eingänge/2 Ausgänge je MPP"-
// Kästen (Einzelschutz je Eingang, keine echte 1:1-Kombinierbox, aber ein
// Gehäuse für alle Tracker zusammen – deckt 1 ODER 2 Strings je Tracker ab,
// da pro MPP-Zweig 2 geschützte Eingänge zur Verfügung stehen).
const THREE_MPPT_BOX: OvervoltageAdvice = {
  text: "Weidmüller PVN DC 2I 2O 3MPP SPD1R CG 11 (2975540000) – ein Kasten für alle 3 MPPT-Eingänge (bis zu 2 Strings je Tracker)",
  productQuery: "Weidmüller PVN DC 2I 2O 3MPP SPD1R CG 11 2975540000",
};

const FOUR_MPPT_BOX: OvervoltageAdvice = {
  text: "Weidmüller PVN DC 2I 2O 4MPP SPD1R CG 11 (2737610000) – ein Kasten für alle 4 MPPT-Eingänge (bis zu 2 Strings je Tracker)",
  productQuery: "Weidmüller PVN DC 2I 2O 4MPP SPD1R CG 11 2737610000",
};

export interface TrackerStrings {
  label: string;
  stringsParallel: number;
}

export interface DeviceOvervoltageAdvice {
  combined: boolean; // true = eine Empfehlung für alle Tracker zusammen
  items: Array<{ label: string; advice: OvervoltageAdvice }>;
}

// Betrachtet ALLE aktiven Tracker eines Geräts: bei 2, 3 oder 4 Trackern mit
// je höchstens 2 Strings wird ein gemeinsamer Kasten für alle MPPT-Eingänge
// empfohlen, sonst pro Tracker einzeln (siehe overvoltageAdviceFor).
export function overvoltageAdviceForDevice(trackers: TrackerStrings[]): DeviceOvervoltageAdvice {
  const label = trackers.map((t) => t.label).join(" + ");
  const maxStrings = Math.max(...trackers.map((t) => t.stringsParallel));

  if (trackers.length === 2 && trackers[0].stringsParallel === trackers[1].stringsParallel) {
    const n = trackers[0].stringsParallel;
    if (n === 1) return { combined: true, items: [{ label, advice: TWO_MPPT_ONE_STRING_EACH }] };
    if (n === 2) return { combined: true, items: [{ label, advice: TWO_MPPT_TWO_STRINGS_EACH }] };
  }
  if (trackers.length === 3 && maxStrings <= 2) {
    return { combined: true, items: [{ label, advice: THREE_MPPT_BOX }] };
  }
  if (trackers.length === 4 && maxStrings <= 2) {
    return { combined: true, items: [{ label, advice: FOUR_MPPT_BOX }] };
  }
  return {
    combined: false,
    items: trackers.map((t) => ({ label: t.label, advice: overvoltageAdviceFor(t.stringsParallel) })),
  };
}
