// Vercel serverless function (Node runtime).
//
// This is the ONLY place a translation API key is ever read or used. It is a
// server-only env var (no VITE_ prefix), so it is never bundled into the
// client JS and never leaves the server.
//
// Calls an OpenAI-compatible chat completions endpoint
// (https://api.openai.com/v1/chat/completions by default; any compatible
// provider — Azure OpenAI, OpenRouter, Groq, etc. — works by overriding
// TRANSLATION_API_URL / TRANSLATION_MODEL).

interface TranslateRequestBody {
  text?: string
  sourceLanguage?: string
  targetLanguage?: string
  conversationContext?: { speaker: string; originalText: string; translatedText: string }[]
  translationMode?: 'LITERAL' | 'STANDARD' | 'NATURAL' | 'SLANG'
}

const MODE_INSTRUCTIONS: Record<string, string> = {
  LITERAL:
    'Mode LITTÉRAL : traduis le plus près possible mot à mot tant que le résultat reste grammaticalement correct dans la langue cible. Ne reformule pas, ne stylise pas.',
  STANDARD:
    'Mode STANDARD : traduis fidèlement dans un registre neutre et courant, sans argot ni familiarité excessive.',
  NATURAL:
    'Mode NATUREL : privilégie une formulation naturelle et idiomatique dans la langue cible plutôt qu\'une traduction mot à mot, tout en restant fidèle au sens et au registre d\'origine.',
  SLANG:
    'Mode ARGOT : traduis dans un registre familier/argotique équivalent à celui de la langue source (y compris verlan, expressions familières), sans traduire mot à mot, en restant fidèle au sens.',
}

function buildSystemPrompt(mode: string): string {
  const modeInstruction = MODE_INSTRUCTIONS[mode] ?? MODE_INSTRUCTIONS.STANDARD
  return [
    'Tu es un interprète bilingue professionnel pour une conversation en direct entre deux personnes.',
    'Règles impératives :',
    '- Préserve le sens et l\'intention exacts du texte source, jamais une interprétation libre au-delà du nécessaire.',
    '- Utilise le contexte de conversation fourni uniquement pour résoudre les pronoms, références et ellipses ambiguës.',
    '- N\'invente jamais d\'information absente du texte source.',
    '- Préserve le registre (formel/familier) et comprends les idiomes, l\'argot et le verlan sans les traduire mot à mot lorsque ce n\'est pas le mode demandé.',
    '- Applique le minimum d\'interprétation nécessaire pour produire une traduction naturelle dans le mode demandé.',
    modeInstruction,
    'Réponds UNIQUEMENT avec le texte traduit, sans guillemets, sans préfixe, sans explication, sans commentaire.',
  ].join('\n')
}

function buildUserPrompt(body: TranslateRequestBody): string {
  const context = (body.conversationContext ?? []).slice(-6)
  const contextBlock = context.length
    ? `Contexte récent de la conversation (le plus ancien en premier) :\n${context
        .map((t) => `${t.speaker}: "${t.originalText}" => "${t.translatedText}"`)
        .join('\n')}\n\n`
    : ''

  return [
    contextBlock,
    `Langue source : ${body.sourceLanguage ?? 'auto'}`,
    `Langue cible : ${body.targetLanguage ?? 'en'}`,
    `Texte à traduire :\n"""${body.text ?? ''}"""`,
  ].join('\n')
}

function jsonError(res: any, status: number, message: string) {
  res.status(status).json({ error: message })
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return jsonError(res, 405, 'Method not allowed. Use POST.')
  }

  const apiKey = process.env.TRANSLATION_API_KEY
  if (!apiKey) {
    // No key configured server-side: tell the caller plainly so it can fall
    // back to DEMO mode instead of pretending to have translated anything.
    return jsonError(res, 501, 'TRANSLATION_API_KEY is not configured on the server.')
  }

  let body: TranslateRequestBody
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}
  } catch {
    return jsonError(res, 400, 'Invalid JSON body.')
  }

  if (!body.text || typeof body.text !== 'string') {
    return jsonError(res, 400, 'Missing required field: text')
  }

  const apiUrl = process.env.TRANSLATION_API_URL || 'https://api.openai.com/v1/chat/completions'
  const configuredModel = process.env.TRANSLATION_MODEL || 'gpt-4o-mini'
  const mode = body.translationMode || 'STANDARD'

  // Some OpenAI-compatible providers (Groq in particular) rename/decommission
  // model ids frequently. If the configured model is rejected as unknown or
  // decommissioned, discover a currently-available chat model from the
  // provider's own /models endpoint and retry once instead of hard-failing.
  async function listAvailableModels(): Promise<string[]> {
    const modelsUrl = apiUrl.replace(/\/chat\/completions\/?$/, '/models')
    if (modelsUrl === apiUrl) return []
    try {
      const r = await fetch(modelsUrl, { headers: { Authorization: `Bearer ${apiKey}` } })
      if (!r.ok) return []
      const j = await r.json()
      const ids: string[] = (j?.data ?? []).map((m: any) => m?.id).filter(Boolean)
      // Deprioritize non-chat model families (audio/embedding/moderation/guard).
      const excluded = /whisper|tts|embed|moderation|guard|prompt-guard/i
      return [...ids.filter((id) => !excluded.test(id)), ...ids.filter((id) => excluded.test(id))]
    } catch {
      return []
    }
  }

  async function callChatCompletion(model: string) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 20000)
    try {
      return await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: buildSystemPrompt(mode) },
            { role: 'user', content: buildUserPrompt(body) },
          ],
          temperature: mode === 'LITERAL' ? 0.1 : 0.5,
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
  }

  try {
    let upstream = await callChatCompletion(configuredModel)
    let usedModel = configuredModel
    let discoveryNote = ''

    if (!upstream.ok && (upstream.status === 400 || upstream.status === 404)) {
      const errBody = await upstream.clone().text().catch(() => '')
      if (/model_not_found|model_decommissioned|does not exist/i.test(errBody)) {
        const candidates = await listAvailableModels()
        const fallbackModel = candidates.find((id) => id !== configuredModel)
        if (fallbackModel) {
          const retry = await callChatCompletion(fallbackModel)
          if (retry.ok) {
            upstream = retry
            usedModel = fallbackModel
            discoveryNote = ` (configured model "${configuredModel}" was unavailable; auto-selected "${fallbackModel}" from the provider's live model list — update TRANSLATION_MODEL to this value)`
          } else {
            const retryErr = await retry.text().catch(() => '')
            return jsonError(
              res,
              502,
              `Configured model "${configuredModel}" unavailable, and auto-selected fallback "${fallbackModel}" also failed (${retry.status}): ${retryErr.slice(0, 200)}`,
            )
          }
        } else {
          return jsonError(
            res,
            502,
            `Configured model "${configuredModel}" is unavailable and no working fallback model could be discovered from the provider. Original error: ${errBody.slice(0, 300)}`,
          )
        }
      } else {
        return jsonError(res, 502, `Upstream translation API error ${upstream.status}: ${errBody.slice(0, 300)}`)
      }
    } else if (!upstream.ok) {
      const errText = await upstream.text().catch(() => '')
      return jsonError(res, 502, `Upstream translation API error ${upstream.status}: ${errText.slice(0, 300)}`)
    }

    const data = await upstream.json()
    const translatedText = data?.choices?.[0]?.message?.content?.trim()
    if (!translatedText) {
      return jsonError(res, 502, 'Upstream translation API returned an empty response.')
    }

    res.status(200).json({
      translatedText,
      detectedLang: body.sourceLanguage ?? null,
      confidence: 0.9,
      usedModel,
      note: discoveryNote || undefined,
    })
  } catch (err: any) {
    return jsonError(res, 502, `Translation request failed: ${err?.message ?? 'unknown error'}`)
  }
}
