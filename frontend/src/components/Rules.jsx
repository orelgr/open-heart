import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Heart, X } from "lucide-react";
import { Button, IconButton, Screen, TopBar } from "./ui.jsx";
import { iconFor } from "../lib/icons.js";
import { navigate } from "../lib/router.js";

/** Shared rules body - used by the Rules page and the in-game sheet. */
export function RulesContent({ content, dense = false }) {
  const { rules, powerCards } = content;
  const uniquePowers = [...new Map(powerCards.map((p) => [p.title, p])).values()];

  return (
    <div className={`flex flex-col ${dense ? "gap-6" : "gap-8"}`}>
      <p className="text-[17px] leading-relaxed text-ink-soft">{rules.intro}</p>

      <section className="grid gap-3">
        {rules.steps.map((s, i) => {
          const Icon = iconFor(s.icon);
          return (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i, duration: 0.25 }}
              className="glass flex gap-4 rounded-3xl p-4"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-ink text-white">
                <Icon size={20} strokeWidth={1.8} />
              </div>
              <div>
                <h3 className="text-[16px] font-semibold">
                  <span className="text-gold">{i + 1}. </span>
                  {s.title}
                </h3>
                <p className="mt-0.5 text-[15px] leading-relaxed text-muted">{s.text}</p>
              </div>
            </motion.div>
          );
        })}
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-muted">קלפי הכוח</h2>
        <p className="mb-3 text-[15px] text-ink-soft">{rules.powerIntro}</p>
        <div className="overflow-hidden rounded-3xl bg-night text-white">
          {uniquePowers.map((p, i) => {
            const Icon = iconFor(p.icon);
            return (
              <div key={p.id} className={`flex items-start gap-3 px-4 py-3.5 ${i ? "border-t border-white/8" : ""}`}>
                <Icon size={18} className="mt-0.5 shrink-0 text-gold-soft" strokeWidth={1.8} />
                <div>
                  <p className="text-[15px] font-medium">{p.title}</p>
                  <p className="text-[14px] leading-relaxed text-white/60">{p.type === "challenge" ? "משימה קצרה מול שעון של 10 שניות." : p.type === "guess" ? "אחד מנחש מה השני יענה, ורק אז השני עונה. מי קרוב יותר?" : p.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-muted">כללי הכבוד</h2>
        <ul className="glass divide-y divide-hairline rounded-3xl">
          {rules.etiquette.map((e) => (
            <li key={e} className="flex items-center gap-3 px-4 py-3.5 text-[15px]">
              <Heart size={14} className="shrink-0 text-gold" strokeWidth={2} />
              {e}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function RulesPage({ content }) {
  return (
    <Screen className="!px-0">
      <div className="px-5">
        <TopBar
          right={
            <IconButton label="חזרה" onClick={() => history.length > 1 ? history.back() : navigate("/")}>
              <ChevronRight size={22} />
            </IconButton>
          }
        />
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-6">
        <h1 className="mb-1 mt-4 font-display text-[40px] leading-tight">איך משחקים</h1>
        <p className="mb-6 text-[15px] text-muted">כמה דקות של קריאה, לשיחה של שעות.</p>
        <RulesContent content={content} />
      </div>
      <div className="px-5 pt-3">
        <Button className="w-full" onClick={() => navigate("/select")}>
          בואו נתחיל
        </Button>
      </div>
    </Screen>
  );
}

/** Bottom sheet (iOS-style) with the rules, opened from the floating button in-game. */
export function RulesSheet({ open, onClose, content }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="חוקי המשחק"
            data-testid="rules-sheet"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-[32px] bg-canvas/95 shadow-2xl backdrop-blur-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, i) => (i.offset.y > 120 || i.velocity.y > 600) && onClose()}
          >
            <div className="flex justify-center pt-2.5">
              <div className="h-1.5 w-10 rounded-full bg-ink/15" />
            </div>
            <div className="flex items-center justify-between px-5 pb-2 pt-3">
              <h2 className="font-display text-[26px]">חוקי המשחק</h2>
              <IconButton label="סגירה" onClick={onClose} data-testid="rules-close">
                <X size={20} />
              </IconButton>
            </div>
            <div className="overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),24px)]" onPointerDownCapture={(e) => e.stopPropagation()}>
              <RulesContent content={content} dense />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
