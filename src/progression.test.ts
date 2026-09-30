import { describe, expect, it, vi } from 'vitest'
import { DRONES, REBIRTH_THRESHOLD, SAVE_KEY, TARGET_STYLE } from './config'
import { canRebirth, damagePayout, freshSave, loadSave, rebirth, scoreMultiplier, unlockedTier } from './progression'

describe('progression', () => {
  it('has eight ordered drone tiers and unlocks each at its threshold', () => {
    expect(DRONES).toHaveLength(8)
    for (let i = 0; i < DRONES.length; i++) {
      expect(unlockedTier(DRONES[i].threshold)).toBe(i)
      if (i > 0) expect(DRONES[i].threshold).toBeGreaterThan(DRONES[i - 1].threshold)
      expect(DRONES[i].speed).toBeGreaterThan(0)
      expect(DRONES[i].damage).toBeGreaterThan(0)
    }
    expect(REBIRTH_THRESHOLD - DRONES.at(-1)!.threshold).toBe(3000)
  })

  it('awards points in proportion to actual health removed, with no overkill points', () => {
    const first = damagePayout(500, 300, 300, 180, 0)
    expect(first.health).toBe(120)
    expect(first.pointsEarned).toBe(300)
    const second = damagePayout(500, 300, first.health, 999, 0)
    expect(second.health).toBe(0)
    expect(second.pointsEarned).toBe(200)
    expect(damagePayout(500, 300, 0, 999, 0).pointsEarned).toBe(0)
    expect(first.pointsEarned + second.pointsEarned).toBe(500)
  })

  it('resets points and drone selection while preserving permanent rebirth rewards', () => {
    const save = { ...freshSave(), score: REBIRTH_THRESHOLD, selected: 7, rebirths: 1 }
    expect(canRebirth(save)).toBe(true)
    expect(rebirth(save)).toMatchObject({ score: 0, selected: 0, rebirths: 2 })
    expect(scoreMultiplier(2)).toBe(1)
    expect(scoreMultiplier(3)).toBe(1.1)
    expect(scoreMultiplier(100)).toBe(1.5)
  })

  it('keeps target payouts in the planned ranges', () => {
    expect(TARGET_STYLE.house.points).toBeGreaterThanOrEqual(100)
    expect(TARGET_STYLE.house.points).toBeLessThanOrEqual(200)
    expect(TARGET_STYLE.power.points).toBeGreaterThanOrEqual(900)
    expect(TARGET_STYLE.power.points).toBeLessThanOrEqual(1400)
    expect(TARGET_STYLE.turret.points).toBeGreaterThanOrEqual(150)
    expect(TARGET_STYLE.turret.points).toBeLessThanOrEqual(300)
    expect(TARGET_STYLE.base.points * 3 + TARGET_STYLE.turret.points * 3).toBeGreaterThanOrEqual(2500)
    expect(TARGET_STYLE.base.points * 3 + TARGET_STYLE.turret.points * 3).toBeLessThanOrEqual(4000)
  })

  it('repairs malformed, outdated, and out-of-range saves', () => {
    const storage = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null })
    storage.set(SAVE_KEY, '{bad json')
    expect(loadSave()).toEqual(freshSave())
    storage.set(SAVE_KEY, JSON.stringify({ version: 0, score: 10000 }))
    expect(loadSave()).toEqual(freshSave())
    storage.set(SAVE_KEY, JSON.stringify({ version: 1, score: 2500, selected: 7, rebirths: -3, muted: true }))
    expect(loadSave()).toMatchObject({ score: 2500, selected: 2, rebirths: 0, muted: true })
    vi.unstubAllGlobals()
  })
})
