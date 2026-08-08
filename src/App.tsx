function App() {
  return (
    <div className="min-h-dvh bg-slate-900 text-slate-100">
      <header className="border-b border-slate-700 px-4 py-4">
        <h1 className="text-xl font-semibold">Stringplaner</h1>
        <p className="text-sm text-slate-400">
          PV-String-Rechner für MPPT-Laderegler &amp; Wechselrichter
        </p>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-slate-300">
          Projekt-Setup abgeschlossen. Als Nächstes: Datenimport (CEC-Module,
          Gerätedaten) und Rechenkern – siehe TASKS.md.
        </p>
      </main>
    </div>
  );
}

export default App;
