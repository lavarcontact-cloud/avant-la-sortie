import type { Conversation } from '../types'

const STORAGE_KEY = 'loba.history.v1'

function readAll(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as Conversation[]
  } catch {
    return []
  }
}

function writeAll(items: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    // storage full / blocked — fail silently, history is best-effort
  }
}

export const historyService = {
  list(): Conversation[] {
    return readAll().sort((a, b) => b.updatedAt - a.updatedAt)
  },

  get(id: string): Conversation | undefined {
    return readAll().find((c) => c.id === id)
  },

  save(conversation: Conversation): void {
    const all = readAll()
    const idx = all.findIndex((c) => c.id === conversation.id)
    if (idx >= 0) all[idx] = conversation
    else all.push(conversation)
    writeAll(all)
  },

  rename(id: string, title: string): void {
    const all = readAll()
    const item = all.find((c) => c.id === id)
    if (item) {
      item.title = title
      item.updatedAt = Date.now()
      writeAll(all)
    }
  },

  remove(id: string): void {
    writeAll(readAll().filter((c) => c.id !== id))
  },

  clear(): void {
    writeAll([])
  },
}
