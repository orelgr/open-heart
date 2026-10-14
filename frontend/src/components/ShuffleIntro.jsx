import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { toneOf } from "../lib/icons.js";

/**
 * Riffle shuffle on a 3D table: halves slide in, hands grip and bend the inner corners up,
 * cards cascade alternately into the middle, the stack bridges (arches) and is squared with a tap.
 * Choreography is one shared timeline (seconds); every card/hand animates against the same `times`.
 */
const PER_SIDE = 8;
const N = PER_SIDE * 2;
const T = 2.9;
const CARD_W = 104;
const CARD_H = 146;
const HALF_X = 60;
const STEP = 0.058; // seconds between consecutive card drops
const TL = { slide: 0.5, grip: 0.9, drop0: 1.0, bridge: 2.0, bridgeEnd: 2.3, tap: 2.5 };
const lastDrop = TL.drop0 + (N - 1) * STEP;

/** Stylised hand + sleeve cuff, left hand (right one is mirrored). Thumb presses the deck's inner corner. */
function Hand({ mirrored }) {
  return (
    <svg viewBox="0 0 150 160" width="132" height="141" style={{ transform: mirrored ? "scaleX(-1)" : undefined, overflow: "visible" }} aria-hidden>
      <defs>
        <linearGradient id="oh-skin" x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#F6DFC4" />
          <stop offset="0.55" stopColor="#E7C29C" />
          <stop offset="1" stopColor="#D5A97F" />
        </linearGradient>
        <linearGradient id="oh-sleeve" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2A3046" />
          <stop offset="1" stopColor="#1B2030" />
        </linearGradient>
        <filter id="oh-shadow" x="-20%" y="-20%" width="150%" height="150%">
          <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#1F2433" floodOpacity="0.28" />
        </filter>
      </defs>
      <g filter="url(#oh-shadow)">
        {/* sleeve + cuff */}
        <path d="M18 160 L24 120 Q25 112 33 112 L83 112 Q91 112 92 120 L98 160 Z" fill="url(#oh-sleeve)" />
        <rect x="24" y="112" width="68" height="9" rx="4.5" fill="#F4F0E8" opacity="0.95" />
        {/* wrist */}
        <path d="M34 114 L36 88 Q36 80 46 80 L72 80 Q82 80 82 88 L84 114 Z" fill="url(#oh-skin)" />
        {/* back of the hand */}
        <path d="M22 66 Q16 44 30 34 Q50 24 74 34 Q92 44 90 66 Q88 86 70 90 L46 90 Q26 88 22 66 Z" fill="url(#oh-skin)" />
        {/* fingers curled around the outer edge of the deck */}
        <g stroke="#C79A70" strokeWidth="0.9" strokeLinejoin="round" fill="url(#oh-skin)">
          <rect x="6" y="44" width="38" height="15" rx="7.5" transform="rotate(-24 6 52)" />
          <rect x="3" y="30" width="42" height="15.5" rx="7.75" transform="rotate(-34 3 38)" />
          <rect x="6" y="15" width="42" height="15" rx="7.5" transform="rotate(-44 6 22)" />
          <rect x="14" y="3" width="36" height="14" rx="7" transform="rotate(-54 14 10)" />
        </g>
        {/* thumb, pointing inward over the deck */}
        <path d="M56 66 C 70 50, 96 34, 124 30 C 136 28.5, 140 40, 130 46 C 108 54, 90 70, 78 88 Z" fill="url(#oh-skin)" stroke="#C79A70" strokeWidth="0.9" strokeLinejoin="round" />
        <path d="M118 31.5 C 128 30, 134 36, 130.5 41.5 C 126 43.5, 119 42.5, 115 38 Z" fill="#FBEBD6" opacity="0.9" />
      </g>
    </svg>
  );
}

export default function ShuffleIntro({ tones, onDone }) {
  const reduce = useReducedMotion();

  useEffect(() => {
    const id = setTimeout(onDone, reduce ? 250 : T * 1000 + 100);
    const ticks = [];
    if (!reduce && navigator.vibrate) {
      for (let k = 0; k < N; k++) ticks.push(setTimeout(() => navigator.vibrate(3), (TL.drop0 + k * STEP) * 1000));
      ticks.push(setTimeout(() => navigator.vibrate(12), TL.tap * 1000));
    }
    return () => {
      clearTimeout(id);
      ticks.forEach(clearTimeout);
    };
  }, [onDone, reduce]);

  const palette = (tones.length ? tones : ["sand"]).map(toneOf);
  const frac = (arr) => arr.map((t) => Math.min(t / T, 1));

  const cards = [];
  for (const s of [-1, 1]) {
    for (let j = 0; j < PER_SIDE; j++) {
      const k = j * 2 + (s > 0 ? 1 : 0);
      const tone = palette[(j + (s > 0 ? 1 : 0)) % palette.length];
      const drop = TL.drop0 + k * STEP;
      const restZ = j * 1.5;
      const stackZ = k * 1.5;
      const arch = 15 * Math.sin((Math.PI * (k + 0.5)) / N); // bridge curvature for this card
      const lift = 8;
      cards.push(
        <motion.div
          key={`${s}-${j}`}
          className="absolute left-1/2 top-1/2 rounded-[10px]"
          style={{
            width: CARD_W,
            height: CARD_H,
            marginLeft: -CARD_W / 2,
            marginTop: -CARD_H / 2,
            background: `linear-gradient(155deg, ${tone.from}, ${tone.to})`,
            boxShadow: "0 0 0 0.5px rgb(0 0 0 / 0.18), 0 1px 2px rgb(0 0 0 / 0.18)",
            transformOrigin: s < 0 ? "100% 50%" : "0% 50%", // tilt around the inner edge
          }}
          initial={{ opacity: 0, x: s * 170, z: restZ }}
          animate={
            reduce
              ? { opacity: 1, x: 0, z: stackZ }
              : {
                  opacity: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
                  x: [s * 170, s * HALF_X, s * HALF_X, s * HALF_X, 0, 0, 0, 0, 0, 0],
                  z: [restZ, restZ, restZ + lift, restZ + lift, stackZ, stackZ, stackZ + 10 + arch * 0.4, stackZ + 2, stackZ + 7, stackZ],
                  rotateY: [0, 0, s * 17, s * 17, 0, 0, 0, 0, 0, 0],
                  rotateX: [0, 0, 0, 0, 0, 0, -arch, 0, 0, 0],
                }
          }
          transition={{
            duration: T,
            times: frac([0, TL.slide, TL.grip, drop - 0.02, drop + 0.07, TL.bridge - 0.05, TL.bridge + 0.15, TL.bridgeEnd, TL.tap - 0.04 + 0.04, T]),
            ease: "easeInOut",
          }}
        >
          <div className="absolute inset-[5px] rounded-[7px] border border-white/40" />
        </motion.div>
      );
    }
  }

  const hand = (s) => (
    <motion.div
      key={s}
      className="absolute left-1/2 top-1/2"
      style={{ marginLeft: -66, marginTop: -26, zIndex: 40, transformOrigin: "50% 100%" }}
      initial={{ x: s * 230, y: 90, opacity: 0 }}
      animate={
        reduce
          ? { opacity: 0 }
          : {
              x: [s * 230, s * 112, s * 112, s * 104, s * 92, s * 92, s * 112, s * 230],
              y: [90, 52, 42, 44, 36, 44, 52, 100],
              rotate: [0, 0, s * 6, s * 3, s * 8, s * 2, 0, 0],
              opacity: [0, 1, 1, 1, 1, 1, 1, 0],
            }
      }
      transition={{
        duration: T,
        times: frac([0, TL.slide, TL.grip, lastDrop, TL.bridge + 0.1, TL.bridgeEnd, TL.tap, T]),
        ease: "easeInOut",
      }}
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
      <div className="relative h-[300px] w-full max-w-[360px]" style={{ perspective: 1100 }}>
        {/* contact shadow on the table */}
        <motion.div
          aria-hidden
          className="absolute left-1/2 top-1/2 h-[96px] w-[250px] -translate-x-1/2 -translate-y-1/2 rounded-[50%]"
          style={{ background: "radial-gradient(closest-side, rgb(31 36 51 / 0.26), transparent)", marginTop: 14 }}
          animate={reduce ? undefined : { scaleX: [1.25, 1, 1, 0.8, 0.9, 0.85, 0.8], opacity: [0, 0.8, 0.8, 1, 0.8, 1, 1] }}
          transition={{ duration: T, times: frac([0, TL.slide, TL.grip, TL.bridge, TL.bridgeEnd, TL.tap, T]), ease: "easeInOut" }}
        />
        <div className="absolute inset-0" style={{ transformStyle: "preserve-3d", transform: "rotateX(54deg)" }}>
          {cards}
        </div>
        {[-1, 1].map(hand)}
      </div>
      <motion.p
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="mt-3 font-display text-[22px] text-ink-soft"
      >
        מערבבים את החפיסה…
      </motion.p>
      <p className="mt-1 text-[12px] text-muted">הקישו לדילוג</p>
    </button>
  );
}
