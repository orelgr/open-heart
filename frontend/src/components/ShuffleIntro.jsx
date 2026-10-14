import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { toneOf } from "../lib/icons.js";

const PER_SIDE = 6;
const T = 2.45; // total seconds
const CARD_W = 108;
const CARD_H = 152;
const HALF_X = 60;

/** Stylised hand + sleeve cuff (left hand; the right one is mirrored). Thumb rests on the deck's inner edge. */
function Hand({ mirrored }) {
  return (
    <svg viewBox="0 0 120 150" width="104" height="130" style={{ transform: mirrored ? "scaleX(-1)" : undefined }} aria-hidden>
      <defs>
        <linearGradient id="skin" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F0D5B6" />
          <stop offset="1" stopColor="#DDB78F" />
        </linearGradient>
      </defs>
      <rect x="16" y="112" width="58" height="38" rx="11" fill="#1F2433" />
      <rect x="16" y="118" width="58" height="3" fill="#B8955A" opacity="0.7" />
      <rect x="26" y="86" width="38" height="36" rx="14" fill="url(#skin)" />
      {/* back of the hand */}
      <rect x="8" y="34" width="70" height="66" rx="30" fill="url(#skin)" />
      {/* fingers wrapped around the card's outer side */}
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={6 + i * 4} y={14 + i * 7} width="30" height="15" rx="7.5" fill="url(#skin)" stroke="#C9A27A" strokeWidth="0.8" />
      ))}
      {/* thumb on top of the deck, pointing inward */}
      <path d="M52 52 C 70 40, 92 24, 108 22 C 116 21.5, 118 31, 110 34 C 94 40, 78 54, 66 70 Z" fill="url(#skin)" stroke="#C9A27A" strokeWidth="0.8" />
      <ellipse cx="108" cy="27.5" rx="4.2" ry="3.2" fill="#F7E4CD" opacity="0.8" />
    </svg>
  );
}

/** Two-handed riffle shuffle. Cards take the colours of the chosen categories. */
export default function ShuffleIntro({ tones, onDone }) {
  const reduce = useReducedMotion();

  useEffect(() => {
    const id = setTimeout(onDone, reduce ? 250 : T * 1000 + 150);
    // tiny haptic "riffle" ticks
    const ticks = [];
    if (!reduce && navigator.vibrate) {
      for (let k = 0; k < PER_SIDE * 2; k++) ticks.push(setTimeout(() => navigator.vibrate(4), (0.85 + k * 0.07) * 1000));
    }
    return () => {
      clearTimeout(id);
      ticks.forEach(clearTimeout);
    };
  }, [onDone, reduce]);

  const palette = (tones.length ? tones : ["sand"]).map(toneOf);
  const tA = 0.28;
  const tB = 0.62;
  const tE = 2.0;
  const tF = 2.2;
  const lastDrop = 0.85 + (PER_SIDE * 2 - 1) * 0.07;

  const cards = [];
  for (const s of [-1, 1]) {
    for (let j = 0; j < PER_SIDE; j++) {
      const k = j * 2 + (s > 0 ? 1 : 0); // alternate left/right
      const tone = palette[(j + (s > 0 ? 1 : 0)) % palette.length];
      const drop = 0.85 + k * 0.07;
      const rest = -j * 1.6;
      const stackY = -k * 1.5;
      cards.push(
        <motion.div
          key={`${s}-${j}`}
          className="absolute left-1/2 top-1/2 rounded-[14px] shadow-[0_2px_6px_rgb(0_0_0/0.14)]"
          style={{
            width: CARD_W,
            height: CARD_H,
            marginLeft: -CARD_W / 2,
            marginTop: -CARD_H / 2,
            zIndex: 10 + k,
            background: `linear-gradient(155deg, ${tone.from}, ${tone.to})`,
            transformOrigin: s < 0 ? "20% 90%" : "80% 90%",
          }}
          initial={{ opacity: 0, x: s * HALF_X, y: rest + 30, rotate: 0 }}
          animate={
            reduce
              ? { opacity: 1, x: 0, y: stackY, rotate: 0 }
              : {
                  opacity: [0, 1, 1, 1, 1, 1, 1, 1, 1],
                  x: [s * HALF_X, s * HALF_X, s * HALF_X, s * HALF_X, 0, 0, 0, 0, 0],
                  y: [rest + 30, rest, rest - 10, rest - 10, stackY, stackY, stackY - 14, stackY, stackY],
                  rotate: [0, 0, s * 10, s * 10, 0, 0, 0, 0, 0],
                }
          }
          transition={{
            duration: T,
            times: [0, tA, tB, drop - 0.12, drop, drop + 0.1, tE, tF, T].map((t) => Math.min(t / T, 1)),
            ease: "easeInOut",
          }}
        >
          <div className="absolute inset-[6px] rounded-[10px] border border-white/40" />
        </motion.div>
      );
    }
  }

  const hand = (s) => (
    <motion.div
      key={s}
      className="absolute left-1/2 top-1/2"
      style={{ marginLeft: -52, marginTop: -8, zIndex: 40, transformOrigin: "50% 100%" }}
      initial={{ x: s * 200, y: 70, opacity: 0 }}
      animate={
        reduce
          ? { x: s * 96, y: 70, opacity: 0 }
          : {
              x: [s * 200, s * (HALF_X + 36), s * (HALF_X + 36), s * (HALF_X + 24), s * (HALF_X + 24), s * 200],
              y: [80, 38, 24, 28, 28, 90],
              rotate: [0, 0, s * 8, s * 4, s * 4, 0],
              opacity: [0, 1, 1, 1, 1, 0],
            }
      }
      transition={{ duration: T, times: [0, tA, tB, lastDrop, tE, T].map((t) => t / T), ease: "easeInOut" }}
    >
      <Hand mirrored={s > 0} />
    </motion.div>
  );

  return (
    <button
      type="button"
      onClick={onDone}
      aria-label="מערבבים את החפיסה. הקישו לדילוג"
      data-testid="shuffle"
      className="absolute inset-0 flex flex-col items-center justify-center"
    >
      <div className="relative h-[300px] w-full max-w-[340px]">
        {cards}
        {[-1, 1].map(hand)}
      </div>
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-2 font-display text-[22px] text-ink-soft"
      >
        מערבבים את החפיסה…
      </motion.p>
      <p className="mt-1 text-[12px] text-muted">הקישו לדילוג</p>
    </button>
  );
}
