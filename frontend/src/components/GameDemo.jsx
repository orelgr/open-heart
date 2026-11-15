import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Infinity as Endless, Lightbulb, Sparkles, X, Zap } from "lucide-react";
import { LogoMark } from "./Logo.jsx";
import { toneOf } from "../lib/icons.js";

/*
 * Animated "how to play" previews for the mini-game picker (GameSelect.jsx).
 * Each guide = 3 short steps + a looping scene. The loop runs through `timings` (ms per phase) and
 * `stepOf[phase]` tells which step is lit, so the text and the animation always tell the same story.
 * Scenes are pure functions of {phase, round}; real questions from the content are used where possible.
 */

const ease = [0.25, 0.1, 0.25, 1];
const spring = { type: "spring", stiffness: 420, damping: 30 };
const pop = { initial: { opacity: 0, scale: 0.6, y: 6 }, animate: { opacity: 1, scale: 1, y: 0 }, exit: { opacity: 0, scale: 0.8 }, transition: spring };
const fade = { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.28, ease } };

/** Steps the phases forward on their own timings; `round` counts completed loops. A new `key` restarts it. */
export function useLoop(timings, key) {
  const [t, setT] = useState({ phase: 0, round: 0, key });
  if (t.key !== key) setT({ phase: 0, round: 0, key });
  useEffect(() => {
    const id = setTimeout(
      () => setT((s) => (s.phase + 1 >= timings.length ? { ...s, phase: 0, round: s.round + 1 } : { ...s, phase: s.phase + 1 })),
      timings[t.phase] ?? 1000,
    );
    return () => clearTimeout(id);
  }, [t, timings]);
  return t.key === key ? t : { phase: 0, round: 0, key };
}

/* ---------- small building blocks ---------- */

const initialOf = (names, i) => names?.[i]?.trim()?.[0] ?? "";

/** Player chip: gold for the first player, ink for the second (the two arcs of the logo). */
function Avatar({ i, names, size = 30, active = true }) {
  const letter = initialOf(names, i);
  return (
    <motion.span
      animate={{ scale: active ? 1 : 0.9, opacity: active ? 1 : 0.45 }}
      transition={spring}
      className="flex shrink-0 items-center justify-center rounded-full text-[13px] font-semibold text-white shadow-[0_4px_10px_-4px_rgb(31_36_51/0.5)]"
      style={{ width: size, height: size, background: i === 0 ? "#B8955A" : "#1D1D1F" }}
    >
      {letter || <span className="size-2 rounded-full bg-white/80" />}
    </motion.span>
  );
}

/** Speech bubble; `side` = which player's corner the tail points to. */
function Bubble({ side = "right", className = "", children, dark = false }) {
  return (
    <motion.div
      {...pop}
      className={`relative rounded-2xl px-3 py-1.5 text-[12.5px] font-medium shadow-[0_6px_16px_-8px_rgb(31_36_51/0.35)] ${
        dark ? "bg-ink text-white" : "bg-white text-ink"
      } ${side === "right" ? "rounded-br-md" : "rounded-bl-md"} ${className}`}
    >
      {children}
    </motion.div>
  );
}

/** Three typing dots. */
function Dots({ dark = false }) {
  return (
    <span className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className={`size-1.5 rounded-full ${dark ? "bg-white/70" : "bg-ink/40"}`}
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.12 }}
        />
      ))}
    </span>
  );
}

/** Abstract answer: two lines of "text". */
const Lines = ({ dark = false, w = [52, 34] }) => (
  <span className="flex flex-col gap-1 py-1">
    {w.map((x) => (
      <span key={x} className={`h-1.5 rounded-full ${dark ? "bg-white/50" : "bg-ink/20"}`} style={{ width: x }} />
    ))}
  </span>
);

/* ---------- mini cards ---------- */

const miniFace = "absolute inset-0 overflow-hidden rounded-[16px] backface-hidden";

function MiniBack({ item }) {
  if (item.kind === "power")
    return (
      <div className={`${miniFace} flex flex-col items-center justify-center gap-2 bg-night`}>
        <div className="absolute inset-1.5 rounded-[12px] border border-gold-soft/30" />
        <motion.span
          animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.08, 1] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          className="flex size-10 items-center justify-center rounded-full bg-gold-soft/15"
        >
          <Zap size={20} className="text-gold-soft" strokeWidth={1.7} />
        </motion.span>
        <span className="font-display text-[13px] text-white">קלף כוח</span>
      </div>
    );
  const tone = toneOf(item.tone);
  return (
    <div className={`${miniFace} flex items-center justify-center`} style={{ background: `linear-gradient(155deg, ${tone.from}, ${tone.to})` }}>
      <div className="absolute inset-1.5 rounded-[12px] border border-white/40" />
      <span className="flex size-12 items-center justify-center rounded-full bg-white/25">
        <LogoMark size={30} />
      </span>
    </div>
  );
}

function MiniFace({ item, children }) {
  if (item.kind === "power")
    return (
      <div className={`${miniFace} flex flex-col items-center justify-center gap-1.5 bg-night px-2.5 text-center`} style={{ transform: "rotateY(180deg)" }}>
        <div className="absolute inset-1.5 rounded-[12px] border border-gold-soft/30" />
        <span className="flex items-center gap-1 text-[9.5px] font-medium tracking-wide text-gold-soft">
          <Zap size={10} />
          {item.title}
        </span>
        <span className="font-display text-[12px] leading-snug text-white">{item.text}</span>
        {children}
      </div>
    );
  const tone = toneOf(item.tone);
  return (
    <div className={`${miniFace} grain flex flex-col bg-[#FFFDF9] p-2.5`} style={{ transform: "rotateY(180deg)" }}>
      <span className="flex items-center gap-1 truncate text-[9.5px] font-medium text-muted">
        <span className="size-1.5 rounded-full" style={{ background: tone.to }} />
        {item.label}
      </span>
      <span className="flex flex-1 flex-col items-center justify-center gap-2">
        <span className="line-clamp-4 font-display text-[13.5px] leading-snug text-ink">{item.text}</span>
        {children}
      </span>
    </div>
  );
}

/**
 * A 3-card stack: card `n` on top, flipped when `flipped`. Advancing `n` throws the top card off
 * and every card moves up a layer (same choreography as the real deck, in miniature).
 */
function MiniDeck({ items, n, flipped, renderExtra }) {
  return (
    <div className="relative h-[162px] w-[120px]">
      <AnimatePresence initial={false}>
        {[2, 1, 0].map((d) => {
          const k = n + d;
          const item = items[k % items.length];
          return (
            <motion.div
              key={k}
              className="absolute inset-0 rounded-[16px] shadow-[0_10px_24px_-12px_rgb(31_36_51/0.45)]"
              style={{ zIndex: 3 - d }}
              initial={{ y: 26, scale: 0.84, opacity: 0 }}
              animate={{ y: d * 9, scale: 1 - d * 0.06, opacity: 1, x: 0, rotate: 0 }}
              exit={{ zIndex: 10, x: -150, y: -24, rotate: -18, opacity: 0, transition: { duration: 0.42, ease: [0.4, 0, 0.2, 1] } }}
              transition={spring}
            >
              <motion.div
                className="preserve-3d relative size-full"
                style={{ transformPerspective: 600 }}
                animate={{ rotateY: d === 0 && flipped ? 180 : 0, scale: d === 0 && flipped ? 1.04 : 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 24 }}
              >
                <MiniBack item={item} />
                <MiniFace item={item}>{d === 0 && renderExtra?.(item)}</MiniFace>
              </motion.div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/** Cursor-like tap ripple, shown when a card is "tapped" to flip. */
function Tap({ show }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          className="pointer-events-none absolute left-1/2 top-1/2 z-20 -ml-5 -mt-5 size-10 rounded-full border-2 border-white bg-white/40"
          initial={{ scale: 0.4, opacity: 0.9 }}
          animate={{ scale: 1.5, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      )}
    </AnimatePresence>
  );
}

/* ---------- content helpers ---------- */

/** Short real questions, one per category, for the demos. */
function useSamples(content, max = 38) {
  return useMemo(() => {
    const cats = content?.categories ?? [];
    return cats
      .map((c) => {
        const q = c.questions.find((x) => x.length <= max) ?? c.questions[0];
        return q && { kind: "question", tone: c.tone, label: c.title, text: q };
      })
      .filter(Boolean);
  }, [content, max]);
}

/* ---------- scenes ---------- */

/** שיחה פתוחה: draw, flip, answer, and every few cards a power card. */
function ClassicScene({ content, phase, round }) {
  const qs = useSamples(content);
  const power = content?.powerCards?.find((p) => p.type === "challenge") ?? { title: "אתגר", text: "שלושה דברים שאתם אוהבים אחד בשני" };
  const items = useMemo(
    () => [qs[0], qs[2] ?? qs[0], { kind: "power", title: power.title, text: power.text }, qs[4] ?? qs[1] ?? qs[0]].filter(Boolean),
    [qs, power.title, power.text],
  );
  const n = round * 4 + Math.floor(phase / 2);
  const flipped = phase % 2 === 1;
  return (
    <div className="relative">
      <MiniDeck items={items} n={n} flipped={flipped} />
      <Tap show={flipped} />
    </div>
  );
}

/** סבב מהיר: the clock starts the moment the card is flipped. */
function RapidRing({ seconds, phase }) {
  const R = 13;
  const C = 2 * Math.PI * R;
  const [left, setLeft] = useState(seconds);
  const running = phase === 1;
  useEffect(() => {
    if (!running) return;
    setLeft(seconds);
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1700 / seconds);
    return () => clearInterval(id);
  }, [running, seconds]);
  const done = phase === 2;
  const value = done ? 0 : running ? left : seconds;
  return (
    <motion.span className="relative size-9" animate={done ? { scale: [1, 1.15, 1] } : { scale: 1 }} transition={{ duration: 0.4 }}>
      <svg viewBox="0 0 32 32" className="size-9 -rotate-90">
        <circle cx="16" cy="16" r={R} stroke="rgb(29 29 31 / 0.08)" strokeWidth="2.5" fill="none" />
        <circle
          cx="16" cy="16" r={R} fill="none" strokeWidth="2.5" strokeLinecap="round"
          stroke={done ? "#B98572" : "#B8955A"} strokeDasharray={C} strokeDashoffset={C * (1 - value / seconds)}
          style={{ transition: "stroke-dashoffset 90ms linear" }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-medium tabular-nums text-ink">{value}</span>
    </motion.span>
  );
}

function RapidScene({ content, game, phase, round }) {
  const qs = useSamples(content, 30);
  const items = useMemo(() => [qs[1] ?? qs[0], qs[3] ?? qs[0], qs[5] ?? qs[0]].filter(Boolean), [qs]);
  const sub = phase % 3;
  const n = round * 3 + Math.floor(phase / 3);
  const seconds = game.seconds ?? 20;
  return (
    <div className="relative flex items-center gap-5">
      <div className="relative">
        <MiniDeck items={items} n={n} flipped={sub > 0} renderExtra={() => <RapidRing seconds={seconds} phase={sub} />} />
        <Tap show={sub === 1} />
      </div>
      <AnimatePresence>
        {sub === 2 && (
          <motion.span {...pop} className="absolute -left-[70px] top-3 rounded-full bg-clay/90 px-2.5 py-1 text-[11.5px] font-medium text-white">
            הלאה!
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

/** זה או זה: both pick a side, then explain why. */
function RatherScene({ game, names, phase, round }) {
  const pairs = game.questions?.length ? game.questions : [["לדעת לעוף", "להיות בלתי נראים"]];
  const short = pairs.filter(([a, b]) => a.length + b.length <= 46);
  const list = short.length >= 3 ? short : pairs;
  const pair = list[(round * 7) % list.length];
  const pickA = round % 2;
  const pickB = round % 3 === 0 ? pickA : 1 - pickA;
  const tone = toneOf(game.tone);
  const chips = (side) => (
    <div className="flex h-8 items-center justify-center gap-1">
      <AnimatePresence>
        {phase >= 1 && pickA === side && (
          <motion.span key="a" {...pop}>
            <Avatar i={0} names={names} size={26} />
          </motion.span>
        )}
        {phase >= 2 && pickB === side && (
          <motion.span key="b" {...pop}>
            <Avatar i={1} names={names} size={26} />
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
  const option = (side) => {
    const chosen = (phase >= 1 && pickA === side) || (phase >= 2 && pickB === side);
    return (
      <div className="flex w-[124px] flex-col items-center gap-1.5">
        <motion.div
          animate={{ scale: chosen ? 1.04 : 1, boxShadow: chosen ? `0 0 0 2px ${tone.accent}, 0 12px 24px -12px rgb(31 36 51 / 0.4)` : "0 0 0 1px rgb(29 29 31 / 0.06), 0 6px 16px -10px rgb(31 36 51 / 0.3)" }}
          transition={spring}
          className="grain flex h-[78px] w-full items-center justify-center rounded-2xl bg-[#FFFDF9] px-2.5 text-center"
        >
          <span className="line-clamp-3 font-display text-[13.5px] leading-snug text-ink">{pair[side]}</span>
        </motion.div>
        {chips(side)}
      </div>
    );
  };
  return (
    <AnimatePresence mode="wait">
      <motion.div key={round} {...fade} className="flex flex-col items-center gap-2.5">
        <span className="text-[12px] font-medium tracking-wide text-muted">מה הייתם מעדיפים?</span>
        <div className="relative flex items-start gap-3">
          {option(0)}
          <span className="mt-[27px] flex size-6 items-center justify-center rounded-full bg-white text-[11px] font-semibold shadow-sm" style={{ color: tone.accent }}>
            או
          </span>
          {option(1)}
          <AnimatePresence>
            {phase === 3 && (
              <motion.div className="absolute -bottom-1 left-1/2 -translate-x-1/2" {...pop}>
                <Bubble dark side="left">
                  <span className="flex items-center gap-1.5">
                    למה? <Dots dark />
                  </span>
                </Bubble>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

const GUESS_ROUNDS = [
  { q: "איפה החופשה המושלמת?", g: "בים", a: "בים", hit: true },
  { q: "מה הקינוח האהוב?", g: "גלידה", a: "עוגת גבינה", hit: false },
  { q: "בוקר מושלם מתחיל ב...", g: "קפה", a: "קפה", hit: true },
];

/** מה יענה?: one guesses, the other answers, a right guess scores a point. */
function GuessScene({ names, phase, round }) {
  const r = GUESS_ROUNDS[round % GUESS_ROUNDS.length];
  // Points so far: every finished round, plus this one once it is revealed.
  let score = 0;
  for (let i = 0; i < round; i++) score += GUESS_ROUNDS[i % GUESS_ROUNDS.length].hit ? 1 : 0;
  if (phase >= 3 && r.hit) score += 1;
  return (
    <div className="flex w-full max-w-[300px] flex-col items-center gap-3">
      <div className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11.5px] font-medium text-ink-soft shadow-sm">
        ניקוד
        <AnimatePresence mode="popLayout">
          <motion.span key={score} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} className="tabular-nums text-[#7F5F2A]">
            {score}
          </motion.span>
        </AnimatePresence>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={round} {...fade} className="grain flex flex-col items-center gap-1 rounded-2xl bg-[#FFFDF9] px-4 py-2.5 shadow-[0_8px_20px_-12px_rgb(31_36_51/0.4)]">
          <span className="flex items-center gap-1 text-[10.5px] font-medium text-[#7F5F2A]">
            <Lightbulb size={11} />
            מה יענה?
          </span>
          <span className="font-display text-[15px] text-ink">{r.q}</span>
        </motion.div>
      </AnimatePresence>
      <div className="flex w-full items-end justify-between px-1">
        {/* answerer (right) */}
        <div className="flex items-end gap-1.5">
          <Avatar i={0} names={names} active={phase === 2 || phase === 3} />
          <div className="h-9">
            <AnimatePresence>
              {phase >= 2 && (
                <Bubble key={`a${round}`} side="right">
                  {r.a}
                </Bubble>
              )}
            </AnimatePresence>
          </div>
        </div>
        {/* guesser (left) */}
        <div className="flex flex-row-reverse items-end gap-1.5">
          <Avatar i={1} names={names} active={phase === 1 || phase === 3} />
          <div className="h-9">
            <AnimatePresence>
              {phase >= 1 && (
                <Bubble key={`g${round}`} side="left" className="!bg-[#F4EAD7]">
                  <span className="flex items-center gap-1">
                    <Lightbulb size={12} className="text-[#7F5F2A]" />
                    {r.g}
                  </span>
                </Bubble>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      <div className="absolute bottom-3 left-1/2 h-7 -translate-x-1/2">
        <AnimatePresence>
          {phase === 3 && (
            <motion.span
              key={`r${round}`}
              {...pop}
              className={`flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-medium ${r.hit ? "bg-gold text-white" : "bg-ink/8 text-ink-soft"}`}
            >
              {r.hit ? <Check size={13} strokeWidth={2.6} /> : <X size={13} strokeWidth={2.6} />}
              {r.hit ? "ניחוש נכון · +1" : "לא הפעם"}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** שניכם עונים: one question, both answer in turn, then compare. */
function MirrorScene({ content, names, phase, round }) {
  const qs = useSamples(content, 34);
  const q = qs[(round * 2 + 1) % Math.max(qs.length, 1)] ?? { text: "מה הכי טוב שקרה לך השבוע?" };
  return (
    <div className="flex w-full max-w-[300px] flex-col items-center gap-3.5">
      <AnimatePresence mode="wait">
        <motion.div key={round} {...fade} className="grain max-w-[220px] rounded-2xl bg-[#FFFDF9] px-4 py-2.5 text-center shadow-[0_8px_20px_-12px_rgb(31_36_51/0.4)]">
          <span className="font-display text-[14.5px] leading-snug text-ink">{q.text}</span>
        </motion.div>
      </AnimatePresence>
      <div className="relative flex w-full items-end justify-between px-1">
        <div className="flex items-end gap-1.5">
          <Avatar i={0} names={names} active={phase !== 2} />
          <div className="h-10">
            <AnimatePresence>{phase >= 1 && <Bubble key={`a${round}`}>{phase === 1 ? <Dots /> : <Lines />}</Bubble>}</AnimatePresence>
          </div>
        </div>
        <div className="flex flex-row-reverse items-end gap-1.5">
          <Avatar i={1} names={names} active={phase >= 2} />
          <div className="h-10">
            <AnimatePresence>
              {phase >= 2 && (
                <Bubble key={`b${round}`} side="left" dark>
                  {phase === 2 ? <Dots dark /> : <Lines dark w={[40, 56]} />}
                </Bubble>
              )}
            </AnimatePresence>
          </div>
        </div>
        <AnimatePresence>
          {phase === 3 && (
            <motion.span
              {...pop}
              className="absolute -top-1 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-plum/90 px-2.5 py-1 text-[11.5px] font-medium text-white"
            >
              <Sparkles size={12} />
              משווים
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** נושאי שיחה: open a topic and let the conversation roll, no clock. */
function TopicsScene({ game, names, phase, round }) {
  const topics = game.questions?.length ? game.questions : [["מוזיאון החיים", "אם היה מוזיאון על החיים שלכם, מה היה בו?"]];
  const [title, prompt] = topics[(round * 5) % topics.length];
  const tone = toneOf(game.tone);
  const bubbles = Math.max(0, Math.min(phase, 4));
  const spots = [
    { side: 0, x: 0, y: 0 },
    { side: 1, x: 0, y: -4 },
    { side: 0, x: 0, y: -40 },
    { side: 1, x: 0, y: -44 },
  ];
  return (
    <div className="relative flex h-full w-full max-w-[320px] flex-col items-center justify-center">
      <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-ink-soft shadow-sm">
        <Endless size={12} />
        בלי שעון
      </span>
      <AnimatePresence mode="wait">
        <motion.div key={round} {...fade} className="grain z-10 w-[168px] rounded-2xl bg-[#FFFDF9] px-3.5 py-3 shadow-[0_10px_24px_-12px_rgb(31_36_51/0.45)]">
          <p className="font-display text-[16px] leading-tight text-ink">{title}</p>
          <span className="my-1.5 block h-px w-8" style={{ background: tone.to }} />
          <p className="line-clamp-2 text-[11px] leading-snug text-ink-soft">{prompt}</p>
        </motion.div>
      </AnimatePresence>
      <div className="absolute inset-x-3 bottom-3 flex items-end justify-between">
        <Avatar i={0} names={names} active={bubbles % 2 === 1 || phase === 5} />
        <Avatar i={1} names={names} active={(bubbles > 0 && bubbles % 2 === 0) || phase === 5} />
      </div>
      <AnimatePresence>
        {spots.slice(0, phase === 5 ? 0 : bubbles).map((s, i) => (
          <motion.div
            key={`${round}-${i}`}
            className="absolute bottom-12"
            style={s.side === 0 ? { right: 14 + s.x } : { left: 14 + s.x }}
            initial={{ opacity: 0, scale: 0.5, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: s.y }}
            exit={{ opacity: 0, y: s.y - 30, scale: 0.9, transition: { duration: 0.45, delay: i * 0.05 } }}
            transition={spring}
          >
            <Bubble side={s.side === 0 ? "right" : "left"} dark={s.side === 1}>
              <Lines dark={s.side === 1} w={i < 2 ? [30, 20] : [22]} />
            </Bubble>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ---------- registry ---------- */

/**
 * Per-game guide. Unknown games (added later in the admin) fall back to the classic scene and their subtitle.
 * timings[i] = ms of phase i; stepOf[i] = lit step during phase i.
 */
export const GUIDES = {
  classic: {
    steps: ["שולפים והופכים", "מי שתורו עונה", "קלף כוח? מבצעים"],
    timings: [800, 1700, 800, 1700, 900, 1900, 800, 1700],
    stepOf: [0, 1, 0, 1, 2, 2, 0, 1],
    Scene: ClassicScene,
  },
  rather: {
    steps: ["קוראים את הדילמה", "כל אחד בוחר צד", "מסבירים למה"],
    timings: [1200, 900, 1100, 1700],
    stepOf: [0, 1, 1, 2],
    Scene: RatherScene,
  },
  guess: {
    steps: ["מנחשים מה השני יענה", "השני עונה", "ניחוש נכון = נקודה"],
    timings: [1000, 1200, 1100, 1700],
    stepOf: [0, 0, 1, 2],
    Scene: GuessScene,
  },
  rapid: {
    steps: ["הופכים, והשעון רץ", "עונים מהבטן", "נגמר הזמן? הלאה"],
    timings: [600, 1900, 700, 600, 1900, 700, 600, 1900, 700],
    stepOf: [0, 1, 2, 0, 1, 2, 0, 1, 2],
    Scene: RapidScene,
  },
  mirror: {
    steps: ["שאלה אחת לשניכם", "עונים בתורות", "משווים ומגלים"],
    timings: [1000, 1300, 1300, 1700],
    stepOf: [0, 1, 1, 2],
    Scene: MirrorScene,
  },
  topics: {
    steps: ["פותחים נושא", "מדברים חופשי", "ממשיכים לזרום"],
    timings: [1200, 750, 750, 750, 900, 1000],
    stepOf: [0, 1, 1, 1, 2, 2],
    Scene: TopicsScene,
  },
};

export const guideOf = (game) => GUIDES[game.id] ?? { ...GUIDES.classic, steps: null };
