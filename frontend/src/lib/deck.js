const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

/** Which power cards a mini-game deals ("power" field of a game in questions.json). */
const POWER_FILTERS = {
  all: () => true,
  none: () => false,
  guess: (p) => p.type === "guess",
  challenge: (p) => p.type === "challenge",
  both: (p) => p.turn === "both" && !p.nextTurn,
};

/** Fallback when content has no "games" (old cached JSON): the classic mixed game. */
export const CLASSIC = { id: "classic", power: "all" };
/** Text of one of a game's own cards: a "זה או זה" pair [a, b], or a "נושאי שיחה" topic [title, prompt]. */
export const gameCardText = (game, [a, b]) => (game.format === "topic" ? `${a}: ${b}` : `${a} או ${b}?`);

export const gameOf = (content, id) => content.games?.find((g) => g.id === id) ?? content.games?.[0] ?? CLASSIC;

/**
 * Build a play deck for a mini-game. Questions come from every category, shuffled together, unless
 * the game has its own `questions` (the game itself stands in for the category): "זה או זה" pairs [a, b]
 * (card.options), or, with `format: "topic"`, "נושאי שיחה" topics [title, prompt] (card.topic).
 * - `limit` caps the number of questions; `power` picks which power cards are dealt (POWER_FILTERS),
 *   one every minGap..maxGap questions (never two in a row, never as the last card).
 * - `turn` "both": everyone answers every question; "guess": every question is a "מה יענה?" guess.
 * - `seconds`: each question gets its own countdown (card.seconds).
 * Cards the couple already checked off (`answered`: Set of answerKey) are left out.
 * answerKey: "<categoryId>-<index>" (or "<gameId>-<index>") for questions, "pc-<id>" for "מה יענה?" cards, null otherwise.
 */
export function buildDeck(content, game = CLASSIC, answered = new Set()) {
  const { categories, meta } = content;
  const powerCards = content.powerCards
    .filter(POWER_FILTERS[game.power ?? "all"] ?? POWER_FILTERS.all)
    .map((p) => ({ ...p, answerKey: p.type === "guess" ? `pc-${p.id}` : null }))
    .filter((p) => !answered.has(p.answerKey));
  const minGap = meta?.powerCardMinGap ?? 3;
  const maxGap = Math.max(minGap, meta?.powerCardMaxGap ?? 5);

  const questionsOf = (c) =>
    c.questions
      .map((text, i) => ({ kind: "question", key: `${c.id}-${i}`, answerKey: `${c.id}-${i}`, text, category: c, seconds: game.seconds }))
      .filter((q) => !answered.has(q.answerKey));
  let questions = shuffle(
    game.questions
      ? questionsOf({ ...game, questions: game.questions.map((pair) => gameCardText(game, pair)) }).map((q) => ({
          ...q,
          [game.format === "topic" ? "topic" : "options"]: game.questions[q.key.slice(game.id.length + 1)],
        }))
      : categories.flatMap(questionsOf)
  );
  if (game.limit) questions = questions.slice(0, game.limit);

  let powers = shuffle(powerCards);
  const deck = [];
  let untilPower = randInt(minGap, maxGap);
  questions.forEach((q, i) => {
    deck.push(q);
    untilPower--;
    // Skip a power card right at the end of the deck.
    if (untilPower === 0 && i < questions.length - 1 && powerCards.length) {
      if (!powers.length) powers = shuffle(powerCards);
      deck.push({ kind: "power", key: `power-${deck.length}`, ...powers.pop() });
      untilPower = randInt(minGap, maxGap);
    }
  });

  // Turns: single cards alternate between the two players (random starter); "both" cards, and the
  // question right after a card with nextTurn "both" (mirror, choice), are answered by both.
  // Guessing ("מה יענה?" cards, and the question after nextTurn "guess"): card.player answers,
  // the other player guesses the answer first.
  let player = randInt(0, 1);
  let nextBoth = false;
  let nextGuess = false;
  for (const card of deck) {
    const both = card.kind === "question" ? nextBoth || game.turn === "both" : card.turn === "both";
    if (both) card.player = "both";
    else {
      card.player = player;
      player = 1 - player;
    }
    if (card.kind === "question") {
      if ((nextGuess || game.turn === "guess") && !both) card.guess = true;
      nextBoth = nextGuess = false;
    } else if (card.nextTurn === "both") nextBoth = true;
    else if (card.nextTurn === "guess") nextGuess = true;
  }
  return deck;
}
