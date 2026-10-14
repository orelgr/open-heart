import { useRef, useState } from "react";
import { motion, useAnimate, useMotionValue, useMotionValueEvent, useTransform } from "framer-motion";
import { Zap } from "lucide-react";
import { LogoMark } from "./Logo.jsx";
import Timer from "./Timer.jsx";
import { iconFor, toneOf } from "../lib/icons.js";

const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 600;
const flipSpring = { type: "spring", stiffness: 520, damping: 36, mass: 0.8 };
const settle = { type: "spring", stiffness: 560, damping: 38, mass: 0.7 };
const OFF = () => (typeof window === "undefined" ? 600 : Math.max(window.innerWidth, 420) + 160);

/** Resting pose for each layer of the stack (0 = top). */
const layer = (depth) => ({
  x: 0,
  y: depth * 14,
  scale: 1 - depth * 0.05,
  rotate: 0,
  opacity: depth > 2 ? 0 : 1,
  filter: `brightness(${1 - depth * 0.05})`,
});

/**
 * nav = { mode: "start" | "next" | "back", dir: -1 | 1, dragged: bool, backFrom: -1 | 1 }
 * Shared by AnimatePresence (exits) and each card (enters), so every move has a coherent choreography.
 */
const variants = {
  initial: (nav) => {
    if (nav.mode === "start") return { y: 260, scale: 0.9, rotate: -6, opacity: 0, filter: "brightness(1)" };
    if (nav.mode === "back") return { x: nav.backFrom * OFF(), y: -30, rotate: nav.backFrom * 24, scale: 1, opacity: 1, filter: "brightness(1)" };
    return { ...layer(3), y: 54, scale: 0.84 }; // new card slides in at the bottom of the stack
  },
  rest: ({ depth, nav }) => ({
    ...layer(depth),
    transition:
      nav.mode === "start"
        ? { type: "spring", stiffness: 300, damping: 26, delay: 0.04 + (2 - depth) * 0.06 }
        : { ...settle, delay: nav.mode === "next" ? depth * 0.015 : 0 },
  }),
  exit: (nav) => {
    if (nav.mode === "back") return { ...layer(3), y: 54, scale: 0.84, transition: { duration: 0.16 } };
    const d = nav.dir;
    return nav.dragged
      ? // Thrown: keep the momentum, arc slightly upward and spin out.
        { zIndex: 30, x: d * OFF(), y: -50, rotate: d * 26, opacity: 1, transition: { duration: 0.26, ease: [0.2, 0.7, 0.3, 1] } }
      : // Button: a small anticipation lift, then glide off along an arc.
        {
          zIndex: 30,
          x: [null, -d * 12, d * OFF()],
          y: [null, -14, -60],
          rotate: [null, -d * 3, d * 22],
          scale: [null, 1.04, 1],
          opacity: 1,
          transition: { duration: 0.34, times: [0, 0.16, 1], ease: [0.4, 0, 0.2, 1] },
        };
  },
};

const faceBase = "absolute inset-0 overflow-hidden rounded-[var(--radius-card)] backface-hidden";

/** Card back (face-down side). */
export function CardBack({ item, hidden = false }) {
  const pe = hidden ? { pointerEvents: "none" } : undefined;
  if (item.kind === "power") {
    return (
      <div className={`${faceBase} flex flex-col items-center justify-center gap-5 bg-night text-white`} style={pe}>
        <div className="pointer-events-none absolute inset-3 rounded-[22px] border border-gold-soft/30" />
        <motion.div
          animate={{ opacity: [0.6, 1, 0.6], scale: [1, 1.06, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="flex size-20 items-center justify-center rounded-full bg-gold-soft/15"
        >
          <Zap size={36} className="text-gold-soft" strokeWidth={1.6} />
        </motion.div>
        <p className="font-display text-3xl">קלף כוח</p>
        <p className="text-sm tracking-wide text-white/55">הקישו לחשיפה</p>
      </div>
    );
  }
  const tone = toneOf(item.category.tone);
  const Icon = iconFor(item.category.icon);
  return (
    <div
      className={`${faceBase} flex flex-col items-center justify-between p-7 text-white`}
      style={{ ...pe, background: `linear-gradient(155deg, ${tone.from} 0%, ${tone.to} 100%)` }}
    >
      <div className="pointer-events-none absolute inset-3 rounded-[22px] border border-white/35" />
      <div className="flex items-center gap-2 pt-2 text-[13px] font-medium tracking-wide" style={{ color: tone.accent }}>
        <Icon size={15} strokeWidth={1.8} />
        {item.category.title}
      </div>
      <div className="flex size-28 items-center justify-center rounded-full bg-white/25 backdrop-blur-sm">
        <LogoMark size={64} />
      </div>
      <p className="pb-2 text-[13px] tracking-wide" style={{ color: tone.accent }}>
        הקישו לחשיפה
      </p>
    </div>
  );
}

function CardFront({ item, isTop }) {
  if (item.kind === "power") {
    const Icon = iconFor(item.icon);
    return (
      <div className={`${faceBase} flex flex-col items-center justify-center gap-6 bg-night px-8 text-center text-white`} style={{ transform: "rotateY(180deg)" }}>
        <div className="pointer-events-none absolute inset-3 rounded-[22px] border border-gold-soft/30" />
        <div className="flex items-center gap-2 text-[13px] font-medium tracking-[0.12em] text-gold-soft">
          <Icon size={16} strokeWidth={1.8} />
          {item.title}
        </div>
        <p className="font-display text-[26px] leading-snug">{item.text}</p>
        {item.type === "challenge" && isTop && <Timer seconds={item.seconds ?? 10} />}
      </div>
    );
  }
  const tone = toneOf(item.category.tone);
  return (
    <div className={`${faceBase} grain flex flex-col bg-[#FFFDF9] p-7`} style={{ transform: "rotateY(180deg)" }}>
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ background: tone.to }} />
        <span className="text-[13px] font-medium text-muted">{item.category.title}</span>
      </div>
      <div className="flex flex-1 items-center">
        <p className="font-display text-[28px] leading-[1.35] text-ink" data-testid="question-text">
          {item.text}
        </p>
      </div>
      <div className="flex items-center justify-between text-muted/70">
        <span className="text-[12px] tracking-[0.2em]">OPEN HEART</span>
        <LogoMark size={26} />
      </div>
    </div>
  );
}

/** One card in the stack. Only the top card (depth 0) can be dragged and flipped. */
export default function Card({ item, depth, nav, onSwipe, progress }) {
  const isTop = depth === 0;
  const [flipped, setFlipped] = useState(false);
  const ignoreTap = useRef(false);
  const leaving = useRef(false);
  const [lift, animateLift] = useAnimate();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 260], [-16, 16]);
  const glare = useTransform(x, [-200, 0, 200], [0.35, 0, 0.35]);
  // The card right behind the top one leans forward as you drag.
  const nudgeScale = useTransform(progress, [0, 1], [1, depth === 1 ? 1.045 : depth === 2 ? 1.02 : 1]);
  const nudgeY = useTransform(progress, [0, 1], [0, depth === 1 ? -10 : depth === 2 ? -5 : 0]);

  useMotionValueEvent(x, "change", (v) => {
    if (isTop && !leaving.current) progress.set(Math.min(Math.abs(v) / 160, 1));
  });

  const flip = () => {
    setFlipped((f) => !f);
    navigator.vibrate?.(8);
    // Lift off the table while turning, then settle.
    animateLift(lift.current, { scale: [1, 1.05, 1], y: [0, -8, 0] }, { duration: 0.36, ease: [0.33, 0, 0.2, 1] });
  };

  return (
    <motion.div
      className={`absolute inset-0 ${isTop ? "cursor-grab touch-pan-y active:cursor-grabbing" : "pointer-events-none"}`}
      style={{ x, rotate, zIndex: 10 - depth, perspective: 1400 }}
      custom={{ depth, nav }}
      variants={variants}
      initial="initial"
      animate="rest"
      exit="exit"
      drag={isTop ? "x" : false}
      dragSnapToOrigin
      dragElastic={0.85}
      dragTransition={{ bounceStiffness: 600, bounceDamping: 32 }}
      whileDrag={{ scale: 1.03 }}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > SWIPE_DISTANCE || Math.abs(info.velocity.x) > SWIPE_VELOCITY) {
          leaving.current = true;
          onSwipe(Math.sign(info.offset.x || info.velocity.x), true);
        }
      }}
      onPointerDownCapture={(e) => {
        ignoreTap.current = !!e.target.closest?.("[data-no-flip]");
      }}
      onTap={() => isTop && !ignoreTap.current && flip()}
      data-testid={isTop ? "card" : undefined}
      data-flipped={flipped}
      data-kind={item.kind}
      role={isTop ? "button" : undefined}
      aria-hidden={!isTop}
      aria-label={isTop ? (flipped ? "קלף גלוי" : "הקישו כדי לחשוף את הקלף") : undefined}
    >
      <motion.div className="relative size-full" style={{ scale: nudgeScale, y: nudgeY }}>
        <div ref={lift} className="relative size-full">
        <motion.div
          className={`preserve-3d relative size-full rounded-[var(--radius-card)] transition-shadow duration-300 ${
            isTop ? "shadow-[var(--shadow-card)]" : "shadow-[var(--shadow-soft)]"
          }`}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={flipSpring}
        >
          <CardBack item={item} hidden={flipped} />
          <CardFront item={item} isTop={isTop} />
        </motion.div>
        {/* Light sweep while dragging */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[var(--radius-card)] bg-[linear-gradient(115deg,transparent_30%,rgb(255_255_255/0.55)_50%,transparent_70%)] mix-blend-soft-light"
          style={{ opacity: glare }}
        />
        </div>
      </motion.div>
    </motion.div>
  );
}
