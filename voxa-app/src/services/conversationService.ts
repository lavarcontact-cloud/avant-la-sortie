import type { Conversation, ConversationTurn, LanguageCode } from '../types'

export function createConversation(langA: LanguageCode, langB: LanguageCode): Conversation {
  const now = Date.now()
  return {
    id: crypto.randomUUID(),
    title: `Conversation du ${new Date(now).toLocaleDateString('fr-FR')}`,
    createdAt: now,
    updatedAt: now,
    langA,
    langB,
    turns: [],
  }
}

export function appendTurn(conversation: Conversation, turn: ConversationTurn): Conversation {
  return {
    ...conversation,
    updatedAt: Date.now(),
    turns: [...conversation.turns, turn],
  }
}

export function recentContext(conversation: Conversation, n = 6): ConversationTurn[] {
  return conversation.turns.slice(-n)
}
