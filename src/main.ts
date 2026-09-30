import * as THREE from 'three'
import { DRONES, REBIRTH_THRESHOLD, WORLD_HALF_SIZE, type DroneSpec } from './config'
import { canRebirth, damagePayout, freshSave, loadSave, rebirth, saveGame, unlockedTier, type SaveData } from './progression'
import { createWorld, setTargetDamageVisual, type Target } from './world'
import { flightForward, flightOrientation, flightVelocity, stepFlight } from './flight'
import './style.css'

type Projectile = { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; damage: number }
type Bomb = { mesh: THREE.Group; velocity: THREE.Vector3; life: number }
type Particle = { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number; maxLife: number }
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!
const clamp = THREE.MathUtils.clamp
const lerp = THREE.MathUtils.lerp

const app = $('#app')
app.innerHTML = `
  <div id="viewport"></div>
  <div id="vignette"></div>
  <div id="hud" class="hidden">
    <div class="hud-top">
      <div class="brand"><span class="brand-mark">✦</span><span>UAV<span class="brand-light">PILOT</span></span><small>STRIKE THE HORIZON</small></div>
      <div class="status-pill"><span class="live-dot"></span><span id="mission-state">FLIGHT ACTIVE</span></div>
      <button id="pause-button" class="icon-button" title="Pause (Esc)">Ⅱ</button>
    </div>
    <div class="hud-left">
      <div class="eyebrow">AIRFRAME <span id="hud-designation">D-01</span></div>
      <div id="hud-drone" class="hud-drone">SPARROW</div>
      <div class="stat"><span>INTEGRITY</span><strong id="hud-hp">100%</strong></div><div class="bar"><i id="hp-fill"></i></div>
      <div class="stat"><span>THROTTLE</span><strong id="hud-throttle">100%</strong></div><div class="bar amber"><i id="throttle-fill"></i></div>
      <div class="telemetry"><div><span>SPD</span><strong id="hud-speed">000</strong><small>KM/H</small></div><div><span>ALT</span><strong id="hud-alt">000</strong><small>M</small></div></div>
    </div>
    <div class="hud-right">
      <div class="eyebrow">MISSION SCORE</div><div id="hud-score" class="score">0</div>
      <div class="score-sub"><span id="hud-next">NEXT AIRFRAME 1,000</span><span id="hud-rebirth">REBIRTH 37,000</span></div>
      <div id="minimap"><canvas id="map-canvas" width="190" height="190"></canvas><span class="map-title">OPERATION AREA · 4 × 4 KM</span><span class="map-n">N</span></div>
    </div>
    <div id="crosshair"><span class="crosshair-h"></span><span class="crosshair-v"></span><span class="crosshair-dot"></span></div>
    <div id="steer-cue"></div>
    <div id="target-readout">NO TARGET</div>
    <div id="alert"></div>
    <div class="hud-bottom"><div class="controls-hint"><b>MOUSE</b> AIM <b>W/S</b> THROTTLE <b>A/D</b> BANK <b>Q/E</b> YAW <b>R/F</b> PITCH <b>V</b> CAMERA</div><div id="weapon-hint"></div></div>
    <div id="respawn" class="hidden"><div class="respawn-title">SIGNAL LOST</div><div id="respawn-reason">AIRFRAME DESTROYED</div><div class="respawn-sub">REDEPLOYING DRONE…</div></div>
  </div>
  <div id="menu" class="screen">
    <div class="menu-shade"></div>
    <div class="menu-content">
      <div class="menu-topline"><span>✦ UAVPILOT</span><span>OPERATION · OPEN SKIES</span></div>
      <div class="menu-main">
        <div class="menu-copy"><div class="overline"><span class="orange-line"></span> SINGLE PLAYER FLIGHT COMBAT</div><h1>STRIKE THE<br><em>HORIZON.</em></h1><p>Launch. Navigate. Hit your target. Every strike earns the points to build a stronger fleet.</p><div class="menu-actions"><button id="launch-button" class="primary-button">LAUNCH DRONE <span>↗</span></button><button id="controls-button" class="secondary-button">FLIGHT CONTROLS</button></div></div>
        <div class="hangar"><div class="panel-head"><div><span class="overline">YOUR HANGAR</span><h2>Airframes</h2></div><span id="hangar-progress">01 / 08</span></div><div id="drone-list" class="drone-list"></div><div class="hangar-footer"><div><span>POINTS</span><strong id="menu-score">0</strong></div><div><span>REBIRTHS</span><strong id="menu-rebirths">0</strong></div><button id="rebirth-button" disabled>REBIRTH AT 37,000</button></div></div>
      </div>
      <div class="menu-footer"><span>LOW-POLY STRIKE SANDBOX</span><span>DESKTOP · WEBGL 2</span></div>
    </div>
  </div>
  <div id="controls-modal" class="modal hidden"><div class="modal-card"><button id="close-controls" class="modal-close">×</button><span class="overline">FLIGHT MANUAL</span><h2>Take control.</h2><div class="control-grid"><div><b>MOUSE</b><span>Guide heading and pitch</span></div><div><b>W / S</b><span>Increase / decrease throttle</span></div><div><b>A / D</b><span>Manual bank</span></div><div><b>Q / E</b><span>Manual yaw</span></div><div><b>R / F</b><span>Manual pitch up / down</span></div><div><b>V</b><span>Switch FPV / chase view</span></div><div><b>SPACE</b><span>Drop bomb after first rebirth</span></div><div><b>LEFT CLICK</b><span>Fire gun after second rebirth</span></div><div><b>M</b><span>Mute / unmute sound</span></div><div><b>ESC</b><span>Pause and open hangar</span></div></div><p>Point toward a structure and hit it to detonate your drone. Damaged targets pay points immediately, even if they survive.</p><button id="controls-done" class="primary-button">UNDERSTOOD <span>↗</span></button><button id="reset-save" class="reset-button">RESET SAVED PROGRESS</button></div></div>
  <div id="confirm-modal" class="modal hidden"><div class="modal-card confirm-card"><span class="overline">CONFIRM ACTION</span><h2 id="confirm-title">Are you sure?</h2><p id="confirm-message"></p><div class="confirm-actions"><button id="confirm-cancel" class="secondary-button">CANCEL</button><button id="confirm-accept" class="primary-button">CONFIRM <span>↗</span></button></div></div></div>
  <div id="toast-stack"></div>
`

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
$('#viewport').appendChild(renderer.domElement)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 6500)
const targets = createWorld(scene)
const sunlight = scene.getObjectByName('sun') as THREE.DirectionalLight
const shadowAnchor = new THREE.Vector3()
let save: SaveData = loadSave()
const drone = createDroneModel()
scene.add(drone)

let active = false
let alive = false
let cameraMode: 'fpv' | 'chase' = 'chase'
let yaw = 0
let pitch = -0.08
let bank = 0
let throttle = 1
let hp = DRONES[save.selected].health
let position = new THREE.Vector3(0, 75, 500)
let velocity = new THREE.Vector3()
let mouseX = 0
let mouseY = 0
let firing = false
let gunCooldown = 0
let bombCooldown = 0
let respawnTimer = 0
let elapsed = 0
let lastFrame = performance.now()
let alertTimer = 0
let audioContext: AudioContext | null = null
const keys = new Set<string>()
const projectiles: Projectile[] = []
const bombs: Bomb[] = []
const particles: Particle[] = []
const blastGeometry = new THREE.SphereGeometry(1, 8, 6)
const projectileGeometry = new THREE.SphereGeometry(0.75, 6, 4)
const raycaster = new THREE.Ray()
const temp = new THREE.Vector3()
const canvas2d = $('#map-canvas') as HTMLCanvasElement
const ctx = canvas2d.getContext('2d')!
let lastHudUpdate = 0
let confirmHandler: (() => void) | null = null

function askConfirm(title: string, message: string, action: () => void) {
  $('#confirm-title').textContent = title
  $('#confirm-message').textContent = message
  confirmHandler = action
  $('#confirm-modal').classList.remove('hidden')
}

function createDroneModel() {
  const group = new THREE.Group()
  const body = new THREE.Mesh(new THREE.ConeGeometry(1.25, 7.2, 6), new THREE.MeshStandardMaterial({ color: DRONES[save.selected].color, metalness: 0.45, roughness: 0.45 }))
  body.rotation.x = -Math.PI / 2
  body.castShadow = true
  group.add(body)
  const wingMaterial = new THREE.MeshStandardMaterial({ color: 0x354849, metalness: 0.3, roughness: 0.55 })
  const wing = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.22, 1.75), wingMaterial)
  wing.position.z = 0.1
  wing.castShadow = true
  group.add(wing)
  const tail = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.2, 1.1), wingMaterial)
  tail.position.z = 2.55
  group.add(tail)
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.4, 1.4), wingMaterial)
  fin.position.set(0, 0.65, 2.4)
  group.add(fin)
  for (const side of [-1, 1]) {
    const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.65, 2.1, 8), wingMaterial)
    engine.rotation.x = Math.PI / 2
    engine.position.set(side * 2.5, -0.18, 0.2)
    group.add(engine)
  }
  group.userData.body = body
  return group
}

function currentDrone(): DroneSpec { return DRONES[save.selected] }
function format(value: number) { return Math.floor(value).toLocaleString('en-US') }

function setAlert(message: string) {
  const node = $('#alert')
  node.textContent = message
  node.classList.add('show')
  alertTimer = 2.4
}

function toast(message: string, tone: 'normal' | 'gold' = 'normal') {
  const div = document.createElement('div')
  div.className = `toast ${tone}`
  div.textContent = message
  $('#toast-stack').append(div)
  setTimeout(() => div.remove(), 3600)
}

function sound(frequency: number, duration: number, type: OscillatorType = 'sine', volume = 0.13) {
  if (save.muted) return
  try {
    audioContext ??= new AudioContext()
    const osc = audioContext.createOscillator()
    const gain = audioContext.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(frequency, audioContext.currentTime)
    osc.frequency.exponentialRampToValueAtTime(Math.max(35, frequency * 0.38), audioContext.currentTime + duration)
    gain.gain.setValueAtTime(volume, audioContext.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration)
    osc.connect(gain).connect(audioContext.destination)
    osc.start()
    osc.stop(audioContext.currentTime + duration)
  } catch { /* Audio is optional. */ }
}

function renderHangar() {
  $('#menu-score').textContent = format(save.score)
  $('#menu-rebirths').textContent = String(save.rebirths)
  $('#hangar-progress').textContent = `${String(unlockedTier(save.score) + 1).padStart(2, '0')} / 08`
  const list = $('#drone-list')
  list.innerHTML = DRONES.map((spec, index) => {
    const unlocked = index <= unlockedTier(save.score)
    return `<button class="drone-row ${save.selected === index ? 'selected' : ''} ${unlocked ? '' : 'locked'}" data-tier="${index}" ${unlocked ? '' : 'disabled'}><span class="drone-num">${String(index + 1).padStart(2, '0')}</span><span class="drone-info"><strong>${spec.name}</strong><small>${spec.description}</small></span><span class="drone-tag">${unlocked ? (save.selected === index ? 'ACTIVE' : 'SELECT') : `${format(spec.threshold)} PTS`}</span></button>`
  }).join('')
  list.querySelectorAll<HTMLButtonElement>('.drone-row').forEach(button => button.onclick = () => {
    save.selected = Number(button.dataset.tier)
    saveGame(save)
    renderHangar()
    toast(`${currentDrone().name.toUpperCase()} SELECTED`)
  })
  const button = $('#rebirth-button') as HTMLButtonElement
  button.disabled = !canRebirth(save)
  button.textContent = canRebirth(save) ? 'REBIRTH NOW ↗' : `REBIRTH AT ${format(REBIRTH_THRESHOLD)}`
}

function launch() {
  $('#menu').classList.add('hidden')
  $('#hud').classList.remove('hidden')
  $('#controls-modal').classList.add('hidden')
  active = true
  spawn()
  sound(450, 0.35, 'sawtooth', 0.05)
  setAlert(`DEPLOYED · ${currentDrone().name.toUpperCase()}`)
}

function pause() {
  active = false
  firing = false
  keys.clear()
  $('#menu').classList.remove('hidden')
  $('#hud').classList.add('hidden')
  renderHangar()
}

function spawn() {
  const spec = currentDrone()
  position.set((Math.random() - 0.5) * 5, 75, 510)
  velocity.set(0, 0, -spec.speed * 0.7)
  yaw = 0
  pitch = -0.06
  bank = 0
  mouseX = 0
  mouseY = 0
  $('#steer-cue').style.left = '50%'
  $('#steer-cue').style.top = '50%'
  throttle = 1
  hp = spec.health
  alive = true
  respawnTimer = 0
  drone.visible = cameraMode === 'chase'
  drone.scale.setScalar(spec.size)
  drone.position.copy(position)
  drone.quaternion.copy(flightOrientation({ yaw, pitch, bank }))
  const body = drone.userData.body as THREE.Mesh
  ;(body.material as THREE.MeshStandardMaterial).color.setHex(spec.color)
  $('#respawn').classList.add('hidden')
}

function forward() { return flightForward(yaw, pitch) }

function destroyDrone(reason: string, impact = false) {
  if (!alive) return
  alive = false
  respawnTimer = 2.6
  drone.visible = false
  $('#respawn-reason').textContent = reason
  $('#respawn').classList.remove('hidden')
  explode(position, impact ? 19 : 11, impact ? 0xffc18b : 0xe97457)
  sound(90, 0.48, 'sawtooth', 0.22)
}

function damageTarget(target: Target, amount: number) {
  if (target.health <= 0) return
  const result = damagePayout(target.points, target.maxHealth, target.health, amount, save.rebirths)
  target.health = result.health
  const actual = result.actualDamage
  const gained = result.pointsEarned
  const previousTier = unlockedTier(save.score)
  save.score += gained
  saveGame(save)
  setTargetDamageVisual(target)
  if (actual >= 8) {
    setAlert(`${target.name.toUpperCase()} · +${Math.round(gained)} PTS`)
    if (actual > 30) sound(180, 0.17, 'triangle', 0.07)
  }
  if (target.health === 0) {
    target.destroyedAt = elapsed
    explode(target.position, Math.min(22, 8 + target.points / 80), 0xf3ad72)
    toast(`${target.name.toUpperCase()} DESTROYED · +${Math.round(gained)} PTS`)
  }
  const nextTier = unlockedTier(save.score)
  if (nextTier > previousTier) toast(`${DRONES[nextTier].name.toUpperCase()} UNLOCKED`, 'gold')
  if (save.score >= REBIRTH_THRESHOLD && save.score - gained < REBIRTH_THRESHOLD) toast('REBIRTH AVAILABLE IN HANGAR', 'gold')
}

function blast(center: THREE.Vector3, radius: number, damage: number) {
  for (const target of targets) {
    if (target.health <= 0) continue
    const nearest = target.box.clampPoint(center, temp)
    const distance = nearest.distanceTo(center)
    if (distance <= radius) damageTarget(target, damage * Math.max(0.2, 1 - distance / radius * 0.7))
  }
}

function explode(center: THREE.Vector3, radius: number, color: number) {
  for (let i = 0; i < 16; i++) {
    const mesh = new THREE.Mesh(blastGeometry, new THREE.MeshBasicMaterial({ color: i % 4 === 0 ? 0xffeead : color, transparent: true, opacity: 0.85 }))
    mesh.position.copy(center)
    mesh.scale.setScalar(0.6 + Math.random() * 1.8)
    scene.add(mesh)
    const velocity = new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.2) * 1.4, (Math.random() - 0.5) * 2).normalize().multiplyScalar(8 + Math.random() * radius * 1.5)
    particles.push({ mesh, velocity, life: 0.6 + Math.random() * 0.65, maxLife: 1.2 })
  }
  const flash = new THREE.PointLight(color, 9, radius * 4)
  flash.position.copy(center)
  scene.add(flash)
  setTimeout(() => scene.remove(flash), 120)
}

function fireGun() {
  if (save.rebirths < 2 || !alive || gunCooldown > 0) return
  gunCooldown = 0.16
  const direction = forward()
  const muzzle = position.clone().addScaledVector(direction, 4)
  raycaster.set(muzzle, direction)
  let closest: Target | null = null
  let best = 270
  for (const target of targets) {
    if (target.health <= 0) continue
    const hit = raycaster.intersectBox(target.box, new THREE.Vector3())
    if (hit && hit.distanceTo(muzzle) < best) { closest = target; best = hit.distanceTo(muzzle) }
  }
  const end = muzzle.clone().addScaledVector(direction, closest ? best : 220)
  const geometry = new THREE.BufferGeometry().setFromPoints([muzzle, end])
  const tracer = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xfad687, transparent: true, opacity: 0.88 }))
  scene.add(tracer)
  setTimeout(() => { scene.remove(tracer); geometry.dispose(); (tracer.material as THREE.Material).dispose() }, 80)
  if (closest) damageTarget(closest, 18)
  sound(460, 0.07, 'square', 0.035)
}

function dropBomb() {
  if (save.rebirths < 1 || !alive || bombCooldown > 0) return
  bombCooldown = 1.8
  const group = new THREE.Group()
  const casing = new THREE.Mesh(new THREE.CapsuleGeometry(0.75, 2.7, 4, 8), new THREE.MeshStandardMaterial({ color: 0x3f4e50, metalness: 0.45 }))
  casing.rotation.x = Math.PI / 2
  group.add(casing)
  group.position.copy(position).add(new THREE.Vector3(0, -2, 0))
  scene.add(group)
  bombs.push({ mesh: group, velocity: velocity.clone().multiplyScalar(0.7).add(new THREE.Vector3(0, -5, 0)), life: 8 })
  sound(280, 0.22, 'triangle', 0.055)
  setAlert('BOMB AWAY')
}

function updateFlight(dt: number) {
  const spec = currentDrone()
  if (keys.has('KeyW')) throttle = clamp(throttle + dt * 0.35, 0.25, 1)
  if (keys.has('KeyS')) throttle = clamp(throttle - dt * 0.35, 0.25, 1)
  let manualPitch = (keys.has('KeyR') ? 1 : 0) - (keys.has('KeyF') ? 1 : 0)
  let manualYaw = (keys.has('KeyE') ? 1 : 0) - (keys.has('KeyQ') ? 1 : 0)
  let manualBank = (keys.has('KeyD') ? 1 : 0) - (keys.has('KeyA') ? 1 : 0)
  let aimX = mouseX
  let aimY = mouseY
  const outward = position.x * velocity.x + position.z * velocity.z > 0
  if (outward && Math.max(Math.abs(position.x), Math.abs(position.z)) > WORLD_HALF_SIZE - 250) {
    const homeHeading = Math.atan2(-position.x, position.z)
    const error = Math.atan2(Math.sin(homeHeading - yaw), Math.cos(homeHeading - yaw))
    aimX = clamp(error * 1.8, -1.25, 1.25)
    manualYaw = manualBank = 0
    setAlert('RETURN TO OPERATION AREA')
  }
  if (position.y > 450) { aimY = Math.max(aimY, 0.55); manualPitch = 0; setAlert('ALTITUDE LIMIT · DESCEND') }
  const next = stepFlight({ yaw, pitch, bank, speed: velocity.length() }, {
    aimX, aimY, pitch: manualPitch, yaw: manualYaw, bank: manualBank, throttle,
  }, spec, dt)
  yaw = next.yaw
  pitch = next.pitch
  bank = next.bank
  // Smooth acceleration, but never delay the direction independently of the airframe.
  velocity.copy(flightVelocity(next))
  const previousPosition = position.clone()
  position.addScaledVector(velocity, dt)
  drone.position.copy(position)
  drone.quaternion.copy(flightOrientation(next))

  const radius = Math.max(2.1, spec.size * 2.2)
  const segmentLength = position.distanceTo(previousPosition)
  const groundDistance = position.y <= 2 ? segmentLength * clamp((previousPosition.y - 2) / (previousPosition.y - position.y), 0, 1) : Infinity
  const collisionRay = new THREE.Ray(previousPosition, forward())
  let hitTarget: Target | null = null
  let hitDistance = Math.min(segmentLength + 0.001, groundDistance)
  for (const target of targets) {
    if (target.health <= 0) continue
    const expanded = target.box.clone().expandByScalar(radius)
    const hit = expanded.containsPoint(previousPosition) ? previousPosition : collisionRay.intersectBox(expanded, new THREE.Vector3())
    if (hit && previousPosition.distanceTo(hit) <= hitDistance) {
      hitDistance = previousPosition.distanceTo(hit)
      hitTarget = target
    }
  }
  if (hitTarget) {
    position.copy(previousPosition).addScaledVector(forward(), hitDistance)
    blast(position, spec.blast, spec.damage)
    destroyDrone(`IMPACT · ${hitTarget.name.toUpperCase()}`, true)
    return
  }
  if (position.y <= 2) {
    position.copy(previousPosition).addScaledVector(forward(), groundDistance)
    position.y = 2
    blast(position, spec.blast, spec.damage)
    destroyDrone('GROUND IMPACT', true)
    return
  }
  if (firing) fireGun()
}

function updateWeapons(dt: number) {
  gunCooldown = Math.max(0, gunCooldown - dt)
  bombCooldown = Math.max(0, bombCooldown - dt)
  for (let i = bombs.length - 1; i >= 0; i--) {
    const bomb = bombs[i]
    bomb.life -= dt
    bomb.velocity.y -= 25 * dt
    bomb.mesh.position.addScaledVector(bomb.velocity, dt)
    bomb.mesh.rotation.x += dt * 2
    const hit = bomb.mesh.position.y <= 1 || targets.some(target => target.health > 0 && target.box.containsPoint(bomb.mesh.position))
    if (hit || bomb.life <= 0) {
      blast(bomb.mesh.position, 19, 350)
      explode(bomb.mesh.position, 18, 0xffc072)
      sound(95, 0.45, 'sawtooth', 0.18)
      scene.remove(bomb.mesh)
      bombs.splice(i, 1)
    }
  }
}

function updateTurrets(dt: number) {
  for (const target of targets) {
    if (!target.turret || target.health <= 0 || !alive) continue
    const turret = target.turret
    const origin = target.position.clone().add(new THREE.Vector3(0, 6, 0))
    const distance = origin.distanceTo(position)
    if (distance > turret.range) continue
    const direction = position.clone().sub(origin).normalize()
    turret.head.rotation.y = Math.atan2(-direction.x, -direction.z)
    turret.cooldown -= dt
    if (turret.cooldown <= 0) {
      turret.cooldown = 1.9 + turret.phase * 0.1
      const mesh = new THREE.Mesh(projectileGeometry, new THREE.MeshBasicMaterial({ color: 0xffa05e }))
      mesh.position.copy(origin).addScaledVector(direction, 5)
      scene.add(mesh)
      projectiles.push({ mesh, velocity: direction.multiplyScalar(74), life: 4.2, damage: 15 })
      sound(210, 0.1, 'square', 0.022)
    }
  }
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const shot = projectiles[i]
    shot.life -= dt
    shot.mesh.position.addScaledVector(shot.velocity, dt)
    if (alive && shot.mesh.position.distanceTo(position) < 3.1) {
      hp -= shot.damage
      explode(shot.mesh.position, 4, 0xf5ad6d)
      setAlert(`UNDER FIRE · INTEGRITY ${Math.max(0, Math.ceil(hp / currentDrone().health * 100))}%`)
      if (hp <= 0) destroyDrone('SHOT DOWN BY AIR DEFENSE')
      shot.life = 0
    }
    if (shot.life <= 0) { scene.remove(shot.mesh); projectiles.splice(i, 1) }
  }
}

function updateTargets() {
  for (const target of targets) if (target.health <= 0 && elapsed - target.destroyedAt >= target.respawn) {
    target.health = target.maxHealth
    target.destroyedAt = -1
    if (target.turret) target.turret.cooldown = 2
    setTargetDamageVisual(target)
  }
}

function updateParticles(dt: number) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i]
    particle.life -= dt
    particle.mesh.position.addScaledVector(particle.velocity, dt)
    particle.velocity.y -= dt * 12
    const material = particle.mesh.material as THREE.MeshBasicMaterial
    material.opacity = Math.max(0, particle.life / particle.maxLife)
    particle.mesh.scale.multiplyScalar(1 + dt * 0.55)
    if (particle.life <= 0) { scene.remove(particle.mesh); material.dispose(); particles.splice(i, 1) }
  }
}

function updateCamera(dt: number) {
  const direction = forward()
  const desired = cameraMode === 'fpv'
    ? position.clone().addScaledVector(direction, 2.6).add(new THREE.Vector3(0, 0.42, 0))
    : position.clone().addScaledVector(direction, -18).add(new THREE.Vector3(0, 6, 0))
  camera.position.copy(desired)
  camera.up.set(0, 1, 0)
  if (cameraMode === 'fpv') camera.up.applyQuaternion(drone.quaternion)
  camera.lookAt(position.clone().addScaledVector(direction, 45))
  camera.fov = lerp(camera.fov, 72 + throttle * 9, Math.min(1, dt * 2))
  camera.updateProjectionMatrix()
  drone.visible = alive && cameraMode === 'chase'
}

function drawMap() {
  const w = canvas2d.width, h = canvas2d.height
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = '#142726'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = 'rgba(188,211,190,.12)'
  for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(i * w / 5, 0); ctx.lineTo(i * w / 5, h); ctx.moveTo(0, i * h / 5); ctx.lineTo(w, i * h / 5); ctx.stroke() }
  const mapSize = WORLD_HALF_SIZE * 2
  ctx.fillStyle = '#426868'; ctx.fillRect(w * (74 / mapSize + 0.5) - 1, 0, 2, h)
  for (const target of targets) {
    if (target.health <= 0) continue
    ctx.fillStyle = target.kind === 'turret' ? '#ed7758' : target.points >= 700 ? '#d6ab71' : '#7faaa0'
    const x = (target.position.x / mapSize + 0.5) * w
    const y = (target.position.z / mapSize + 0.5) * h
    ctx.fillRect(x - 1.5, y - 1.5, 3, 3)
  }
  const x = (position.x / mapSize + 0.5) * w
  const y = (position.z / mapSize + 0.5) * h
  ctx.save(); ctx.translate(x, y); ctx.rotate(yaw); ctx.fillStyle = '#fff2c4'; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill(); ctx.restore()
}

function updateHud() {
  const spec = currentDrone()
  $('#hud-drone').textContent = spec.name.toUpperCase()
  $('#hud-designation').textContent = spec.designation
  $('#hud-hp').textContent = `${Math.max(0, Math.ceil(hp / spec.health * 100))}%`;
  ($('#hp-fill') as HTMLElement).style.width = `${clamp(hp / spec.health, 0, 1) * 100}%`
  $('#hud-throttle').textContent = `${Math.round(throttle * 100)}%`;
  ($('#throttle-fill') as HTMLElement).style.width = `${throttle * 100}%`
  $('#hud-speed').textContent = String(Math.round(velocity.length() * 3.6)).padStart(3, '0')
  $('#hud-alt').textContent = String(Math.max(0, Math.round(position.y))).padStart(3, '0')
  $('#hud-score').textContent = format(save.score)
  const next = DRONES.find(spec => spec.threshold > save.score)
  $('#hud-next').textContent = next ? `NEXT ${next.name.toUpperCase()} · ${format(next.threshold - save.score)} TO GO` : 'ALL AIRFRAMES UNLOCKED'
  $('#hud-rebirth').textContent = canRebirth(save) ? 'REBIRTH READY · ESC' : `REBIRTH · ${format(REBIRTH_THRESHOLD - save.score)} TO GO`
  $('#weapon-hint').innerHTML = `<b>V</b> ${cameraMode.toUpperCase()}${save.rebirths >= 1 ? ` <b>SPACE</b> BOMB ${bombCooldown > 0 ? Math.ceil(bombCooldown) + 'S' : 'READY'}` : ''}${save.rebirths >= 2 ? ' <b>CLICK</b> GUN' : ''} <b>M</b> ${save.muted ? 'SOUND OFF' : 'SOUND ON'}`
  raycaster.set(position, forward())
  let nearest: Target | undefined
  let distance = 1000
  for (const target of targets) {
    if (target.health <= 0) continue
    const hit = raycaster.intersectBox(target.box, new THREE.Vector3())
    if (hit && hit.distanceTo(position) < distance) { nearest = target; distance = hit.distanceTo(position) }
  }
  $('#target-readout').textContent = nearest ? `${nearest.name.toUpperCase()}  ·  ${Math.round(distance)} M  ·  ${Math.ceil(nearest.health / nearest.maxHealth * 100)}%` : 'NO TARGET'
  drawMap()
}

function frame(now: number) {
  requestAnimationFrame(frame)
  const dt = Math.min(0.05, (now - lastFrame) / 1000)
  lastFrame = now
  if (active) {
    elapsed += dt
    if (alive) updateFlight(dt)
    else if (respawnTimer > 0) { respawnTimer -= dt; if (respawnTimer <= 0) { spawn(); setAlert('AIRFRAME DEPLOYED') } }
    updateWeapons(dt)
    updateTurrets(dt)
    updateTargets()
    updateParticles(dt)
    updateCamera(dt)
    if (alertTimer > 0) { alertTimer -= dt; if (alertTimer <= 0) $('#alert').classList.remove('show') }
    if (elapsed - lastHudUpdate > 0.12) { updateHud(); lastHudUpdate = elapsed }
  } else {
    const t = now * 0.0001
    camera.position.set(Math.sin(t) * 160, 145, 360 + Math.cos(t) * 80)
    camera.lookAt(0, 0, -100)
    drone.visible = false
  }
  const focusX = active ? position.x : 0
  const focusZ = active ? position.z : 0
  if ((focusX - shadowAnchor.x) ** 2 + (focusZ - shadowAnchor.z) ** 2 > 10000) {
    shadowAnchor.set(focusX, 0, focusZ)
    sunlight.target.position.copy(shadowAnchor)
    sunlight.position.set(focusX - 260, 420, focusZ + 110)
  }
  renderer.render(scene, camera)
}

$('#launch-button').addEventListener('click', launch)
$('#pause-button').addEventListener('click', pause)
$('#controls-button').addEventListener('click', () => $('#controls-modal').classList.remove('hidden'))
$('#close-controls').addEventListener('click', () => $('#controls-modal').classList.add('hidden'))
$('#controls-done').addEventListener('click', () => $('#controls-modal').classList.add('hidden'))
$('#reset-save').addEventListener('click', () => {
  askConfirm('Reset progress?', 'This clears all points, airframes, and rebirths saved in this browser.', () => {
    const muted = save.muted
    save = { ...freshSave(), muted }
    saveGame(save)
    renderHangar()
    $('#controls-modal').classList.add('hidden')
    toast('PROGRESS RESET')
  })
})
$('#confirm-cancel').addEventListener('click', () => { confirmHandler = null; $('#confirm-modal').classList.add('hidden') })
$('#confirm-accept').addEventListener('click', () => {
  const action = confirmHandler
  confirmHandler = null
  $('#confirm-modal').classList.add('hidden')
  action?.()
})
$('#rebirth-button').addEventListener('click', () => {
  if (!canRebirth(save)) return
  askConfirm('Rebirth now?', 'Current points and drone tiers reset. Permanent weapons and rebirth bonuses stay unlocked.', () => {
    save = rebirth(save)
    saveGame(save)
    renderHangar()
    toast(save.rebirths === 1 ? 'BOMBS UNLOCKED' : save.rebirths === 2 ? 'GUN UNLOCKED' : 'SCORE BONUS INCREASED', 'gold')
    sound(590, 0.5, 'sine', 0.15)
  })
})
window.addEventListener('keydown', event => {
  if (['Space', 'ArrowUp', 'ArrowDown'].includes(event.code)) event.preventDefault()
  if (event.repeat) return
  keys.add(event.code)
  if (event.code === 'Escape') {
    if (!$('#confirm-modal').classList.contains('hidden')) { confirmHandler = null; $('#confirm-modal').classList.add('hidden') }
    else if (!$('#controls-modal').classList.contains('hidden')) $('#controls-modal').classList.add('hidden')
    else if (active) pause()
  }
  if (!active) return
  if (event.code === 'KeyV') { cameraMode = cameraMode === 'fpv' ? 'chase' : 'fpv'; setAlert(`${cameraMode.toUpperCase()} CAMERA`) }
  if (event.code === 'KeyM') { save.muted = !save.muted; saveGame(save); setAlert(save.muted ? 'SOUND OFF' : 'SOUND ON') }
  if (event.code === 'Space') dropBomb()
})
window.addEventListener('keyup', event => keys.delete(event.code))
window.addEventListener('blur', () => { keys.clear(); firing = false })
window.addEventListener('mousemove', event => {
  if (!active) return
  mouseX = clamp((event.clientX / window.innerWidth - 0.5) * 2, -1, 1)
  mouseY = clamp((event.clientY / window.innerHeight - 0.5) * 2, -1, 1)
  const steerCue = $('#steer-cue')
  steerCue.style.left = `${event.clientX}px`
  steerCue.style.top = `${event.clientY}px`
})
window.addEventListener('mousedown', event => { if (event.button === 0 && active) firing = true })
window.addEventListener('mouseup', event => { if (event.button === 0) firing = false })
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

renderHangar()
requestAnimationFrame(frame)
