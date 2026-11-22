// Profiles and progress live in this browser only (localStorage). Nothing is sent anywhere.
const KEY = 'mathfasters.v1';

const blank = () => ({ profiles: [], sound: true });

export function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.profiles)) return { ...blank(), ...d };
  } catch { /* storage blocked or corrupt: start fresh */ }
  return blank();
}

export function save(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* keep playing without saving */ }
}

export function newProfile(name, color) {
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    color,
    settings: { tables: [1, 2, 3, 4, 5, 6, 7], speed: 'medium', unlockAll: false },
    missions: {}, // mission id -> { stars, best, plays }
    facts: {},    // "6x7" -> { seen, right, streak, ms }
  };
}
