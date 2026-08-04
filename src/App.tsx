import { useEffect, useState } from 'react'
import { ParticipantDetailView } from './components/ParticipantDetailView'
import { ParticipantsView } from './components/ParticipantsView'

function readParticipantFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get('participant')
}

function writeUrl(participantId: string | null) {
  const params = new URLSearchParams()
  if (participantId) params.set('participant', participantId)
  const query = params.toString()
  window.history.pushState(
    { participantId },
    '',
    query ? `?${query}` : window.location.pathname,
  )
}

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(() => readParticipantFromUrl())

  useEffect(() => {
    function onPopState() {
      setSelectedId(readParticipantFromUrl())
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  function openParticipant(id: string) {
    setSelectedId(id)
    writeUrl(id)
  }

  function goHome() {
    setSelectedId(null)
    writeUrl(null)
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface-elevated">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <button type="button" onClick={goHome} className="text-left">
            <div className="font-display text-lg font-semibold tracking-tight text-navy">
              Austin Speedrun
            </div>
            <div className="font-mono text-[11px] tracking-widest text-gold-deep uppercase">
              Participant tracker
            </div>
          </button>
        </div>
      </header>
      <main>
        {selectedId ? (
          <ParticipantDetailView
            participantId={selectedId}
            onBack={goHome}
            onOpen={openParticipant}
          />
        ) : (
          <ParticipantsView onOpen={openParticipant} />
        )}
      </main>
    </div>
  )
}
