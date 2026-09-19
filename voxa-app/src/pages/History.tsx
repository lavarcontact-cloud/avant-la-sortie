import { useEffect, useState } from 'react'
import BackHeader from '../components/BackHeader'
import { historyService } from '../services/historyService'
import type { Conversation } from '../types'
import { getLanguage } from '../lib/languages'

export default function History() {
  const [items, setItems] = useState<Conversation[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draftTitle, setDraftTitle] = useState('')

  useEffect(() => {
    setItems(historyService.list())
  }, [])

  const remove = (id: string) => {
    historyService.remove(id)
    setItems(historyService.list())
    if (openId === id) setOpenId(null)
  }

  const startRename = (c: Conversation) => {
    setRenamingId(c.id)
    setDraftTitle(c.title)
  }

  const commitRename = (id: string) => {
    historyService.rename(id, draftTitle.trim() || 'Sans titre')
    setItems(historyService.list())
    setRenamingId(null)
  }

  return (
    <div className="flex-1 flex flex-col safe-top safe-bottom">
      <BackHeader title="Historique" to="/" />
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {items.length === 0 && (
          <p className="text-center text-muted text-sm mt-10">Aucune conversation enregistrée pour le moment.</p>
        )}
        <div className="flex flex-col gap-2">
          {items.map((c) => (
            <div key={c.id} className="rounded-xl border border-border bg-elevated overflow-hidden">
              <div className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  {renamingId === c.id ? (
                    <input
                      autoFocus
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      onBlur={() => commitRename(c.id)}
                      onKeyDown={(e) => e.key === 'Enter' && commitRename(c.id)}
                      className="bg-void border border-border rounded-lg px-2 py-1 text-sm flex-1"
                    />
                  ) : (
                    <button
                      onClick={() => setOpenId(openId === c.id ? null : c.id)}
                      className="text-sm font-medium text-left flex-1"
                    >
                      {c.title}
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted">
                    {getLanguage(c.langA).flag} ⇄ {getLanguage(c.langB).flag} · {c.turns.length} échanges ·{' '}
                    {new Date(c.createdAt).toLocaleDateString('fr-FR')}
                  </p>
                  <div className="flex gap-3 text-xs">
                    <button onClick={() => startRename(c)} className="text-muted underline underline-offset-2">
                      Renommer
                    </button>
                    <button onClick={() => remove(c.id)} className="text-red-400 underline underline-offset-2">
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
              {openId === c.id && (
                <div className="border-t border-border px-4 py-3 flex flex-col gap-2 bg-void/40">
                  {c.turns.map((t) => (
                    <div key={t.id} className="text-xs">
                      <span className="font-semibold text-primary">{t.speaker}: </span>
                      <span className="text-ink/70">{t.originalText}</span>
                      <span className="text-muted"> → </span>
                      <span className="text-ink">{t.translatedText}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
