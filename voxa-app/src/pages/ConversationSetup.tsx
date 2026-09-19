import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BackHeader from '../components/BackHeader'
import { LANGUAGES, AUTO_DETECT } from '../lib/languages'
import type { LanguageCode } from '../types'

function LanguagePicker({
  label,
  value,
  onChange,
  exclude,
}: {
  label: string
  value: LanguageCode
  onChange: (v: LanguageCode) => void
  exclude?: LanguageCode
}) {
  const options = [AUTO_DETECT, ...LANGUAGES].filter((l) => l.code !== exclude)
  return (
    <div>
      <p className="text-sm text-muted mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((lang) => (
          <button
            key={lang.code}
            onClick={() => onChange(lang.code)}
            className={`flex items-center gap-2 px-3 py-3 rounded-xl border text-sm text-left transition ${
              value === lang.code
                ? 'border-primary bg-primary/10 text-ink'
                : 'border-border bg-elevated text-ink/80 active:scale-[0.98]'
            }`}
          >
            <span className="text-lg">{lang.flag}</span>
            <span>{lang.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ConversationSetup() {
  const navigate = useNavigate()
  const [langA, setLangA] = useState<LanguageCode>('fr')
  const [langB, setLangB] = useState<LanguageCode>('en')

  return (
    <div className="flex-1 flex flex-col safe-top safe-bottom">
      <BackHeader title="Configurer la conversation" to="/" />
      <div className="flex-1 px-4 py-4 flex flex-col gap-8 overflow-y-auto">
        <LanguagePicker label="Personne A parle" value={langA} onChange={setLangA} exclude={langB === 'auto' ? undefined : langB} />
        <LanguagePicker label="Personne B parle" value={langB} onChange={setLangB} exclude={langA === 'auto' ? undefined : langA} />
      </div>
      <div className="px-4 pb-6">
        <button
          onClick={() => navigate('/live', { state: { langA, langB } })}
          className="w-full py-4 rounded-2xl bg-primary text-void font-semibold active:scale-[0.98] transition shadow-soft"
        >
          Démarrer l'écoute
        </button>
      </div>
    </div>
  )
}
