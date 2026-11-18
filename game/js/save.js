// localStorage save: cash, story progress, collected cash bags and where Rico stands.
// Everything is guarded — a browser that refuses storage just loses the Continue button.

const KEY = 'sunfall-city-save-v1';

export function saveGame(G) {
  try {
    const data = {
      cash: G.player.cash,
      storyIndex: G.story.index,
      storyDone: G.story.done,
      bags: G.bags.map((b) => (b.taken ? 1 : 0)),
      x: Math.round(G.player.x),
      y: Math.round(G.player.y),
      missionsDone: G.stats.missionsDone,
      errandsDone: G.stats.errandsDone,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null || typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadSave() !== null;
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable: nothing to clear */
  }
}
