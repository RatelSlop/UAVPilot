import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { DRONES } from './config'
import { flightOrientation, flightVelocity, stepFlight, type FlightInput, type FlightState } from './flight'

const input: FlightInput = { aimX: 0, aimY: 0, pitch: 0, yaw: 0, bank: 0, throttle: 1 }
const initial: FlightState = { yaw: 0, pitch: 0, bank: 0, speed: 68 }

describe('flight alignment', () => {
  it('keeps the model nose aligned with velocity for every tier, heading, and pitch', () => {
    for (const drone of DRONES) for (const yaw of [-2.4, -0.5, 0.5, 2.4]) for (const pitch of [-0.7, 0, 0.7]) {
      const state = { yaw, pitch, bank: -0.5, speed: drone.speed }
      const nose = new THREE.Vector3(0, 0, -1).applyQuaternion(flightOrientation(state))
      expect(nose.dot(flightVelocity(state).normalize())).toBeCloseTo(1, 12)
    }
  })

  it('banks into the actual turn on either side', () => {
    for (const side of [-1, 1]) {
      let state = { ...initial }
      for (let frame = 0; frame < 30; frame++) state = stepFlight(state, { ...input, aimX: side }, DRONES[0], 1 / 60)
      expect(Math.sign(state.yaw)).toBe(side)
      expect(Math.sign(state.bank)).toBe(-side)
      expect(Math.sign(flightVelocity(state).x)).toBe(side)
    }
  })

  it('reverses the turn with the bank rather than continuing to slide in the old direction', () => {
    let state = { ...initial }
    for (let frame = 0; frame < 60; frame++) state = stepFlight(state, { ...input, aimX: 1 }, DRONES[0], 1 / 60)
    for (let frame = 0; frame < 12; frame++) state = stepFlight(state, { ...input, aimX: -1 }, DRONES[0], 1 / 60)
    const previous = state
    state = stepFlight(state, { ...input, aimX: -1 }, DRONES[0], 1 / 60)
    expect(state.bank).toBeGreaterThan(0)
    expect(state.yaw).toBeLessThan(previous.yaw)
    const nose = new THREE.Vector3(0, 0, -1).applyQuaternion(flightOrientation(state))
    expect(nose.dot(flightVelocity(state).normalize())).toBeCloseTo(1, 12)
  })

  it('lets manual controls override an opposing mouse position', () => {
    const state = stepFlight(initial, { ...input, aimX: -1, aimY: 1, bank: 1, pitch: 1 }, DRONES[0], 0.1)
    expect(state.bank).toBeLessThan(0)
    expect(state.yaw).toBeGreaterThan(0)
    expect(state.pitch).toBeGreaterThan(0)
  })

  it('has consistent steering response at 30 and 120 FPS', () => {
    const advance = (fps: number) => {
      let state = { ...initial }
      for (let frame = 0; frame < fps; frame++) state = stepFlight(state, { ...input, aimX: 0.8, aimY: -0.4, throttle: 0.6 }, DRONES[3], 1 / fps)
      return state
    }
    const slow = advance(30), fast = advance(120)
    for (const key of ['yaw', 'pitch', 'bank', 'speed'] as const) expect(slow[key]).toBeCloseTo(fast[key], 9)
  })
})
