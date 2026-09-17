'use client'

import React, { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import CollaborativeEditor from '@/components/CollaborativeEditor'

function EditorWithParams() {
  const searchParams = useSearchParams()
  const room = searchParams.get('room') || 'hackathon-document'

  return <CollaborativeEditor key={room} roomName={room} />
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-medium">
          Loading Collaborative Document Editor...
        </div>
      }
    >
      <EditorWithParams />
    </Suspense>
  )
}
