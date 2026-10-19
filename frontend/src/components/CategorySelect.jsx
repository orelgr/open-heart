import { motion } from "framer-motion";
import { Check, ChevronRight } from "lucide-react";
import { Button, IconButton, Screen, TopBar } from "./ui.jsx";
import { iconFor, toneOf } from "../lib/icons.js";
import { navigate } from "../lib/router.js";

export default function CategorySelect({ content, answered, selected, setSelected, onStart }) {
  const all = content.categories.map((c) => c.id);
  const allOn = selected.length === all.length;
  // Questions already checked off are out of the deck until unchecked on the "answered" page.
  const left = (c) => c.questions.filter((_, i) => !answered.has(`${c.id}-${i}`)).length;
  const count = content.categories.filter((c) => selected.includes(c.id)).reduce((n, c) => n + left(c), 0);
  const toggle = (id) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <Screen className="!px-0">
      <div className="px-5">
        <TopBar
          right={
            <IconButton label="חזרה" onClick={() => navigate("/")}>
              <ChevronRight size={22} />
            </IconButton>
          }
          left={
            <button className="text-[15px] font-medium text-gold" onClick={() => setSelected(allOn ? [] : all)}>
              {allOn ? "נקה" : "הכל"}
            </button>
          }
        />
      </div>
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <h1 className="mt-4 font-display text-[36px] leading-tight">על מה נדבר?</h1>
        <p className="mb-6 mt-1 text-[15px] text-muted">בחרו עולם אחד או כמה. נתחיל מהקליל ונעמיק בהדרגה.</p>
        <div className="grid gap-3">
          {content.categories.map((c, i) => {
            const on = selected.includes(c.id);
            const tone = toneOf(c.tone);
            const Icon = iconFor(c.icon);
            return (
              <motion.button
                key={c.id}
                data-testid={`cat-${c.id}`}
                aria-pressed={on}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.22 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggle(c.id)}
                className={`glass flex items-center gap-4 rounded-3xl p-3.5 text-right transition-[box-shadow,background-color] duration-200 ${
                  on ? "!bg-white/90 ring-2 ring-ink/80" : ""
                }`}
              >
                <div
                  className="flex size-14 shrink-0 items-center justify-center rounded-2xl"
                  style={{ background: `linear-gradient(155deg, ${tone.from}, ${tone.to})`, color: tone.accent }}
                >
                  <Icon size={24} strokeWidth={1.7} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-semibold leading-snug">{c.title}</p>
                  <p className="text-[14px] text-muted">
                    {c.subtitle} · {left(c) === c.questions.length ? `${c.questions.length} שאלות` : `נשארו ${left(c)} מתוך ${c.questions.length}`}
                  </p>
                </div>
                <div
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    on ? "border-ink bg-ink text-white" : "border-ink/20"
                  }`}
                >
                  {on && <Check size={16} strokeWidth={2.5} />}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
      <div className="px-5 pt-3">
        <Button className="w-full disabled:opacity-40" disabled={!count} onClick={onStart} data-testid="play">
          {!selected.length ? "בחרו לפחות עולם אחד" : count ? `מתחילים · ${count} קלפים` : "עניתם על כל הקלפים כאן"}
        </Button>
      </div>
    </Screen>
  );
}
