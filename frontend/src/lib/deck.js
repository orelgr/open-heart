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
 */
export function buildDeck(content, categoryIds) {
  const { categories, powerCards, meta } = content;
  const minGap = meta?.powerCardMinGap ?? 3;
  const maxGap = Math.max(minGap, meta?.powerCardMaxGap ?? 5);

  const questions = shuffle(
    categories
      .filter((c) => categoryIds.includes(c.id))
      .flatMap((c) => c.questions.map((text, i) => ({ kind: "question", key: `${c.id}-${i}`, text, category: c })))
  );

  let powers = shuffle(powerCards);
  const deck = [];
  let untilPower = randInt(minGap, maxGap);
  questions.forEach((q, i) => {
    deck.push(q);
    untilPower--;
    // Skip a power card right at the end of the deck.
    if (untilPower === 0 && i < questions.length - 1) {
      if (!powers.length) powers = shuffle(powerCards);
      deck.push({ kind: "power", key: `power-${deck.length}`, ...powers.pop() });
      untilPower = randInt(minGap, maxGap);
    }
  });
  return deck;
}
