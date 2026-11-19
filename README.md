# BURON

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/E1eng/buron/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/E1eng/buron/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Raka, a small-time wheelman, comes back to Tanjung — a dusk-lit port city — and takes one last string of jobs from Mama Rosa, the noodle-bar fixer who raised him. Six jobs, rising heat, one ferry out.

## Controls

| Key | What it does |
| --- | --- |
| **WASD / arrow keys** | Move on foot or drive |
| **E** | Enter/exit a car or talk to someone |
| **F / mouse click** | Shoot once you're armed |
| **Shift** | Sprint |
| **M** | Mute/unmute the sound |
| **P** | Pause/resume |
| **Enter / Space** | Start or continue |

Got a save on the title screen? Hit **Enter/Space** to continue, or **N** to start fresh. You'll get a gun when a mission calls for one.

## What's in the game

- A **6-mission story**, from small errands to the last ferry.
- A **5-star wanted system** with police pursuits and a **BUSTED** meter when they catch up with you.
- **Car stealing**, plus traffic AI that keeps the streets moving.
- **Pedestrians** and on-foot gun combat.
- A handy **minimap** for tracking objectives and trouble.
- **localStorage save/continue**, so you can pick things up later in the same browser.
- **Synthesized WebAudio sound** for engines, sirens, gunfire, and more — no audio assets needed.
- A **procedurally generated city**, so Tanjung is built by the game rather than shipped as a map asset.

## Run it

No build step. No install dance.

Open **`game/index.html`** in a desktop browser and play. Any static file server works too; for example, run this from the repo root:

```sh
node serve.ts --port 8080
python3 -m http.server 8080
```

Then head to **http://localhost:8080/game/index.html**.

## License & credits

Released under the **MIT License** — see [LICENSE](LICENSE).

Made for the make.fun **'Make GTA 6'** competition (**gta6-01**).

---
<sub>Entered on [make.fun](https://make.fun/?ref=fp3srb0a&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
