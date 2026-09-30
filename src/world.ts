import * as THREE from 'three'
import { TARGET_STYLE, WORLD_HALF_SIZE, type TargetKind } from './config'

export type Target = {
  kind: TargetKind
  name: string
  group: THREE.Group
  rubble: THREE.Mesh
  box: THREE.Box3
  position: THREE.Vector3
  maxHealth: number
  health: number
  points: number
  respawn: number
  destroyedAt: number
  turret?: { head: THREE.Group; range: number; cooldown: number; phase: number }
}

const mat = (color: number, roughness = 0.86) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.05 })
const groundMat = mat(0x728276)
const roadMat = mat(0x343f42)
const lineMat = mat(0xb6b39b)
const grassMat = mat(0x698071)
const concreteMat = mat(0x747f7c)
const sandMat = mat(0x9a9879)

function box(w: number, h: number, d: number, material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function cylinder(top: number, bottom: number, height: number, material: THREE.Material, sides = 10) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, sides), material)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function plane(w: number, d: number, material: THREE.Material, x: number, z: number, y = 0.05) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material)
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(x, y, z)
  mesh.receiveShadow = true
  return mesh
}

let seed = 918273
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}

export function createWorld(scene: THREE.Scene): Target[] {
  seed = 918273
  const targets: Target[] = []
  scene.background = new THREE.Color(0x9ab3b2)
  scene.fog = new THREE.FogExp2(0xa8bbba, 0.00043)

  const sun = new THREE.DirectionalLight(0xffe7ba, 2.4)
  sun.name = 'sun'
  sun.position.set(-260, 420, 110)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -560
  sun.shadow.camera.right = 560
  sun.shadow.camera.top = 560
  sun.shadow.camera.bottom = -560
  sun.shadow.normalBias = 0.02
  sun.shadow.camera.far = 1300
  scene.add(sun, sun.target, new THREE.HemisphereLight(0xcde1e2, 0x57604f, 1.6))

  // Extra scenery beyond the flight boundary keeps the horizon continuous.
  const ground = plane(WORLD_HALF_SIZE * 2 + 1500, WORLD_HALF_SIZE * 2 + 1500, groundMat, 0, 0, 0)
  scene.add(ground)
  for (const [x, z, w, d, material] of [
    [-280, 240, 260, 220, grassMat], [300, 250, 280, 250, sandMat],
    [-300, -110, 285, 220, concreteMat], [-320, -350, 230, 200, concreteMat],
    [230, -60, 250, 210, concreteMat], [290, -320, 310, 200, concreteMat],
    [0, -385, 290, 225, sandMat],
  ] as [number, number, number, number, THREE.Material][]) scene.add(plane(w, d, material, x, z, 0.12))

  const roads: { x: number; z: number; w: number; d: number }[] = []
  const markings: { x: number; z: number; w: number; d: number }[] = []
  function addRoad(x: number, z: number, w: number, d: number) {
    roads.push({ x, z, w, d })
    scene.add(plane(w, d, roadMat, x, z, 0.2))
    if (w > d) for (let dx = -w / 2 + 16; dx < w / 2 - 8; dx += 24) markings.push({ x: x + dx, z, w: 10, d: 0.5 })
    else for (let dz = -d / 2 + 16; dz < d / 2 - 8; dz += 24) markings.push({ x, z: z + dz, w: 0.5, d: 10 })
  }
  for (const [x, z, w, d] of [
    [0, 80, 1190, 18], [0, -210, 1190, 18], [-170, 0, 18, 1150],
    [165, 0, 18, 1150], [-420, 200, 18, 650], [425, 5, 18, 850],
    [0, 370, 750, 16], [0, -490, 890, 18],
  ]) {
    addRoad(x, z, w, d)
  }
  for (const z of [-1500, -900, 850, 1500]) addRoad(0, z, 3880, 18)
  for (const x of [-1450, -800, 850, 1500]) addRoad(x, 0, 18, 3880)
  addRoad(0, 80, 3880, 18)
  addRoad(165, 0, 18, 3880)

  // A river and rail corridor make the districts legible from the air.
  scene.add(plane(26, 5500, mat(0x658b91, 0.25), 74, 0, 0.17))
  const railMaterial = mat(0x6d6860)
  scene.add(plane(3, 3880, railMaterial, 258, 0, 0.19))
  scene.add(plane(3, 3880, railMaterial, 272, 0, 0.19))
  const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(23, 0.1, 2), mat(0x575750), 299)
  const instance = new THREE.Object3D()
  for (let i = 0; i < 299; i++) {
    instance.position.set(265, 0.19, -1937 + i * 13)
    instance.updateMatrix()
    sleepers.setMatrixAt(i, instance.matrix)
  }
  sleepers.receiveShadow = true
  scene.add(sleepers)

  function makeTarget(kind: TargetKind, name: string, x: number, z: number, w: number, h: number, d: number, color: number, hpScale = 1): Target {
    const group = new THREE.Group()
    group.position.set(x, 0, z)
    const wall = mat(color)
    const roof = mat(new THREE.Color(color).multiplyScalar(0.62).getHex())
    const trim = mat(0xc3c8b5)
    const dark = mat(0x354246)
    const orange = mat(0xba7954)
    const main = box(w, h, d, wall)
    main.position.y = h / 2
    group.add(main)

    if (kind === 'house' || kind === 'farm') {
      const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.79, 5, 4), roof)
      roofMesh.rotation.y = Math.PI / 4
      roofMesh.position.y = h + 2
      roofMesh.castShadow = true
      group.add(roofMesh)
      for (const side of [-1, 1]) {
        const window = box(2.5, 2.5, 0.2, dark)
        window.position.set(side * w * 0.25, h * 0.57, d / 2 + 0.12)
        group.add(window)
      }
      const door = box(2.8, 4, 0.25, trim)
      door.position.set(0, 2, d / 2 + 0.15)
      group.add(door)
    } else if (kind === 'fuel') {
      group.remove(main)
      const tank = cylinder(w * 0.48, w * 0.48, h, wall, 16)
      tank.position.y = h / 2
      group.add(tank)
      const cap = cylinder(w * 0.5, w * 0.5, 0.7, roof, 16)
      cap.position.y = h
      group.add(cap)
      for (let i = 0; i < 3; i++) {
        const band = cylinder(w * 0.49, w * 0.49, 0.32, trim, 16)
        band.position.y = h * (0.24 + i * 0.25)
        group.add(band)
      }
    } else if (kind === 'comms') {
      group.remove(main)
      const mast = cylinder(0.5, 1.7, h, dark, 6)
      mast.position.y = h / 2
      group.add(mast)
      for (let level = 8; level < h; level += 9) {
        const brace = box(13 - level / 8, 0.7, 0.7, trim)
        brace.position.y = level
        group.add(brace)
      }
      const dish = new THREE.Mesh(new THREE.SphereGeometry(2.5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), trim)
      dish.rotation.x = Math.PI / 2
      dish.position.set(2.4, h - 5, 0)
      group.add(dish)
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), mat(0xf46f62, 0.3))
      beacon.position.y = h + 1
      group.add(beacon)
    } else if (kind === 'power') {
      const roofUnit = box(w * 0.6, 4, d * 0.55, roof)
      roofUnit.position.y = h + 2
      group.add(roofUnit)
      for (const side of [-1, 1]) {
        const stack = cylinder(2.4, 3, h * 1.2, dark)
        stack.position.set(side * w * 0.25, h * 1.1, -d * 0.2)
        group.add(stack)
      }
    } else if (kind === 'rail') {
      const beam = box(w + 4, 2, d + 4, roof)
      beam.position.y = h + 1
      group.add(beam)
    } else {
      const roofMesh = box(w + 1.5, 1.5, d + 1.5, roof)
      roofMesh.position.y = h + 0.75
      group.add(roofMesh)
      const shutter = box(w * 0.28, h * 0.56, 0.3, dark)
      shutter.position.set(0, h * 0.28, d / 2 + 0.2)
      group.add(shutter)
      if (kind === 'factory') for (const side of [-1, 1]) {
        const stack = cylinder(2.4, 3, h * 0.8, orange)
        stack.position.set(side * w * 0.28, h * 1.25, -d * 0.25)
        group.add(stack)
      }
    }

    scene.add(group)
    const rubble = box(w * 0.75, 1, d * 0.72, mat(0x5c5e58))
    rubble.position.set(x, 0.55, z)
    rubble.visible = false
    scene.add(rubble)
    const style = TARGET_STYLE[kind]
    const target: Target = {
      kind, name, group, rubble,
      box: new THREE.Box3().setFromObject(group),
      position: new THREE.Vector3(x, h / 2, z), maxHealth: Math.round(style.health * hpScale), health: Math.round(style.health * hpScale),
      points: style.points, respawn: style.respawn, destroyedAt: -1,
    }
    group.traverse(object => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) object.userData.baseColor = object.material.color.clone()
    })
    targets.push(target)
    return target
  }

  // Residential quarter and farms.
  let houseIndex = 1
  for (const x of [-360, -310, -255, -205]) for (const z of [170, 230, 295]) {
    const jitter = (random() - 0.5) * 8
    makeTarget('house', `House ${houseIndex++}`, x + jitter, z + jitter, 18, 11, 16, [0xcbbda6, 0xb7c6bc, 0xd6c6b2, 0xb4ada4][houseIndex % 4])
  }
  for (let i = 0; i < 6; i++) {
    const x = 225 + (i % 3) * 73
    const z = 180 + Math.floor(i / 3) * 95
    makeTarget('farm', `Farm ${i + 1}`, x, z, 27, 12, 21, i % 2 ? 0xb9aa82 : 0xb7c0a4)
    scene.add(plane(44, 24, mat(0x8f9a6c), x + 26, z + 26, 0.14))
  }

  // Industry, logistics and infrastructure.
  for (let i = 0; i < 4; i++) makeTarget('factory', `Factory ${i + 1}`, -365 + (i % 2) * 100, -80 - Math.floor(i / 2) * 93, 57, 24, 43, i % 2 ? 0x8c9998 : 0xada99c)
  for (let i = 0; i < 3; i++) makeTarget('power', `Power unit ${i + 1}`, -390 + (i % 2) * 100, -325 - Math.floor(i / 2) * 85, 53, 20, 41, 0x8d9d98)
  for (let i = 0; i < 4; i++) makeTarget('fuel', `Fuel tank ${i + 1}`, 5 + (i % 2) * 54, -283 - Math.floor(i / 2) * 62, 24, 19, 24, 0xc0b7a4)
  for (let i = 0; i < 3; i++) makeTarget('freight', `Freight shed ${i + 1}`, 232 + (i % 2) * 88, -5 - Math.floor(i / 2) * 88, 62, 20, 35, 0xa2a6a0)
  for (let i = 0; i < 2; i++) makeTarget('rail', `Rail bridge ${i + 1}`, 265, 77 + i * 34, 43, 4, 17, 0x737873)
  for (let i = 0; i < 3; i++) makeTarget('comms', `Relay tower ${i + 1}`, 397, -235 - i * 63, 13, 54, 13, 0x9ba7a2)
  makeTarget('comms', 'Central relay tower', 0, 255, 16, 76, 16, 0x9ba7a2)
  for (let i = 0; i < 2; i++) makeTarget('airfield', `Hangar ${i + 1}`, 245 + i * 110, -360, 76, 23, 58, 0x909d9a)
  scene.add(plane(340, 44, roadMat, 290, -466, 0.22))
  for (let i = -4; i <= 4; i++) scene.add(plane(12, 1, lineMat, 290 + i * 36, -466, 0.23))
  for (let i = 0; i < 3; i++) makeTarget('base', `Base facility ${i + 1}`, -92 + i * 92, -367 - (i % 2) * 70, 62, 19, 38, 0x939582)

  function turret(name: string, x: number, z: number, range: number) {
    const target = makeTarget('turret', name, x, z, 8, 6, 8, 0x616d69)
    target.group.clear()
    const base = cylinder(4, 5.5, 5, mat(0x53605b))
    base.position.y = 2.5
    target.group.add(base)
    const head = new THREE.Group()
    head.position.y = 5.7
    const dome = box(7, 3, 7, mat(0x718179))
    head.add(dome)
    for (const side of [-1, 1]) {
      const barrel = box(1, 1, 10, mat(0x2f393a))
      barrel.position.set(side * 1.5, 0.6, -5.2)
      head.add(barrel)
    }
    target.group.add(head)
    target.box.setFromObject(target.group)
    target.group.traverse(object => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) object.userData.baseColor = object.material.color.clone()
    })
    target.turret = { head, range, cooldown: 1.5 + random(), phase: random() * 6 }
  }
  turret('Power defense', -275, -323, 180)
  turret('Base defense north', -145, -314, 155)
  turret('Base defense east', 107, -357, 155)
  turret('Base defense south', -15, -487, 155)
  turret('Fuel defense', 117, -280, 145)
  turret('Airfield defense', 393, -385, 150)

  // Outer districts retain normal-sized buildings, with long flight corridors between sites.
  for (const [name, cx, cz] of [
    ['Westhaven', -1220, 250], ['Eastbank', 1160, 450], ['Northwood', -1000, -1050],
    ['Southridge', -1000, 1300], ['Harvest town', 1260, 1300],
  ] as [string, number, number][]) {
    scene.add(plane(350, 310, grassMat, cx, cz, 0.12))
    addRoad(cx, cz, 345, 12)
    addRoad(cx, cz, 12, 305)
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      const dx = (col - 1.5) * 65 + (col < 2 ? -10 : 10)
      const dz = (row - 1.5) * 57 + (row < 2 ? -12 : 12)
      makeTarget('house', `${name} house ${row * 4 + col + 1}`, cx + dx, cz + dz, 18 + random() * 6, 10 + random() * 4, 18, [0xcbbda6, 0xb7c6bc, 0xb4ada4][col % 3])
    }
  }
  const fieldMaterials = [mat(0x8f9a6c), mat(0xa09b70), mat(0x778861)]
  for (const [name, cx, cz] of [['West valley', -1370, 820], ['South fields', 610, 1470], ['East plains', 1390, -1000], ['North farms', -550, -1560]] as [string, number, number][]) {
    for (let i = 0; i < 6; i++) {
      const x = cx + (i % 3 - 1) * 88
      const z = cz + (Math.floor(i / 3) - 0.5) * 104
      scene.add(plane(76, 76, fieldMaterials[i % 3], x, z + 30, 0.12))
      makeTarget('farm', `${name} barn ${i + 1}`, x, z, 26, 12, 22, 0xb9aa82)
    }
  }
  for (const [name, cx, cz] of [['West industrial park', -1330, -450], ['East industrial park', 1120, -650]] as [string, number, number][]) {
    scene.add(plane(355, 250, concreteMat, cx, cz, 0.12))
    addRoad(cx, cz, 350, 12)
    for (let i = 0; i < 5; i++) makeTarget('factory', `${name} ${i + 1}`, cx + (i % 3 - 1) * 95, cz + (i < 3 ? -54 : 60), 57, 25, 45, 0xa2aba3)
  }
  for (const [name, cx, cz] of [['Northern fuel depot', 600, -1220], ['Southern fuel depot', -1520, 1200]] as [string, number, number][]) {
    scene.add(plane(190, 185, concreteMat, cx, cz, 0.12))
    for (let i = 0; i < 4; i++) makeTarget('fuel', `${name} tank ${i + 1}`, cx + (i % 2 - 0.5) * 64, cz + (Math.floor(i / 2) - 0.5) * 64, 29, 23, 29, 0xc0b7a4)
    turret(`${name} defense`, cx + 85, cz + 52, 150)
  }
  scene.add(plane(340, 210, concreteMat, -1090, -1460, 0.12))
  for (let i = 0; i < 3; i++) makeTarget('power', `Northern power unit ${i + 1}`, -1200 + i * 100, -1430, 58, 25, 46, 0x8d9d98)
  turret('Northern power defense', -970, -1370, 175)
  scene.add(plane(330, 210, concreteMat, 430, 1000, 0.12))
  for (let i = 0; i < 4; i++) makeTarget('freight', `Southern freight shed ${i + 1}`, 360 + (i % 2) * 115, 950 + Math.floor(i / 2) * 92, 70, 21, 44, 0xa2a6a0)
  for (const [name, cx, cz] of [['Northern base', 1060, -1440], ['Western outpost', -1550, -1120]] as [string, number, number][]) {
    scene.add(plane(315, 260, sandMat, cx, cz, 0.12))
    for (let i = 0; i < 3; i++) makeTarget('base', `${name} facility ${i + 1}`, cx + (i - 1) * 85, cz - (i % 2) * 65, 62, 19, 40, 0x939582)
    turret(`${name} east defense`, cx + 137, cz + 28, 155)
    turret(`${name} west defense`, cx - 137, cz + 28, 155)
  }
  scene.add(plane(520, 330, concreteMat, 1200, -90, 0.12))
  for (let i = 0; i < 3; i++) makeTarget('airfield', `Eastern airport hangar ${i + 1}`, 1030 + i * 155, -80, 87, 26, 65, 0x909d9a)
  addRoad(1200, -200, 495, 42)
  turret('Eastern airport defense', 1390, 8, 175)
  for (const [i, x, z] of [[1, -1650, -1630], [2, 1650, 1650], [3, 550, 550], [4, -550, 900]]) {
    makeTarget('comms', `Regional relay ${i}`, x, z, 15, 66, 15, 0x9ba7a2)
  }
  makeTarget('rail', 'Northern rail crossing', 265, -900, 43, 4, 22, 0x737873)
  makeTarget('rail', 'Southern rail crossing', 265, 850, 43, 4, 22, 0x737873)

  const stripes = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.025, 1), lineMat, markings.length)
  for (let i = 0; i < markings.length; i++) {
    const mark = markings[i]
    instance.position.set(mark.x, 0.225, mark.z)
    instance.scale.set(mark.w, 1, mark.d)
    instance.updateMatrix()
    stripes.setMatrixAt(i, instance.matrix)
  }
  scene.add(stripes)

  // Forests use instancing so the larger landscape doesn't require thousands of draw calls.
  const trunkMat = mat(0x695d49)
  const trees: { x: number; z: number; height: number; width: number }[] = []
  for (let i = 0; i < 2350; i++) {
    const x = (random() - 0.5) * 4700
    const z = (random() - 0.5) * 4700
    if (Math.abs(x - 74) < 25 || Math.abs(x - 265) < 23) continue
    if (targets.some(t => x > t.box.min.x - 16 && x < t.box.max.x + 16 && z > t.box.min.z - 16 && z < t.box.max.z + 16)) continue
    if (roads.some(r => Math.abs(x - r.x) < r.w / 2 + 8 && Math.abs(z - r.z) < r.d / 2 + 8)) continue
    trees.push({ x, z, height: 10 + random() * 12, width: 4 + random() * 3 })
  }
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.7, 1.1, 1, 6), trunkMat, trees.length)
  const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 6), mat(0x648266), trees.length)
  const treeColor = new THREE.Color()
  for (let i = 0; i < trees.length; i++) {
    const tree = trees[i]
    instance.position.set(tree.x, tree.height * 0.21, tree.z)
    instance.scale.set(1, tree.height * 0.42, 1)
    instance.updateMatrix()
    trunks.setMatrixAt(i, instance.matrix)
    instance.position.y = tree.height * 0.8
    instance.scale.set(tree.width, tree.height * 0.85, tree.width)
    instance.updateMatrix()
    crowns.setMatrixAt(i, instance.matrix)
    crowns.setColorAt(i, treeColor.setHex([0x58755e, 0x648266, 0x758b68][i % 3]))
  }
  trunks.castShadow = crowns.castShadow = true
  trunks.receiveShadow = crowns.receiveShadow = true
  scene.add(trunks, crowns)

  const hillMaterial = mat(0x667c6b)
  for (let i = 0; i < 36; i++) {
    const angle = i / 36 * Math.PI * 2
    const height = 180 + random() * 220
    const hill = new THREE.Mesh(new THREE.ConeGeometry(200 + random() * 160, height, 7), hillMaterial)
    hill.position.set(Math.sin(angle) * 2470, height / 2 - 5, Math.cos(angle) * 2470)
    hill.scale.z = 1.2
    hill.receiveShadow = true
    scene.add(hill)
  }

  return targets
}

export function setTargetDamageVisual(target: Target) {
  const fraction = Math.max(0, target.health / target.maxHealth)
  target.group.visible = fraction > 0
  target.rubble.visible = fraction === 0
  target.group.traverse(object => {
    if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && object.userData.baseColor) {
      object.material.color.copy(object.userData.baseColor as THREE.Color).multiplyScalar(0.48 + fraction * 0.52)
    }
  })
  if (fraction > 0) target.group.scale.y = 0.78 + fraction * 0.22
  else target.group.scale.y = 1
}
