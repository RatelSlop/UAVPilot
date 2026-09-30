export type DroneSpec = {
  name: string
  designation: string
  threshold: number
  speed: number
  health: number
  damage: number
  blast: number
  turn: number
  size: number
  color: number
  description: string
}

export const DRONES: DroneSpec[] = [
  { name: 'Sparrow', designation: 'D-01', threshold: 0, speed: 68, health: 48, damage: 180, blast: 11, turn: 1.35, size: 1, color: 0xc4dcc5, description: 'Light and agile. The first step into the sky.' },
  { name: 'Kestrel', designation: 'D-02', threshold: 1000, speed: 78, health: 58, damage: 245, blast: 12, turn: 1.48, size: 1.03, color: 0xe3c78c, description: 'Sharper turns and a harder strike.' },
  { name: 'Osprey', designation: 'D-03', threshold: 2500, speed: 84, health: 74, damage: 330, blast: 13, turn: 1.34, size: 1.12, color: 0xa8bbc1, description: 'Balanced speed and survivability.' },
  { name: 'Harrier', designation: 'D-04', threshold: 5000, speed: 96, health: 65, damage: 390, blast: 14, turn: 1.55, size: 1.08, color: 0xd9a88b, description: 'A fast attack craft built for narrow approaches.' },
  { name: 'Raven', designation: 'D-05', threshold: 9000, speed: 94, health: 102, damage: 510, blast: 16, turn: 1.25, size: 1.28, color: 0x939ba2, description: 'Armored fuselage and a wide blast radius.' },
  { name: 'Valkyrie', designation: 'D-06', threshold: 15000, speed: 108, health: 98, damage: 620, blast: 17, turn: 1.4, size: 1.3, color: 0xc8a696, description: 'High speed, high impact, precise handling.' },
  { name: 'Wraith', designation: 'D-07', threshold: 23000, speed: 116, health: 112, damage: 760, blast: 19, turn: 1.55, size: 1.24, color: 0xa6a4ba, description: 'An elite craft for defended targets.' },
  { name: 'Atlas', designation: 'D-08', threshold: 34000, speed: 106, health: 170, damage: 1000, blast: 23, turn: 1.13, size: 1.6, color: 0xdcc99a, description: 'Heavy airframe. Unmatched destructive force.' },
]

export const REBIRTH_THRESHOLD = 37000
export const SAVE_KEY = 'uavpilot-save-v1'
export const WORLD_HALF_SIZE = 620

export type TargetKind = 'house' | 'farm' | 'factory' | 'power' | 'fuel' | 'freight' | 'rail' | 'comms' | 'airfield' | 'base' | 'turret'

export const TARGET_STYLE: Record<TargetKind, { health: number; points: number; respawn: number; label: string }> = {
  house: { health: 165, points: 150, respawn: 65, label: 'Residence' },
  farm: { health: 180, points: 175, respawn: 70, label: 'Farm structure' },
  factory: { health: 400, points: 420, respawn: 85, label: 'Factory' },
  power: { health: 800, points: 1200, respawn: 100, label: 'Power facility' },
  fuel: { health: 450, points: 650, respawn: 90, label: 'Fuel storage' },
  freight: { health: 350, points: 400, respawn: 80, label: 'Freight depot' },
  rail: { health: 420, points: 550, respawn: 85, label: 'Rail bridge' },
  comms: { health: 300, points: 500, respawn: 80, label: 'Communications tower' },
  airfield: { health: 580, points: 750, respawn: 100, label: 'Airfield hangar' },
  base: { health: 620, points: 900, respawn: 110, label: 'Military installation' },
  turret: { health: 260, points: 220, respawn: 90, label: 'AA turret' },
}
