import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, animate, motion, useMotionValue } from "framer-motion";
import { BookOpen, ChevronRight, Flag, LayoutGrid, RotateCcw, Undo2 } from "lucide-react";
import Card from "./Card.jsx";
import ShuffleIntro from "./ShuffleIntro.jsx";
import { RulesSheet } from "./Rules.jsx";
import { ReportSheet } from "./Report.jsx";
import { Button, IconButton, Screen, TopBar } from "./ui.jsx";
import { LogoMark } from "./Logo.jsx";
import { navigate } from "../lib/router.js";

export default function Game({ content, game, deck, players, answered, setCardAnswered, onRestart }) {
  const [index, setIndex] = useState(0);
  const [nav, setNav] = useState({ mode: "start", dir: -1, dragged: false, backFrom: -1 });
  const exitDirs = useRef([]);
  const progress = useMotionValue(0); // 0..1 drag distance of the top card
  const [rulesOpen, setRulesOpen] = useState(false);
  const [reportItem, setReportItem] = useState(null); // the card being reported (sheet open)
  const closeReport = useCallback(() => setReportItem(null), []);
  const [shuffling, setShuffling] = useState(true);
  const tones = [...new Set(deck.filter((c) => c.kind === "question").map((c) => c.category.tone))];
  const finishShuffle = useCallback(() => setShuffling(false), []);
  // "מה יענה?" game: a point for the guesser (the player who is not card.player) on each right guess.
  const [hits, setHits] = useState(() => new Set());
  const toggleHit = (item) =>
    setHits((s) => {
      const next = new Set(s);
      next.has(item.key) ? next.delete(item.key) : next.add(item.key);
      return next;
    });
  const score = [0, 0];
  for (const c of deck) if (hits.has(c.key) && c.player !== "both") score[1 - c.player]++;
  const nameOf = (i) => players[i]?.trim() || (i ? "שחקן/ית 2" : "שחקן/ית 1");
  const scoreLine = `${nameOf(0)} ${score[0]} · ${score[1]} ${nameOf(1)}`;
  const winner = score[0] === score[1] ? null : score[0] > score[1] ? 0 : 1;

  const done = index >= deck.length;
  const questionsTotal = deck.filter((c) => c.kind === "question").length;
  const questionsSeen = deck.slice(0, index + 1).filter((c) => c.kind === "question").length;

  const advance = useCallback(
    (d = -1, dragged = false) => {
      if (index >= deck.length) return;
      exitDirs.current[index] = d;
      setNav({ mode: "next", dir: d, dragged, backFrom: -1 });
      setIndex((i) => i + 1);
      animate(progress, 0, { type: "spring", stiffness: 300, damping: 30 });
      navigator.vibrate?.(6);
    },
    [index, deck.length, progress]
  );
  // ✓ on a card: it leaves the deck for next games and we go straight to the next card.
  const check = (item) => {
    if (answered.has(item.answerKey)) return setCardAnswered(item.answerKey, false);
    setCardAnswered(item.answerKey, true);
    advance(-1);
  };
  const back = () => {
    if (index === 0) return;
    setNav({ mode: "back", dir: 1, dragged: false, backFrom: exitDirs.current[index - 1] ?? -1 });
    setIndex((i) => i - 1);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (rulesOpen || reportItem) return;
      if (e.key === "ArrowLeft") advance(-1);
      if (e.key === "ArrowRight") advance(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, rulesOpen, reportItem]);

  return (
    <Screen>
      <TopBar
        right={
          <IconButton label="יציאה לבחירת משחקון" onClick={() => navigate("/select")}>
            <ChevronRight size={22} />
          </IconButton>
        }
        center={
          !done && (
            <span className="text-[15px] font-semibold tabular-nums" data-testid="progress">
              {Math.min(questionsSeen, questionsTotal)} מתוך {questionsTotal}
            </span>
          )
        }
        left={
          <IconButton label="קלף קודם" onClick={back} disabled={index === 0} className="disabled:opacity-30">
            <Undo2 size={19} />
          </IconButton>
        }
      />

      <div className="mt-3 h-1 overflow-hidden rounded-full bg-ink/8">
        <motion.div
          className="h-full rounded-full bg-gold"
          animate={{ width: `${(Math.min(index, deck.length) / deck.length) * 100}%` }}
          transition={{ type: "spring", stiffness: 200, damping: 30 }}
        />
      </div>

      {/* Deck */}
      <div className="relative flex flex-1 items-center justify-center py-6">
        <div className="relative aspect-[5/7] w-full max-w-[340px] max-h-full">
          {shuffling ? (
            <ShuffleIntro tones={tones} onDone={finishShuffle} />
          ) : done ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[var(--radius-card)] p-8 text-center"
              data-testid="deck-done"
            >
              <LogoMark size={64} />
              <h2 className="font-display text-[30px]">סיימתם את החפיסה</h2>
              {game.score ? (
                <div className="flex flex-col items-center gap-1" data-testid="final-score">
                  <p className="text-[17px] font-semibold tabular-nums">{scoreLine}</p>
                  <p className="text-[15px] leading-relaxed text-muted">
                    {winner == null ? "תיקו! אתם מכירים אחד את השני באותה מידה." : `${nameOf(winner)} מכיר/ה אותך הכי טוב הערב.`}
                  </p>
                </div>
              ) : (
                <p className="text-[15px] leading-relaxed text-muted">כל שיחה טובה מתחילה בשאלה אחת. תודה שהקשבתם.</p>
              )}
              <div className="mt-2 flex w-full flex-col gap-2">
                <Button onClick={() => { onRestart(); setNav({ mode: "start", dir: -1, dragged: false, backFrom: -1 }); setIndex(0); setHits(new Set()); setShuffling(true); }}>
                  <RotateCcw size={18} /> ערבוב ומשחק חדש
                </Button>
                <Button variant="ghost" onClick={() => navigate("/select")}>
                  <LayoutGrid size={18} /> משחקון אחר
                </Button>
              </div>
            </motion.div>
          ) : (
            <AnimatePresence custom={nav}>
              {deck.slice(index, index + 3).map((item, depth) => (
                <Card
                  key={item.key}
                  item={item}
                  players={players}
                  depth={depth}
                  nav={nav}
                  onSwipe={advance}
                  progress={progress}
                  checked={answered.has(item.answerKey)}
                  onCheck={check}
                  hit={hits.has(item.key)}
                  onHit={game.score ? toggleHit : undefined}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      <div className={`flex flex-col gap-3 transition-opacity duration-200 ${shuffling ? "pointer-events-none opacity-0" : ""}`}>
        <div className="flex h-11 items-center justify-between">
          {/* Report the top card: opens a sheet, sent to the admin panel */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setReportItem(deck[index])}
            disabled={done}
            aria-label="דיווח על הקלף"
            title="דיווח על הקלף"
            data-testid="report-open"
            className="glass flex size-11 items-center justify-center rounded-full text-ink-soft disabled:invisible"
          >
            <Flag size={18} strokeWidth={1.8} />
          </motion.button>
          {game.score && !done ? (
            <p className="text-[14px] font-semibold tabular-nums text-ink-soft" data-testid="score">
              {scoreLine}
            </p>
          ) : (
            <p className="text-[13px] text-muted">{done ? "" : "הקישו להפיכה · סמנו ✓ כשעניתם"}</p>
          )}
          {/* Floating, discreet rules button */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setRulesOpen(true)}
            aria-label="חוקי המשחק"
            title="חוקי המשחק"
            data-testid="rules-fab"
            className="glass flex size-11 items-center justify-center rounded-full text-ink-soft"
          >
            <BookOpen size={19} strokeWidth={1.8} />
          </motion.button>
        </div>
        {!done && (
          <Button className="w-full" onClick={() => advance(-1)} data-testid="next">
            הקלף הבא
          </Button>
        )}
      </div>

      <ReportSheet item={reportItem} game={game} onClose={closeReport} />
      <RulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} content={content} />
    </Screen>
  );
}
