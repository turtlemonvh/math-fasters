# Math Fasters

A space arcade game for practising math facts. Runs in any browser on a tablet, phone or computer.

**Play:** https://turtlemonvh.github.io/math-fasters/

## Three games, four kinds of facts

Pick a game on the mission map:

- **Asteroid Blast** (tap the answer): a fact shows on the console. Tap the asteroid carrying the right answer before it reaches the red line.
- **Fuel-Up** (type the answer): type the answer on the keypad before the comet lands. Ten answers fill the tank and the rocket lifts off to the next stage. The `?` key shows the answer and counts as a miss.

- **Cave Flight** (fly through the answer): touch the left side to pick a lane, then tap the right side to boost through the gate showing the right answer. Boosting sooner scores more.

All games share the same rules:

- Three shields. A wrong answer or running out of time costs one. No shields left is game over.
- A mission is 3 waves of 10 facts. Each wave is faster, and clearing one restores a shield.
- Faster answers and streaks score more.
- Speed bonus: three quick answers in a row earn a gold bonus question. Answer it quickly too and it counts as two, so a fast pilot can clear a wave of 10 in 8 questions. After the first bonus only two quick answers are needed for the next; a miss resets that to three.
- A missed fact is shown with its answer and comes back a few turns later.
- Keyboard: in Asteroid Blast keys 1 to 4 pick an asteroid from left to right; in Fuel-Up type digits; in Cave Flight use the up and down arrows and Space to boost. Esc pauses.

Facts can be multiplication, division, addition or subtraction. A grown-up chooses which kinds each pilot sees.

## Pilots, missions and grown-up settings

Each kid gets a pilot with their own progress. Each kind of fact has its own mission map: one mission per number (or pair of numbers) and a mixed finale. Finishing a mission unlocks the next and earns 1 to 3 stars. Free practice lets a pilot pick any numbers, with no stars.

On the mission map, hold the gear for 2 seconds to open the grown-up screen for that pilot. It has three tabs.

**Settings**

- kinds of facts: multiplication, division, addition, subtraction
- which times tables are in play for multiplication and division (default 1 to 7, up to 12); addition and subtraction use 1 to 10
- speed (slow, medium, fast)
- which mission the pilot starts at, per kind of fact (later ones still unlock by earning stars)
- look: Tock the robot co-pilot and rocky asteroids (on to start; turn off for the plain look on older tablets)
- extra effects, each off to start: rich sounds, streak flames, chunky explosions, star-chart mission map
- erase progress or delete the pilot, after typing the pilot's name

**Progress**: a grid of every fact, coloured by how well the pilot knows it. View it for a day, a week or all time and page back through earlier days and weeks. Day-by-day history starts from the day this feature first ran on the device.

**Mission log**: every mission played, with score, facts missed and time taken. Copy a text summary or download a CSV spreadsheet.

Progress is saved in the browser on each device. Nothing is sent anywhere, and progress does not move between devices.

## Development

No build step and no dependencies.

```
npm start   # serves the game at http://localhost:8080
npm test    # runs the rule tests (Node 20+)
```

- `js/logic.js`: game rules (missions, fact picking, decoys, scoring, the mission session). Pure functions, covered by `test/`.
- `js/play.js`: the Asteroid Blast canvas scene. `js/fuel.js`: the Fuel-Up scene. `js/cave.js`: the Cave Flight scene.
- `js/fx.js`: optional looks and effects (robot, rocky asteroids, flames, chunks, star chart).
- `js/main.js`: screens and wiring. `js/store.js`: saved profiles. `js/audio.js`: synthesised sounds.
- `docs/plan/`: the original plan and mock-ups.

This is an original game. All art is drawn in code and all sounds are synthesised.
