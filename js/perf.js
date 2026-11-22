// Keeps the game smooth on slower devices by lowering the drawing resolution when frames run late.
// The setting only ever steps down, and is shared by all scenes until the page is reloaded.
let cap = 2;
let lite = false;

// Pixels drawn per CSS pixel. Sharp screens are capped at 2x; slow devices step down to 1.5x, then 1x.
export const renderScale = () => Math.min(window.devicePixelRatio || 1, cap);

// True once the device has shown it cannot keep up even at the lowest resolution.
export const isLite = () => lite;

// Returns tick(frameMs). Calls onChange after the resolution has been lowered so the scene can resize.
export function createMonitor(onChange) {
  let n = 0, sum = 0;
  return ms => {
    if (ms <= 0 || ms > 250) return; // ignore pauses and tab switches
    n++; sum += ms;
    if (n < 90) return;
    const avg = sum / n;
    n = 0; sum = 0;
    if (avg <= 21) return; // about 48 frames a second or better: leave things alone
    if (cap > 1 && (window.devicePixelRatio || 1) > 1) { cap = cap > 1.5 ? 1.5 : 1; onChange(); }
    else lite = true; // already at the lowest resolution: thin out the optional effects instead
  };
}
