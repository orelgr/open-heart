import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { Button, Screen } from "./ui.jsx";
import { LogoMark } from "./Logo.jsx";
import { toneOf } from "../lib/icons.js";
import { navigate } from "../lib/router.js";

const fan = [
  { rotate: -12, x: -58, y: 10, tone: "sage" },
  { rotate: 12, x: 58, y: 10, tone: "sky" },
  { rotate: 0, x: 0, y: 0, tone: null },
];

export default function Home({ content }) {
  const total = content?.categories.reduce((n, c) => n + c.questions.length, 0) ?? 0;

  return (
    <Screen className="items-center justify-between text-center">
      <div />
      <div className="flex flex-col items-center">
        {/* Fanned deck */}
        <div className="relative mb-10 h-[210px] w-[150px]">
          {fan.map((f, i) => {
            const tone = f.tone && toneOf(f.tone);
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30, rotate: 0, x: 0 }}
                animate={{ opacity: 1, y: f.y, rotate: f.rotate, x: f.x }}
                transition={{ type: "spring", stiffness: 140, damping: 18, delay: 0.05 + i * 0.07 }}
                className="absolute inset-0 flex items-center justify-center rounded-[22px] shadow-[var(--shadow-card)]"
                style={
                  tone
                    ? { background: `linear-gradient(155deg, ${tone.from}, ${tone.to})` }
                    : { background: "#FFFDF9" }
                }
              >
                <div className="absolute inset-2 rounded-[16px] border border-black/5" />
                {!tone && (
                  <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
                    <LogoMark size={72} />
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="font-display text-[46px] font-medium leading-none tracking-[-0.01em]"
        >
          לבבות פתוחים
        </motion.h1>
        <p className="mt-2 text-[11px] font-medium tracking-[0.42em] text-gold">OPEN HEART</p>
        <p className="mt-5 max-w-[300px] text-[17px] leading-relaxed text-muted">
          קלפי שיחה לשניים
          <br />
          להכיר, להעמיק, לצחוק ולבנות יחד.
        </p>
        {content && (
          <p className="mt-4 text-[13px] text-muted/80" data-testid="home-stats">
            {total} שאלות · {content.categories.length} עולמות · קלפי כוח
          </p>
        )}
      </div>

      <div className="flex w-full flex-col gap-3">
        <Button onClick={() => navigate("/select")} data-testid="start">
          בואו נתחיל
        </Button>
        <Button variant="glass" onClick={() => navigate("/rules")} data-testid="open-rules">
          <BookOpen size={18} strokeWidth={1.8} />
          איך משחקים
        </Button>
      </div>
    </Screen>
  );
}
