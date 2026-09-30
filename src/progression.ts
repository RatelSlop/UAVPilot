import { DRONES, REBIRTH_THRESHOLD, SAVE_KEY } from './config'

export type SaveData = { version: 1; score: number; rebirths: number; selected: number; muted: boolean }

export function freshSave(): SaveData { return { version: 1, score: 0, rebirths: 0, selected: 0, muted: false } }

export function unlockedTier(score: number) {
  for (let i = DRONES.length - 1; i >= 0; i--) if (score >= DRONES[i].threshold) return i
  return 0
}

export function scoreMultiplier(rebirths: number) {
  return 1 + Math.min(5, Math.max(0, rebirths - 2)) * 0.1
}

export function canRebirth(data: SaveData) { return data.score >= REBIRTH_THRESHOLD }

export function damagePayout(points: number, maxHealth: number, beforeHealth: number, incomingDamage: number, rebirths: number) {
  const actualDamage = Math.min(Math.max(0, beforeHealth), Math.max(0, incomingDamage))
  return {
    health: Math.max(0, beforeHealth - actualDamage),
    actualDamage,
    pointsEarned: maxHealth > 0 ? points * actualDamage / maxHealth * scoreMultiplier(rebirths) : 0,
  }
}

export function rebirth(data: SaveData): SaveData {
  if (!canRebirth(data)) return data
  return { ...data, score: 0, selected: 0, rebirths: data.rebirths + 1 }
}

export function loadSave(): SaveData {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null') as Partial<SaveData> | null
    if (!raw || raw.version !== 1) return freshSave()
    const score = Number.isFinite(raw.score) ? Math.max(0, Math.min(1e9, Number(raw.score))) : 0
    const rebirths = Number.isFinite(raw.rebirths) ? Math.max(0, Math.min(1000, Math.floor(Number(raw.rebirths)))) : 0
    const selected = Number.isFinite(raw.selected) ? Math.max(0, Math.min(unlockedTier(score), Math.floor(Number(raw.selected)))) : 0
    return { version: 1, score, rebirths, selected, muted: raw.muted === true }
  } catch { return freshSave() }
}

export function saveGame(data: SaveData) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)) } catch { /* Gameplay continues without persistent storage. */ }
}
