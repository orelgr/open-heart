const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Build a play deck: categories in their natural order (gentle -> deep),
 * questions shuffled within each, power cards sprinkled at random gaps.
 */
export function buildDeck(content, categoryIds) {
  const { categories, powerCards, meta } = content;
  const minGap = meta?.powerCardMinGap ?? 4;
  const chance = meta?.powerCardChance ?? 0.14;

  const questions = categories
    .filter((c) => categoryIds.includes(c.id))
    .sort((a, b) => a.order - b.order)
    .flatMap((c) =>
      shuffle(c.questions).map((text, i) => ({ kind: "question", key: `${c.id}-${i}-${text.length}`, text, category: c }))
    );

  const powers = shuffle(powerCards);
  const deck = [];
  let sincePower = 0;
  let p = 0;
  for (const q of questions) {
    deck.push(q);
    sincePower++;
    // Guaranteed by 2*minGap, random after minGap.
    if (sincePower >= minGap && (Math.random() < chance * 2 || sincePower >= minGap * 2)) {
      const power = powers[p++ % powers.length];
      deck.push({ kind: "power", key: `power-${deck.length}`, ...power });
      sincePower = 0;
    }
  }
  return deck;
}
