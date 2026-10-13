import { useRef, useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Zap } from "lucide-react";
import { LogoMark } from "./Logo.jsx";
import Timer from "./Timer.jsx";
import { iconFor, toneOf } from "../lib/icons.js";

const SWIPE_DISTANCE = 110;
const SWIPE_VELOCITY = 600;
const flipSpring = { type: "spring", stiffness: 260, damping: 26 };

const variants = {
  enter: { scale: 0.94, y: 16, opacity: 1 },
  center: { scale: 1, y: 0, opacity: 1, transition: { type: "spring", stiffness: 320, damping: 30 } },
  exit: (dir) => ({
    x: dir * 520,
    rotate: dir * 16,
    opacity: 0,
    transition: { duration: 0.32, ease: [0.32, 0.72, 0, 1] },
  }),
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

/** Top card of the deck: tap to flip (3D), drag horizontally to swipe away. */
export default function Card({ item, onSwipe }) {
  const [flipped, setFlipped] = useState(false);
  const ignoreTap = useRef(false);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-240, 240], [-14, 14]);

  return (
    <motion.div
      className="absolute inset-0 touch-pan-y"
      style={{ x, rotate, perspective: 1400 }}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      drag="x"
      dragSnapToOrigin
      dragElastic={0.9}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > SWIPE_DISTANCE || Math.abs(info.velocity.x) > SWIPE_VELOCITY) {
          onSwipe(Math.sign(info.offset.x || info.velocity.x));
        }
      }}
      onPointerDownCapture={(e) => {
        ignoreTap.current = !!e.target.closest?.("[data-no-flip]");
      }}
      onTap={() => {
        if (ignoreTap.current) return;
        setFlipped((f) => !f);
        navigator.vibrate?.(8);
      }}
      data-testid="card"
      data-flipped={flipped}
      data-kind={item.kind}
      role="button"
      aria-label={flipped ? "קלף גלוי" : "הקישו כדי לחשוף את הקלף"}
    >
      <motion.div
        className="preserve-3d relative size-full rounded-[var(--radius-card)] shadow-[var(--shadow-card)]"
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={flipSpring}
      >
        <CardBack item={item} hidden={flipped} />
        <CardFront item={item} isTop />
      </motion.div>
    </motion.div>
  );
}
