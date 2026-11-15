import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { Button, IconButton, Screen, TopBar } from "./ui.jsx";
import { guideOf, useLoop } from "./GameDemo.jsx";
import { iconFor, toneOf } from "../lib/icons.js";
import { buildDeck, CLASSIC } from "../lib/deck.js";
import { navigate } from "../lib/router.js";

/** One quiet line of facts under the game name ("90 שאלות · טיימר 20 שנ׳ · ניקוד"). */
const factsOf = (g, count) =>
  [
    `${count} ${g.format === "topic" ? "נושאים" : "שאלות"}`,
    g.seconds && `טיימר ${g.seconds} שנ׳`,
    g.score && "ניקוד",
    g.power === "none" ? "בלי קלפי כוח" : g.power === "all" && "קלפי כוח",
  ]
    .filter(Boolean)
    .join(" · ");

const SWIPE = 50;

/**
 * Pick a mini-game. Top: a live, looping preview of how the selected game plays, with its 3 steps lit in
 * sync. Below: a calm 3×2 grid of games. Questions always come from every category, so nothing else to choose.
 */
export default function GameSelect({
  content,
  answered,
  players,
  gameId,
  setGameId,
  onStart,
}) {
  const games = content.games?.length
    ? content.games
    : [
        {
          ...CLASSIC,
          title: "שיחה פתוחה",
          subtitle: "",
          icon: "Shuffle",
          tone: "gold",
        },
      ];
  // Questions already checked off are out of the deck until unchecked on the "answered" page.
  const counts = Object.fromEntries(
    games.map((g) => [
      g.id,
      buildDeck(content, g, answered).filter((c) => c.kind === "question")
        .length,
    ]),
  );
  const index = Math.max(
    0,
    games.findIndex((g) => g.id === gameId),
  );
  const current = games[index];
  const count = counts[current.id];
  const tone = toneOf(current.tone);
  const guide = guideOf(current);
  const { phase, round } = useLoop(guide.timings, current.id);
  const step = guide.stepOf[phase] ?? 0;
  const Scene = guide.Scene;

  const go = (d) =>
    setGameId(games[(index + d + games.length) % games.length].id);

  return (
    <Screen className="!px-0">
      <div className="px-5">
        <TopBar
          right={
            <IconButton label="חזרה" onClick={() => navigate("/")}>
              <ChevronRight size={22} />
            </IconButton>
          }
        />
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 pb-4">
        <h1 className="mt-2 font-display text-[32px] leading-tight">
          מה משחקים?
        </h1>

        {/* Live preview. Swipe sideways to move between games. */}
        <motion.div
          className="relative mt-4 h-[232px] touch-pan-y overflow-hidden rounded-[28px] border border-white/70 shadow-[var(--shadow-soft)]"
          animate={{
            background: `linear-gradient(160deg, ${tone.from}66 0%, rgba(255,255,255,0.7) 60%, ${tone.to}33 100%)`,
          }}
          transition={{ duration: 0.4 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.18}
          onDragEnd={(_, info) => {
            if (info.offset.x < -SWIPE) go(1);
            else if (info.offset.x > SWIPE) go(-1);
          }}
          data-testid="game-preview"
          aria-hidden
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={current.id}
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
              transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <Scene
                content={content}
                game={current}
                names={players}
                phase={phase}
                round={round}
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Name, facts and the 3 steps (the lit step follows the preview). */}
        {/* Fixed height + overlapping crossfade, so the grid below never jumps between games. */}
        <div className="relative mt-4 h-[120px]">
          <AnimatePresence initial={false}>
            <motion.section
              key={current.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ duration: 0.22, delay: 0.05 }}
              className="absolute inset-x-0 top-0 px-1"
              aria-live="polite"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-[24px] leading-tight">
                  {current.title}
                </h2>
                <span className="shrink-0 text-[12.5px] text-muted">
                  {factsOf(current, count)}
                </span>
              </div>
              {guide.steps ? (
                <ol
                  className="mt-3 grid grid-cols-3 gap-2"
                  data-testid="game-steps"
                >
                  {guide.steps.map((s, i) => {
                    const on = i === step;
                    return (
                      <li
                        key={s}
                        className="relative flex flex-col items-center gap-2 text-center"
                      >
                        {/* Connector to the next step (to the left in RTL); fills once this step is done. */}
                        {i < guide.steps.length - 1 && (
                          <span
                            className="absolute top-[13px] h-[2px] rounded-full bg-ink/8"
                            style={{ right: "calc(50% + 22px)", left: "calc(-50% + 14px)" }}
                          >
                            <motion.span
                              className="absolute inset-0 origin-right rounded-full"
                              style={{ background: tone.accent }}
                              animate={{ scaleX: step > i ? 1 : 0 }}
                              transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                            />
                          </span>
                        )}
                        <motion.span
                          animate={{
                            backgroundColor: on || step > i ? tone.accent : "rgba(29,29,31,0.06)",
                            color: on || step > i ? "#fff" : "#6E6A64",
                            scale: on ? 1.12 : 1,
                            boxShadow: on ? `0 0 0 4px ${tone.accent}26` : "0 0 0 0px rgba(0,0,0,0)",
                          }}
                          transition={{ duration: 0.25 }}
                          className="relative flex size-7 items-center justify-center rounded-full text-[12.5px] font-semibold"
                        >
                          {i + 1}
                        </motion.span>
                        <motion.span
                          animate={{ color: on ? "#1D1D1F" : "#8E8A84" }}
                          transition={{ duration: 0.25 }}
                          className="text-[13px] font-medium leading-snug"
                        >
                          {s}
                        </motion.span>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                current.subtitle && (
                  <p className="mt-2 text-[14px] leading-snug text-muted">
                    {current.subtitle}
                  </p>
                )
              )}
            </motion.section>
          </AnimatePresence>
        </div>

        {/* Games */}
        <div
          className="mt-2 grid grid-cols-3 gap-2.5"
          role="radiogroup"
          aria-label="משחקונים"
        >
          {games.map((g, i) => {
            const on = g.id === current.id;
            const t = toneOf(g.tone);
            const Icon = iconFor(g.icon);
            return (
              <motion.button
                key={g.id}
                role="radio"
                aria-checked={on}
                aria-label={g.subtitle ? `${g.title}. ${g.subtitle}` : g.title}
                data-testid={`game-${g.id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.22 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setGameId(g.id)}
                className={`relative flex flex-col items-center gap-2 rounded-[22px] px-1.5 pb-3 pt-3.5 transition-[background-color,box-shadow] duration-200 ${
                  on
                    ? "bg-white shadow-[0_10px_28px_-14px_rgb(31_36_51/0.45)]"
                    : "glass"
                }`}
              >
                {on && (
                  <motion.span
                    layoutId="game-ring"
                    className="pointer-events-none absolute inset-0 rounded-[22px]"
                    style={{ boxShadow: `inset 0 0 0 2px ${t.accent}` }}
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                  />
                )}
                <motion.span
                  animate={{ scale: on ? 1.06 : 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 28 }}
                  className="flex size-11 items-center justify-center rounded-[14px]"
                  style={{
                    background: `linear-gradient(155deg, ${t.from}, ${t.to})`,
                    color: t.accent,
                  }}
                >
                  <Icon size={21} strokeWidth={1.8} />
                </motion.span>
                <span
                  className={`text-[13.5px] leading-tight ${on ? "font-semibold text-ink" : "font-medium text-ink-soft"}`}
                >
                  {g.title}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
      <div className="px-5 pt-3">
        <Button
          className="w-full disabled:opacity-40"
          disabled={!count}
          onClick={onStart}
          data-testid="play"
        >
          {count ? `מתחילים · ${current.title}` : "עניתם על כל הקלפים כאן"}
        </Button>
      </div>
    </Screen>
  );
}
