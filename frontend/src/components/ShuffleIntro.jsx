import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { LogoMark } from "./Logo.jsx";
import { toneOf } from "../lib/icons.js";

/**
 * "Open heart" shuffle: the deck blooms into a spinning helix of cards around the logo,
 * the colours of the chosen categories weave together, then everything spirals back into one
 * stack with a golden pulse. One shared timeline (seconds), every card is staggered against it.
 */
const N = 14;
const T = 3.0;
const R = 118; // ring radius
const CARD_W = 64;
const CARD_H = 90;
const frac = (arr) => arr.map((t) => Math.min(t / T, 1));

function MiniCard({ tone }) {
  return (
    <div
      className="relative size-full rounded-[9px]"
      style={{
        background: `linear-gradient(155deg, ${tone.from}, ${tone.to})`,
        boxShadow: "0 0 0 0.5px rgb(0 0 0 / 0.16), 0 3px 8px rgb(31 36 51 / 0.2)",
      }}
    >
      <div className="absolute inset-[4px] rounded-[6px] border border-white/45" />
      <div className="absolute inset-0 flex items-center justify-center opacity-80">
        <LogoMark size={26} />
      </div>
    </div>
  );
}

export default function ShuffleIntro({ tones, onDone }) {
  const reduce = useReducedMotion();

  useEffect(() => {
    const id = setTimeout(onDone, reduce ? 250 : T * 1000 + 80);
    const ticks = [];
    if (!reduce && navigator.vibrate) {
      ticks.push(setTimeout(() => navigator.vibrate(8), 500));
      ticks.push(setTimeout(() => navigator.vibrate([6, 30, 14]), 2500));
    }
    return () => {
      clearTimeout(id);
      ticks.forEach(clearTimeout);
    };
  }, [onDone, reduce]);

  const palette = (tones.length ? tones : ["sand"]).map(toneOf);

  const cards = Array.from({ length: N }, (_, i) => {
    const tone = palette[i % palette.length];
    const angle = (i * 360) / N;
    const out0 = 0.35 + i * 0.03;
    const out1 = out0 + 0.7;
    const in0 = 1.85 + (N - 1 - i) * 0.025;
    const in1 = in0 + 0.55;
    const times = frac([0, out0, out1, in0, in1, T]);
    const helixY = (i - (N - 1) / 2) * 7;
    const stackY = -i * 1.3;
    return (
      <motion.div
        key={i}
        className="absolute left-1/2 top-1/2"
        style={{ width: CARD_W, height: CARD_H, marginLeft: -CARD_W / 2, marginTop: -CARD_H / 2, transformStyle: "preserve-3d" }}
        initial={{ rotateY: 0, y: stackY }}
        animate={
          reduce
            ? { rotateY: 0, y: stackY }
            : { rotateY: [0, 0, angle, angle, 0, 0], y: [stackY, stackY, helixY, helixY, stackY, stackY] }
        }
        transition={{ duration: T, times, ease: "easeInOut" }}
      >
        <motion.div
          className="size-full"
          initial={{ z: 0, opacity: 0, scale: 0.9 }}
          animate={
            reduce
              ? { z: 0, opacity: 1, scale: 1 }
              : { z: [0, 0, R, R, 0, 0], opacity: [0, 1, 1, 1, 1, 1], scale: [0.9, 1, 1, 1, 1, 1] }
          }
          transition={{ duration: T, times: frac([0, 0.12, out1, in0, in1, T]), ease: "easeInOut" }}
        >
          <MiniCard tone={tone} />
        </motion.div>
      </motion.div>
    );
  });

  const sparkles = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return (
      <motion.span
        key={i}
        className="absolute left-1/2 top-1/2 size-1.5 rounded-full bg-gold-soft"
        initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
        animate={reduce ? undefined : { x: Math.cos(a) * 96, y: Math.sin(a) * 70, opacity: [0, 1, 0], scale: [0, 1.2, 0] }}
        transition={{ delay: 2.55, duration: 0.6, ease: "easeOut" }}
      />
    );
  });

  return (
    <button
      type="button"
      onClick={onDone}
      aria-label="מערבבים את החפיסה. הקישו לדילוג"
      data-testid="shuffle"
      className="absolute inset-0 flex flex-col items-center justify-center"
    >
      <div className="relative h-[320px] w-full max-w-[360px]" style={{ perspective: 1000 }}>
        {/* halo behind the logo */}
        <motion.div
          aria-hidden
          className="absolute left-1/2 top-1/2 size-[190px] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(closest-side, rgb(216 190 140 / 0.55), transparent)" }}
          animate={reduce ? undefined : { scale: [0.5, 0.5, 1.15, 1.15, 0.7, 1.5], opacity: [0, 0, 0.9, 0.9, 0.5, 0] }}
          transition={{ duration: T, times: frac([0, 0.3, 1.2, 1.9, 2.5, T]), ease: "easeInOut" }}
        />
        {/* logo sits in the middle of the ring */}
        <motion.div
          aria-hidden
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          animate={reduce ? undefined : { opacity: [0, 0, 1, 1, 0, 0], scale: [0.7, 0.7, 1, 1, 0.8, 0.8] }}
          transition={{ duration: T, times: frac([0, 0.5, 1.2, 1.9, 2.4, T]), ease: "easeInOut" }}
        >
          <LogoMark size={56} />
        </motion.div>

        {/* the helix */}
        <motion.div
          className="absolute inset-0"
          style={{ transformStyle: "preserve-3d", rotateX: -14 }}
          animate={reduce ? undefined : { rotateY: [0, 0, 720, 720] }}
          transition={{ duration: T, times: frac([0, 0.45, 2.7, T]), ease: "easeInOut" }}
        >
          {cards}
        </motion.div>

        {/* golden pulse + sparkles when the stack closes */}
        <motion.div
          aria-hidden
          className="absolute left-1/2 top-1/2 size-[150px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold-soft"
          initial={{ scale: 0.2, opacity: 0 }}
          animate={reduce ? undefined : { scale: [0.2, 1.6], opacity: [0.9, 0] }}
          transition={{ delay: 2.5, duration: 0.55, ease: "easeOut" }}
        />
        {sparkles}
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
