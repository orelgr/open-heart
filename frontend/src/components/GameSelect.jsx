import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { Button, IconButton, Screen, TopBar } from "./ui.jsx";
import { iconFor, toneOf } from "../lib/icons.js";
import { buildDeck, CLASSIC } from "../lib/deck.js";
import { navigate } from "../lib/router.js";

/** Short feature chips under each mini-game ("20 קלפים", "טיימר 20 שנ׳", "ניקוד"). */
const chipsOf = (g, count) => [
  `${count} שאלות`,
  g.seconds && `טיימר ${g.seconds} שנ׳`,
  g.score && "ניקוד",
  g.power === "none" ? "בלי קלפי כוח" : g.power === "all" && "קלפי כוח",
].filter(Boolean);

/** Pick a mini-game. Questions always come from every category, so there is nothing else to choose. */
export default function GameSelect({ content, answered, gameId, setGameId, onStart }) {
  const games = content.games?.length ? content.games : [{ ...CLASSIC, title: "שיחה פתוחה", subtitle: "", icon: "Shuffle", tone: "gold" }];
  // Questions already checked off are out of the deck until unchecked on the "answered" page.
  const counts = Object.fromEntries(games.map((g) => [g.id, buildDeck(content, g, answered).filter((c) => c.kind === "question").length]));
  const current = games.find((g) => g.id === gameId) ?? games[0];
  const count = counts[current.id];

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
      <div className="flex-1 overflow-y-auto px-5 pb-4">
        <h1 className="mt-4 font-display text-[36px] leading-tight">מה משחקים?</h1>
        <p className="mb-6 mt-1 text-[15px] text-muted">בחרו משחקון. השאלות מגיעות מכל העולמות.</p>
        <div className="grid gap-3" role="radiogroup" aria-label="משחקונים">
          {games.map((g, i) => {
            const on = g.id === current.id;
            const tone = toneOf(g.tone);
            const Icon = iconFor(g.icon);
            return (
              <motion.button
                key={g.id}
                role="radio"
                aria-checked={on}
                data-testid={`game-${g.id}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.22 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setGameId(g.id)}
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
                  <p className="text-[16px] font-semibold leading-snug">{g.title}</p>
                  {g.subtitle && <p className="text-[14px] leading-snug text-muted">{g.subtitle}</p>}
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {chipsOf(g, counts[g.id]).map((c) => (
                      <span key={c} className="rounded-full bg-ink/6 px-2 py-0.5 text-[12px] font-medium text-ink-soft">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
                <div
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                    on ? "border-ink" : "border-ink/20"
                  }`}
                >
                  {on && <span className="size-3.5 rounded-full bg-ink" />}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
      <div className="px-5 pt-3">
        <Button className="w-full disabled:opacity-40" disabled={!count} onClick={onStart} data-testid="play">
          {count ? `מתחילים · ${current.title}` : "עניתם על כל הקלפים כאן"}
        </Button>
      </div>
    </Screen>
  );
}
