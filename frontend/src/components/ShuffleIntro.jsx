import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Zap } from "lucide-react";
import { LogoMark } from "./Logo.jsx";
import { toneOf } from "../lib/icons.js";

/**
 * Two-act shuffle, ~4.7 s (tap anywhere to skip):
 *   1. Riffle - on a 3D table the deck splits in two, the inner corners lift and the cards cascade
 *                alternately into one stack, which is squared and then lifted up to face the viewer.
 *   2. Helix - the stack blooms into a spinning helix around the logo, colours weave together,
 *                then it spirals back into one stack with a golden pulse.
 * Dark power cards are mixed into both acts. Each act is one shared timeline (seconds).
 */
const N = 14;
const isPower = (k) => k % 4 === 2;

function CardFace({ tone, power, logo }) {
  if (power) {
    return (
      <div className="relative size-full rounded-[inherit] bg-night" style={{ boxShadow: "0 0 0 0.5px rgb(0 0 0 / 0.3), 0 3px 8px rgb(31 36 51 / 0.25)" }}>
        <div className="absolute inset-[8%] rounded-[6px] border border-gold-soft/45" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Zap size={logo * 0.8} strokeWidth={1.6} className="text-gold-soft" />
        </div>
      </div>
    );
  }
  return (
    <div
      className="relative size-full rounded-[inherit]"
      style={{ background: `linear-gradient(155deg, ${tone.from}, ${tone.to})`, boxShadow: "0 0 0 0.5px rgb(0 0 0 / 0.16), 0 3px 8px rgb(31 36 51 / 0.18)" }}
    >
      <div className="absolute inset-[6%] rounded-[6px] border border-white/45" />
      <div className="absolute inset-0 flex items-center justify-center opacity-80">
        <LogoMark size={logo} />
      </div>
    </div>
  );
}

/* ---------------------------- Act 1: riffle ---------------------------- */
/*
 * Cards are NOT in a shared 3D context: each card carries its own perspective + table tilt, and the
 * layering is explicit (zIndex). That guarantees the order the eye expects, with no plane intersections:
 *   cards still in hand (100+)  >  card currently falling (between)  >  the pile (0..N-1, last drop on top).
 * The halves are lifted and spread apart so the pile in the middle is visible while it grows card over card.
 */
const R1 = { T: 2.2, slide: 0.35, grip: 0.6, drop0: 0.68, step: 0.052, push: 1.46, tap: 1.56, lift: 1.72 };
const SPREAD = 74; // half-deck centre offset; leaves the middle of the table open for the pile
const TILT = 50; // table tilt (rotateX) while on the table
const RIFFLE_W = 104;
const RIFFLE_H = 146;

function Riffle({ palette, onDone }) {
  useEffect(() => {
    const id = setTimeout(onDone, R1.T * 1000);
    const ticks = [];
    if (navigator.vibrate) {
      for (let k = 0; k < N; k++) ticks.push(setTimeout(() => navigator.vibrate(3), (R1.drop0 + k * R1.step + 0.08) * 1000));
      ticks.push(setTimeout(() => navigator.vibrate(12), R1.tap * 1000));
    }
    return () => {
      clearTimeout(id);
      ticks.forEach(clearTimeout);
    };
  }, [onDone]);

  const f = (arr) => arr.map((t) => Math.min(t / R1.T, 1));
  const cards = [];
  for (const s of [-1, 1]) {
    for (let j = 0; j < N / 2; j++) {
      // released from the bottom of each half, alternating left/right
      const k = j * 2 + (s > 0 ? 1 : 0);
      const d = R1.drop0 + k * R1.step;
      const handY = -j * 1.6; // thickness of the half in hand
      const pileY = 22 - k * 1.4; // the pile grows upward, in front of the halves
      const pileX = s * 7; // alternate sides stay slightly offset so the interleave reads
      const hinge = s < 0 ? 0 : 1;
      cards.push(
        <motion.div
          key={k}
          className="absolute left-1/2 top-1/2 rounded-[10px]"
          style={{
            width: RIFFLE_W,
            height: RIFFLE_H,
            marginLeft: -RIFFLE_W / 2,
            marginTop: -RIFFLE_H / 2,
            transformPerspective: 900,
            originY: 0.5,
          }}
          initial={{ opacity: 0, x: s * 190, y: handY, rotateX: TILT, rotateY: 0, scale: 1, zIndex: 100 + j, originX: s < 0 ? 0 : 1 }}
          animate={{
            opacity: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            x: [s * 190, s * SPREAD, s * SPREAD, s * SPREAD, pileX, pileX, 0, 0, 0, 0],
            y: [handY, handY, handY - 30, handY - 30, pileY, pileY, pileY, pileY - 8, pileY, -k * 1.3], // ends exactly on the helix start pose
            rotateY: [0, 0, s * 16, s * 16, 0, 0, 0, 0, 0, 0],
            rotateX: [TILT, TILT, TILT, TILT, TILT, TILT, TILT, TILT, TILT, 0],
            scale: [1, 1, 1, 1, 1, 1, 1, 1, 1, 0.62],
            // in hand above everything, then onto the pile in drop order (each new card lands on top)
            zIndex: [100 + j, 100 + j, 100 + j, 100 + j, k, k, k, k, k, k],
            // hinge on the outer edge while in hand (the inner corner lifts); back to the centre once the halves
            // are pushed together, otherwise the final shrink would pull each half toward its own edge and split the deck
            originX: [hinge, hinge, hinge, hinge, hinge, hinge, 0.5, 0.5, 0.5, 0.5],
          }}
          transition={{
            duration: R1.T,
            times: f([0, R1.slide, R1.grip, d, d + 0.1, R1.push, R1.push + 0.08, R1.tap, R1.lift, R1.T]),
            ease: "easeInOut",
          }}
        >
          {/* the top card of both halves shares one colour, so the deck reads as one deck being split */}
          <CardFace tone={palette[(j === N / 2 - 1 ? 0 : k) % palette.length]} power={isPower(k)} logo={34} />
        </motion.div>
      );
    }
  }

  return (
    <>
      {/* contact shadow on the table */}
      <motion.div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-[96px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-[50%]"
        style={{ background: "radial-gradient(closest-side, rgb(31 36 51 / 0.24), transparent)", marginTop: 30 }}
        animate={{ scaleX: [1.25, 1, 1, 0.7, 0.7, 0.4], opacity: [0, 0.8, 0.8, 1, 1, 0] }}
        transition={{ duration: R1.T, times: f([0, R1.slide, R1.grip, R1.tap, R1.lift, R1.T]), ease: "easeInOut" }}
      />
      {cards}
    </>
  );
}

/* ---------------------------- Act 2: helix ---------------------------- */
const T2 = 2.6;
const RADIUS = 118;
const HELIX_W = 64;
const HELIX_H = 90;

function Helix({ palette, onDone, play }) {
  useEffect(() => {
    if (!play) return;
    const id = setTimeout(onDone, T2 * 1000 + 80);
    const ticks = [];
    if (navigator.vibrate) {
      ticks.push(setTimeout(() => navigator.vibrate(8), 250));
      ticks.push(setTimeout(() => navigator.vibrate([6, 30, 14]), 2150));
    }
    return () => {
      clearTimeout(id);
      ticks.forEach(clearTimeout);
    };
  }, [onDone, play]);

  const f = (arr) => arr.map((t) => Math.min(t / T2, 1));
  const cards = Array.from({ length: N }, (_, i) => {
    const angle = (i * 360) / N;
    const out0 = 0.15 + i * 0.025;
    const out1 = out0 + 0.6;
    const in0 = 1.55 + (N - 1 - i) * 0.022;
    const in1 = in0 + 0.5;
    const helixY = (i - (N - 1) / 2) * 7;
    const stackY = -i * 1.3;
    // stacked cards get a small depth step: identical depth in a shared 3D scene makes the browser
    // flip between them every frame (z-fighting), which showed up as a flicker right after the riffle
    const restZ = i * 0.6;
    return (
      <motion.div
        key={i}
        className="absolute left-1/2 top-1/2"
        style={{ width: HELIX_W, height: HELIX_H, marginLeft: -HELIX_W / 2, marginTop: -HELIX_H / 2, transformStyle: "preserve-3d" }}
        initial={{ rotateY: 0, y: stackY }}
        animate={play ? { rotateY: [0, 0, angle, angle, 0, 0], y: [stackY, stackY, helixY, helixY, stackY, stackY] } : undefined}
        transition={{ duration: T2, times: f([0, out0, out1, in0, in1, T2]), ease: "easeInOut" }}
      >
        <motion.div
          className="size-full rounded-[9px]"
          initial={{ z: restZ }}
          animate={play ? { z: [restZ, restZ, RADIUS, RADIUS, restZ, restZ] } : undefined}
          transition={{ duration: T2, times: f([0, out0, out1, in0, in1, T2]), ease: "easeInOut" }}
        >
          <CardFace tone={palette[(i === N - 1 ? 0 : i) % palette.length]} power={isPower(i)} logo={26} />
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
        animate={play ? { x: Math.cos(a) * 96, y: Math.sin(a) * 70, opacity: [0, 1, 0], scale: [0, 1.2, 0] } : undefined}
        transition={{ delay: 2.15, duration: 0.6, ease: "easeOut" }}
      />
    );
  });

  return (
    <>
      <motion.div
        aria-hidden
        className="absolute left-1/2 top-1/2 size-[190px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(closest-side, rgb(216 190 140 / 0.55), transparent)" }}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={play ? { scale: [0.5, 0.5, 1.15, 1.15, 0.7, 1.5], opacity: [0, 0, 0.9, 0.9, 0.5, 0] } : undefined}
        transition={{ duration: T2, times: f([0, 0.15, 0.9, 1.55, 2.1, T2]), ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={play ? { opacity: [0, 0, 1, 1, 0, 0], scale: [0.7, 0.7, 1, 1, 0.8, 0.8] } : undefined}
        transition={{ duration: T2, times: f([0, 0.3, 0.9, 1.55, 2.0, T2]), ease: "easeInOut" }}
      >
        <LogoMark size={56} />
      </motion.div>
      <motion.div
        className="absolute inset-0"
        style={{ transformStyle: "preserve-3d" }}
        initial={{ rotateX: 0, rotateY: 0 }}
        animate={play ? { rotateY: [0, 0, 720, 720], rotateX: [0, -14, -14, 0] } : undefined}
        transition={{
          rotateY: { duration: T2, times: f([0, 0.2, 2.35, T2]), ease: "easeInOut" },
          rotateX: { duration: T2, times: f([0, 0.75, 2.0, T2]), ease: "easeInOut" },
        }}
      >
        {cards}
      </motion.div>
      <motion.div
        aria-hidden
        className="absolute left-1/2 top-1/2 size-[150px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold-soft"
        initial={{ scale: 0.2, opacity: 0 }}
        animate={play ? { scale: [0.2, 1.6], opacity: [0.9, 0] } : undefined}
        transition={{ delay: 2.1, duration: 0.55, ease: "easeOut" }}
      />
      {sparkles}
    </>
  );
}

export default function ShuffleIntro({ tones, onDone }) {
  const reduce = useReducedMotion();
  const [act, setAct] = useState("riffle");
  const toHelix = useCallback(() => setAct("helix"), []);
  const palette = (tones.length ? tones : ["sand"]).map(toneOf);

  useEffect(() => {
    if (!reduce) return;
    const id = setTimeout(onDone, 250);
    return () => clearTimeout(id);
  }, [reduce, onDone]);

  return (
    <button
      type="button"
      onClick={onDone}
      aria-label="מערבבים את החפיסה. הקישו לדילוג"
      data-testid="shuffle"
      data-act={act}
      className="absolute inset-0 flex flex-col items-center justify-center"
    >
      <div className="relative h-[320px] w-full max-w-[360px]">
        {/* Both acts are mounted up front and swapped by visibility in one frame: mounting the helix at the
            hand-off cost ~100 ms of main thread, which dropped frames and read as a flicker. */}
        {!reduce && (
          <>
            <div className="absolute inset-0" style={{ visibility: act === "riffle" ? "visible" : "hidden" }}>
              <Riffle palette={palette} onDone={toHelix} />
            </div>
            <div className="absolute inset-0" style={{ visibility: act === "helix" ? "visible" : "hidden", perspective: 1050 }}>
              <Helix palette={palette} onDone={onDone} play={act === "helix"} />
            </div>
          </>
        )}
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
