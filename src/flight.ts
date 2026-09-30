import * as THREE from 'three'
import type { DroneSpec } from './config'

export type FlightState = { yaw: number; pitch: number; bank: number; speed: number }
export type FlightInput = { aimX: number; aimY: number; pitch: number; yaw: number; bank: number; throttle: number }

/** The nose, camera, weapons, and velocity all use this same forward direction. */
export function flightForward(yaw: number, pitch: number) {
  return new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch))
}

export function flightOrientation(state: Pick<FlightState, 'yaw' | 'pitch' | 'bank'>) {
  // Three's positive Y rotation points local -Z left; our positive heading turns right.
  return new THREE.Quaternion().setFromEuler(new THREE.Euler(state.pitch, -state.yaw, state.bank, 'YXZ'))
}

export function flightVelocity(state: FlightState) {
  return flightForward(state.yaw, state.pitch).multiplyScalar(state.speed)
}

export function stepFlight(state: FlightState, input: FlightInput, spec: DroneSpec, dt: number): FlightState {
  const steering = THREE.MathUtils.clamp(input.bank !== 0 ? input.bank * 1.05 : input.yaw !== 0 ? input.yaw : input.aimX * 0.92, -1.25, 1.25)
  const targetBank = -steering * 0.58
  const bankResponse = 8 + spec.turn * 1.5
  const bankDecay = Math.exp(-bankResponse * dt)
  const nextBank = targetBank + (state.bank - targetBank) * bankDecay
  // Integrating the actual bank keeps reversal of the turn aligned with reversal of the roll.
  const integratedBank = targetBank * dt + (state.bank - targetBank) * (1 - bankDecay) / bankResponse
  const targetPitch = THREE.MathUtils.clamp(input.pitch !== 0 ? input.pitch * 0.8 : -input.aimY * 0.7, -0.95, 0.95)
  return {
    yaw: state.yaw - integratedBank * spec.turn / 0.58,
    pitch: THREE.MathUtils.lerp(state.pitch, targetPitch, 1 - Math.exp(-(6 + spec.turn) * dt)),
    bank: nextBank,
    speed: THREE.MathUtils.lerp(state.speed, spec.speed * input.throttle, 1 - Math.exp(-3.5 * dt)),
  }
}
