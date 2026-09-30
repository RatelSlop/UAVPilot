import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { WORLD_HALF_SIZE } from './config'
import { createWorld } from './world'

describe('expanded world', () => {
  it('populates all four outer quadrants and keeps targets inside the operation area', () => {
    const scene = new THREE.Scene()
    const targets = createWorld(scene)
    expect(WORLD_HALF_SIZE * 2).toBe(4000)
    expect(targets.length).toBeGreaterThanOrEqual(195)
    for (const xSign of [-1, 1]) for (const zSign of [-1, 1]) {
      expect(targets.filter(t => t.position.x * xSign > 600 && t.position.z * zSign > 600).length).toBeGreaterThan(10)
    }
    for (const target of targets) {
      expect(Math.max(Math.abs(target.box.min.x), Math.abs(target.box.max.x), Math.abs(target.box.min.z), Math.abs(target.box.max.z))).toBeLessThan(WORLD_HALF_SIZE)
      expect(target.box.isEmpty()).toBe(false)
    }
    expect(targets.filter(t => t.turret).every(t => t.turret!.range <= 180)).toBe(true)
    const instances = scene.children.filter(object => object instanceof THREE.InstancedMesh) as THREE.InstancedMesh[]
    expect(instances.some(mesh => mesh.count > 1500)).toBe(true)
  })
})
