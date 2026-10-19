const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

/**
 * Build a play deck: questions from all selected categories are shuffled together,
 * and a power card is dealt every minGap..maxGap questions (never two in a row).
 * Cards the couple already checked off (`answered`: Set of answerKey) are left out.
 * answerKey: "<categoryId>-<index>" for questions, "pc-<id>" for "מה יענה?" cards, null otherwise.
 */
export function buildDeck(content, categoryIds, answered = new Set()) {
  const { categories, meta } = content;
  const powerCards = content.powerCards
    .map((p) => ({ ...p, answerKey: p.type === "guess" ? `pc-${p.id}` : null }))
    .filter((p) => !answered.has(p.answerKey));
  const minGap = meta?.powerCardMinGap ?? 3;
  const maxGap = Math.max(minGap, meta?.powerCardMaxGap ?? 5);

  const questions = shuffle(
    categories
      .filter((c) => categoryIds.includes(c.id))
      .flatMap((c) => c.questions.map((text, i) => ({ kind: "question", key: `${c.id}-${i}`, answerKey: `${c.id}-${i}`, text, category: c })))
      .filter((q) => !answered.has(q.answerKey))
  );

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
    const both = card.kind === "question" ? nextBoth : card.turn === "both";
    if (both) card.player = "both";
    else {
      card.player = player;
      player = 1 - player;
    }
    if (card.kind === "question") {
      if (nextGuess && !both) card.guess = true;
      nextBoth = nextGuess = false;
    } else if (card.nextTurn === "both") nextBoth = true;
    else if (card.nextTurn === "guess") nextGuess = true;
  }
  return deck;
}
