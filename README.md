# UAVPilot

A single-player, browser-only 3D drone strike sandbox built with TypeScript, Vite, and Three.js.

## Play locally

Requires Node.js 20.19+ or 22.12+.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite. The game needs a desktop browser with WebGL 2. To check the production build:

```bash
npm test
npm run build
npm run preview
```

## Gameplay

The map contains neighborhoods, farms, factories, a power plant, fuel storage, a freight depot, rail bridges, communications towers, an airfield, and a military base. Turrets defend limited areas near critical sites. Structures take visible damage, award points for the health removed, and regenerate after a cooldown.

Eight drones unlock at 0, 1,000, 2,500, 5,000, 9,000, 15,000, 23,000, and 34,000 points. At 37,000 points you can rebirth from the hangar. Rebirth resets points and drone tiers, but permanently unlocks bombs on the first rebirth and a gun on the second. Later rebirths add a score multiplier, capped at 1.5×. Progress is saved to this browser's local storage.

To start over, open **Flight Controls** in the hangar and choose **Reset Saved Progress**.

| Control | Action |
| --- | --- |
| Mouse | Guide the drone's heading and pitch |
| W / S | Increase / decrease throttle |
| A / D | Bank |
| Q / E | Manual yaw |
| R / F | Manual pitch up / down |
| V | Switch FPV / chase camera |
| Space | Drop bomb, after first rebirth |
| Left click | Fire gun, after second rebirth |
| M | Mute / unmute |
| Esc | Return to hangar |

The fixed center reticle shows the drone's current line of travel and gun aim. The dashed circle shows the mouse steering cue. A direct impact detonates the drone and a replacement launches shortly after.

## Deployment when ready

No deployment runs automatically. The production output is `dist/` and Vite uses relative asset paths, so it can be served from a GitHub Pages repository subpath or from the root of a Cloudflare Worker.

- **GitHub Pages:** In repository Settings → Pages, select **GitHub Actions** as the build source. Then manually run the **Deploy GitHub Pages** workflow in Actions. This workflow tests and builds before publishing.
- **Cloudflare Workers Static Assets:** Run `npm run build`, sign in with Wrangler, then run `npx wrangler deploy`. `wrangler.jsonc` points Cloudflare to `dist/`. Deployment remains a deliberate manual step.

The regular CI workflow runs tests and a build on each push and pull request without publishing the game.

## Project layout

- `src/config.ts`: drone tiers, point values, respawn timing, and world size.
- `src/world.ts`: procedural low-poly map, target geometry, and damage appearance.
- `src/progression.ts`: scoring, saves, unlocks, and rebirth logic.
- `src/main.ts`: flight, cameras, combat, turret AI, HUD, and input.
- `src/style.css`: menu and HUD styling.

This is a game prototype. It contains fictional low-poly assets created in code, with no assets copied from the reference game.
