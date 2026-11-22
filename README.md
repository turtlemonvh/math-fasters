# Math Fasters

A space arcade game for practising math facts. Runs in any browser on a tablet, phone or computer.

**Play:** https://turtlemonvh.github.io/math-fasters/

## Asteroid Blast

A multiplication fact shows on the console. Tap the asteroid carrying the right answer before it reaches the red line.

- Three shields. A wrong tap or a missed asteroid costs one. No shields left is game over.
- A mission is 3 waves of 10 facts. Each wave falls faster, and clearing one restores a shield.
- Faster answers and streaks score more.
- A missed fact is shown with its answer and comes back a few turns later.
- Keyboard: keys 1 to 4 pick an asteroid from left to right. Esc pauses.

## Pilots, missions and grown-up settings

Each kid gets a pilot with their own progress. The mission map has one mission per times table and a mixed finale. Finishing a mission unlocks the next and earns 1 to 3 stars.

On the mission map, tap the gear and enter the grown-up password (`faster`) to open settings for that pilot:

- which tables are in play (default 1 to 7, up to 12)
- speed (slow, medium, fast)
- which mission the pilot starts at (later ones still unlock by earning stars)
- a grid showing how the pilot is doing on every fact

Progress is saved in the browser on each device. Nothing is sent anywhere, and progress does not move between devices.

## Development

No build step and no dependencies.

```
npm start   # serves the game at http://localhost:8080
npm test    # runs the rule tests (Node 20+)
```

- `js/logic.js`: game rules (missions, fact picking, decoys, scoring). Pure functions, covered by `test/`.
- `js/play.js`: the Asteroid Blast canvas scene.
- `js/main.js`: screens and wiring. `js/store.js`: saved profiles. `js/audio.js`: synthesised sounds.
- `docs/plan/`: the original plan and mock-ups.

This is an original game. All art is drawn in code and all sounds are synthesised.
