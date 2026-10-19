// Player names (entered on the home screen), remembered on this device.
const KEY = "open-heart:players:v1";

export function readPlayers() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(p) && p.length === 2) return p.map((n) => String(n ?? ""));
  } catch {
    /* storage unavailable - fine */
  }
  return ["", ""];
}

export function savePlayers(players) {
  try {
    localStorage.setItem(KEY, JSON.stringify(players));
  } catch {
    /* storage unavailable - fine */
  }
}

/** Whose turn a card is, as a short line ("ילתא, תורך לענות" / "שניכם עונים"), or null without names. */
export function turnLabel(card, players) {
  const names = players.map((n) => n.trim());
  if (card.player == null || !names[0] || !names[1]) return null;
  const power = card.kind === "power" && card.type === "power";
  if (card.player === "both") return power ? "קלף לשניכם" : "שניכם עונים";
  if (isGuess(card)) return `${names[1 - card.player]} מנחש/ת, ${names[card.player]} עונה`;
  return `${names[card.player]}, ${power ? "הקלף הזה שלך" : "תורך לענות"}`;
}

/** "מה יענה?" card, or a question turned into a guess by the guess power card. */
export const isGuess = (card) => card.type === "guess" || !!card.guess;
