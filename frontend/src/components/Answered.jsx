import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronRight, Lightbulb, RotateCcw } from "lucide-react";
import { Button, IconButton, Screen, TopBar } from "./ui.jsx";
import { LogoMark } from "./Logo.jsx";
import { answerableCards } from "../lib/cards.js";
import { toneOf } from "../lib/icons.js";
import { navigate } from "../lib/router.js";

/** Cards the couple checked off. Unchecking puts a card back in the deck; it stays listed (unchecked)
 *  until leaving the page, so an accidental tap can be undone. */
export default function AnsweredPage({ content, answered, setCardAnswered, onReset }) {
  const seen = useRef(new Set());
  answered.forEach((k) => seen.current.add(k));
  const [confirmReset, setConfirmReset] = useState(false);

  const all = answerableCards(content);
  const items = [...seen.current].filter((k) => all.has(k));
  const groups = [
    ...content.categories.map((c) => ({ id: c.id, title: c.title, tone: c.tone, keys: items.filter((k) => all.get(k).category?.id === c.id) })),
    { id: "guess", title: "מה יענה?", tone: null, keys: items.filter((k) => all.get(k).kind === "power") },
  ].filter((g) => g.keys.length);

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
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <h1 className="mt-2 font-display text-[34px] leading-tight">הקלפים שעניתם</h1>
        <p className="mt-1 text-[15px] text-muted">
          {answered.size ? `${answered.size} קלפים יצאו מהחבילה. לחצו על ✓ כדי להחזיר קלף למשחק.` : "כאן יופיעו הקלפים שסימנתם ב-✓ במהלך המשחק."}
        </p>

        {!items.length && (
          <div className="glass mt-8 flex flex-col items-center gap-3 rounded-3xl p-8 text-center">
            <LogoMark size={52} />
            <p className="text-[15px] leading-relaxed text-muted">עוד לא סימנתם קלפים. אחרי שעניתם על קלף במשחק, לחצו ✓ והוא יעבור לכאן.</p>
          </div>
        )}

        <div className="mt-6 grid gap-6" data-testid="answered-list">
          {groups.map((g) => {
            const tone = g.tone && toneOf(g.tone);
            return (
              <section key={g.id}>
                <h2 className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-ink-soft">
                  {tone ? <span className="size-2 rounded-full" style={{ background: tone.to }} /> : <Lightbulb size={14} className="text-gold" />}
                  {g.title}
                </h2>
                <div className="grid gap-2">
                  {g.keys.map((k, i) => {
                    const card = all.get(k);
                    const on = answered.has(k);
                    return (
                      <motion.div
                        key={k}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: on ? 1 : 0.55, y: 0 }}
                        transition={{ delay: Math.min(i, 10) * 0.02, duration: 0.2 }}
                        className="glass flex items-center gap-3 rounded-2xl p-3.5"
                        data-testid={`answered-${k}`}
                      >
                        <p className="min-w-0 flex-1 font-display text-[17px] leading-snug">{card.text}</p>
                        <motion.button
                          whileTap={{ scale: 0.86 }}
                          onClick={() => setCardAnswered(k, !on)}
                          aria-pressed={on}
                          aria-label={on ? "ביטול הסימון, הקלף יחזור לחבילה" : "סימון מחדש כנענה"}
                          className={`flex size-11 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
                            on ? "border-sage bg-sage text-white" : "border-ink/20 text-ink/30"
                          }`}
                          data-testid="answered-toggle"
                        >
                          <Check size={20} strokeWidth={2.4} />
                        </motion.button>
                      </motion.div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>

        {answered.size > 0 &&
          (confirmReset ? (
            <div className="glass mt-8 grid gap-2 rounded-3xl p-4 text-center">
              <p className="text-[15px] text-ink-soft">להחזיר את כל הקלפים לחבילה?</p>
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => { onReset(); setConfirmReset(false); }} data-testid="reset-confirm">כן, להחזיר</Button>
                <Button variant="ghost" onClick={() => setConfirmReset(false)}>ביטול</Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" className="mt-6 w-full" onClick={() => setConfirmReset(true)}>
              <RotateCcw size={17} />
              להחזיר את כל הקלפים
            </Button>
          ))}
      </div>
    </Screen>
  );
}
