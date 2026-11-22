# Math Fasters

A space arcade game for practising math facts. Runs in any browser on a tablet, phone or computer.

**Play:** https://turtlemonvh.github.io/math-fasters/

## Three games, four kinds of facts

Pick a game on the mission map:

- **Asteroid Blast** (tap the answer): a fact shows on the console. Tap the asteroid carrying the right answer before it reaches the red line.
- **Fuel-Up** (type the answer): type the answer on the keypad before the comet lands. Ten answers fill the tank and the rocket lifts off to the next stage. The `?` key shows the answer and counts as a miss.

- **Cave Flight** (fly through the answer): slide a finger up or down to steer the ship through the gate showing the right answer.

All games share the same rules:

- Three shields. A wrong answer or running out of time costs one. No shields left is game over.
- A mission is 3 waves of 10 facts. Each wave is faster, and clearing one restores a shield.
- Faster answers and streaks score more.
- A missed fact is shown with its answer and comes back a few turns later.
- Keyboard: in Asteroid Blast keys 1 to 4 pick an asteroid from left to right; in Fuel-Up type digits; in Cave Flight use the up and down arrows. Esc pauses.

Facts can be multiplication, division, addition or subtraction. A grown-up chooses which kinds each pilot sees.

## Pilots, missions and grown-up settings

Each kid gets a pilot with their own progress. Each kind of fact has its own mission map: one mission per number (or pair of numbers) and a mixed finale. Finishing a mission unlocks the next and earns 1 to 3 stars. Free practice lets a pilot pick any numbers, with no stars.

On the mission map, tap the gear and enter the grown-up password (`faster`) to open settings for that pilot:

- kinds of facts: multiplication, division, addition, subtraction
- which times tables are in play for multiplication and division (default 1 to 7, up to 12); addition and subtraction use 1 to 10
- speed (slow, medium, fast)
- which mission the pilot starts at, per kind of fact (later ones still unlock by earning stars)
- a grid showing how the pilot is doing on every fact

The password only keeps kids out of settings; it is not real security. Progress is saved in the browser on each device. Nothing is sent anywhere, and progress does not move between devices.

## Development

No build step and no dependencies.

```
npm start   # serves the game at http://localhost:8080
npm test    # runs the rule tests (Node 20+)
```

- `js/logic.js`: game rules (missions, fact picking, decoys, scoring, the mission session). Pure functions, covered by `test/`.
- `js/play.js`: the Asteroid Blast canvas scene. `js/fuel.js`: the Fuel-Up scene. `js/cave.js`: the Cave Flight scene.
- `js/main.js`: screens and wiring. `js/store.js`: saved profiles. `js/audio.js`: synthesised sounds.
- `docs/plan/`: the original plan and mock-ups.

This is an original game. All art is drawn in code and all sounds are synthesised.
