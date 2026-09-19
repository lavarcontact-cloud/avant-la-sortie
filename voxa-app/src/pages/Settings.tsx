import { useState } from 'react'
import BackHeader from '../components/BackHeader'
import { settingsService, DEFAULT_SETTINGS } from '../services/settingsService'
import { LANGUAGES } from '../lib/languages'
import { SLANG_LEVEL_LABELS, SLANG_LEVEL_DESCRIPTIONS } from '../lib/slang'
import type { LanguageCode, SlangLevel } from '../types'
import { providerFlags } from '../providers'

export default function Settings() {
  const [settings, setSettings] = useState(() => settingsService.load())

  const update = <K extends keyof typeof settings>(key: K, value: (typeof settings)[K]) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    settingsService.save(next)
  }

  const toggleFavorite = (code: LanguageCode) => {
    const set = new Set(settings.favoriteLanguages)
    if (set.has(code)) set.delete(code)
    else set.add(code)
    update('favoriteLanguages', Array.from(set))
  }

  return (
    <div className="flex-1 flex flex-col safe-top safe-bottom">
      <BackHeader title="Réglages" to="/" />
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-8">
        <section>
          <h2 className="text-sm font-semibold text-muted mb-2">Langue principale</h2>
          <div className="grid grid-cols-2 gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => update('primaryLanguage', l.code)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm ${
                  settings.primaryLanguage === l.code ? 'border-primary bg-primary/10' : 'border-border bg-elevated'
                }`}
              >
                <span>{l.flag}</span>
                <span>{l.name}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-muted mb-2">Langues favorites</h2>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => toggleFavorite(l.code)}
                className={`px-3 py-1.5 rounded-full border text-xs ${
                  settings.favoriteLanguages.includes(l.code)
                    ? 'border-primary bg-primary/10 text-ink'
                    : 'border-border bg-elevated text-muted'
                }`}
              >
                {l.flag} {l.name}
              </button>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Lecture automatique</p>
            <p className="text-xs text-muted">Lire à voix haute chaque traduction</p>
          </div>
          <Toggle checked={settings.autoPlayback} onChange={(v) => update('autoPlayback', v)} />
        </section>

        <section>
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-medium">Vitesse de parole</p>
            <span className="text-xs text-muted">{settings.speechRate.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={1.8}
            step={0.1}
            value={settings.speechRate}
            onChange={(e) => update('speechRate', Number(e.target.value))}
            className="w-full accent-primary"
          />
        </section>

        <section>
          <h2 className="text-sm font-semibold text-muted mb-2">Registre de traduction</h2>
          <div className="flex flex-col gap-2">
            {(Object.keys(SLANG_LEVEL_LABELS) as SlangLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => update('slangLevel', level)}
                className={`text-left px-3 py-2 rounded-xl border ${
                  settings.slangLevel === level ? 'border-primary bg-primary/10' : 'border-border bg-elevated'
                }`}
              >
                <p className="text-sm font-medium">{SLANG_LEVEL_LABELS[level]}</p>
                <p className="text-xs text-muted">{SLANG_LEVEL_DESCRIPTIONS[level]}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Conserver l'historique</p>
            <p className="text-xs text-muted">Enregistrer les conversations localement</p>
          </div>
          <Toggle checked={settings.keepHistory} onChange={(v) => update('keepHistory', v)} />
        </section>

        <section className="rounded-xl border border-border bg-elevated p-4">
          <h2 className="text-sm font-semibold mb-2">Confidentialité</h2>
          <p className="text-xs text-muted leading-relaxed">
            En mode démo (aucune clé API configurée), tout reste sur cet appareil : les transcriptions et
            traductions sont stockées uniquement dans le stockage local (localStorage) de votre navigateur.
            Aucun audio n'est jamais enregistré ni envoyé.
          </p>
          <p className="text-xs text-muted leading-relaxed mt-2">
            Si des API réelles sont configurées (traduction: {providerFlags.translationIsReal ? 'activée' : 'non configurée'}),
            le texte transcrit de vos échanges quitterait l'appareil pour être envoyé au fournisseur de traduction
            configuré, afin de générer la traduction. La reconnaissance vocale et la synthèse vocale utilisées ici
            restent, elles, exécutées localement par le navigateur.
          </p>
          <button
            onClick={() => update('slangLevel' as any, settings.slangLevel)}
            className="hidden"
          />
          <button
            onClick={() => {
              settingsService.save(DEFAULT_SETTINGS)
              setSettings(DEFAULT_SETTINGS)
            }}
            className="mt-3 text-xs text-red-400 underline underline-offset-2"
          >
            Réinitialiser les réglages
          </button>
        </section>
      </div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-12 h-7 rounded-full transition relative ${checked ? 'bg-primary' : 'bg-border'}`}
    >
      <span
        className={`absolute top-1 w-5 h-5 rounded-full bg-void transition-all ${checked ? 'left-6' : 'left-1'}`}
      />
    </button>
  )
}
