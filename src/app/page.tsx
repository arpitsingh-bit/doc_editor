import TipTapCollabEditor from '@/components/TipTapCollabEditor'

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Real-Time Collaborative Document Editor
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Google-Docs style CRDT editor • TipTap + Yjs + y-websocket
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
            Stage 2: Rich Editor (TipTap)
          </span>
        </div>
      </div>

      <TipTapCollabEditor />
    </main>
  )
}
