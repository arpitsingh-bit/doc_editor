export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800">
      <div className="max-w-md w-full p-8 bg-white rounded-xl shadow-sm border border-slate-200 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">
          Real-Time Collaborative Editor
        </h1>
        <p className="text-sm text-slate-500 mb-4">
          Stage 0 — Scaffold Complete
        </p>
        <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          ● Ready for Stage 1 (Plain Sync)
        </div>
      </div>
    </main>
  )
}
