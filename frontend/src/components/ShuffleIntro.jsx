import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { toneOf } from "../lib/icons.js";
import { HandBase, HandThumb } from "./Hands.jsx";

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

  // Hands rest under the deck (base layer) with the thumb pressing on top of it (front layer).
  const handMotion = (s) =>
    reduce
      ? { opacity: 0 }
      : {
          x: [s * 230, 0, 0, -s * 8, -s * 18, -s * 18, 0, s * 230],
          y: [70, 0, -4, 0, -10, 0, 6, 80],
          opacity: [0, 1, 1, 1, 1, 1, 1, 0],
        };
  const handTransition = {
    duration: T,
    times: frac([0, TL.slide, TL.grip, lastDrop, TL.bridge + 0.1, TL.bridgeEnd, TL.tap, T]),
    ease: "easeInOut",
  };
  const hand = (s, layer) => (
    <motion.div
      key={`${layer}-${s}`}
      className="pointer-events-none absolute left-1/2 top-1/2"
      style={{ marginLeft: s < 0 ? -157 : 7, marginTop: -33, zIndex: layer === "base" ? 5 : 40 }}
      initial={{ x: s * 230, y: 70, opacity: 0 }}
      animate={handMotion(s)}
      transition={handTransition}
    >
      {layer === "base" ? <HandBase mirrored={s > 0} /> : <HandThumb mirrored={s > 0} />}
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
        {[-1, 1].map((s) => hand(s, "base"))}
        <div className="absolute inset-0" style={{ transformStyle: "preserve-3d", transform: "rotateX(54deg)", zIndex: 20 }}>
          {cards}
        </div>
        {[-1, 1].map((s) => hand(s, "thumb"))}
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
