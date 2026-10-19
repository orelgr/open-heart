import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CircleCheck, X } from "lucide-react";
import { Button, IconButton } from "./ui.jsx";
import { REASONS } from "../lib/admin.js";
import { reportCard, reportKey } from "../lib/cards.js";

const NOTE_MAX = 500;

/** Bottom sheet: "something's wrong with this card". Sent to the admin panel's reports tab. */
export function ReportSheet({ item, game, onClose }) {
  const open = !!item;
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent
  const [error, setError] = useState(null);
  const textRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setReason(null);
    setNote("");
    setState("idle");
    setError(null);
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const text = item && (item.kind === "power" ? item.text : item.options ? `${item.options[0]} או ${item.options[1]}?` : item.text);
  const canSend = state === "idle" && (note.trim() || (reason && reason !== "other"));

  const submit = async (e) => {
    e.preventDefault();
    if (!canSend) return;
    setState("sending");
    setError(null);
    try {
      await reportCard({ key: reportKey(item), game: game?.id, reason: reason ?? "other", note: note.trim() });
      setState("sent");
      setTimeout(onClose, 1300);
    } catch (err) {
      setError(err.message);
      setState("idle");
    }
  };

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
            aria-label="דיווח על קלף"
            data-testid="report-sheet"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-[32px] bg-canvas/95 shadow-2xl backdrop-blur-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
            onAnimationComplete={() => state === "idle" && textRef.current?.focus({ preventScroll: true })}
          >
            <div className="flex justify-center pt-2.5">
              <div className="h-1.5 w-10 rounded-full bg-ink/15" />
            </div>
            <div className="flex items-center justify-between px-5 pb-1 pt-3">
              <h2 className="font-display text-[26px]">משהו לא בסדר בקלף?</h2>
              <IconButton label="סגירה" onClick={onClose} data-testid="report-close">
                <X size={20} />
              </IconButton>
            </div>

            {state === "sent" ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-2 px-5 pb-12 pt-8 text-center"
                data-testid="report-sent"
              >
                <CircleCheck size={44} strokeWidth={1.6} className="text-sage" />
                <p className="text-[18px] font-medium">תודה, הדיווח נשלח</p>
                <p className="text-[15px] text-muted">נבדוק ונתקן בהקדם.</p>
              </motion.div>
            ) : (
              <form onSubmit={submit} className="grid gap-4 overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),24px)] pt-1">
                <p className="line-clamp-3 rounded-2xl bg-white/60 px-4 py-3 font-display text-[16px] leading-snug text-ink-soft">{text}</p>

                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="סוג הבעיה">
                  {Object.entries(REASONS).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={reason === id}
                      onClick={() => setReason((r) => (r === id ? null : id))}
                      className={`h-9 rounded-full border px-3.5 text-[14px] transition-colors duration-150 ${
                        reason === id ? "border-ink bg-ink text-white" : "border-ink/12 bg-white/60 text-ink-soft"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <label className="block">
                  <span className="sr-only">מה לא בסדר?</span>
                  <textarea
                    ref={textRef}
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
                    rows={4}
                    placeholder="ספרו לנו מה לא בסדר בקלף…"
                    className="glass w-full resize-none rounded-2xl px-4 py-3 text-[16px] leading-relaxed text-ink outline-none ring-gold/60 placeholder:text-muted/60 focus:ring-2"
                    data-testid="report-note"
                  />
                  <span className="mt-1 block text-left text-[12px] tabular-nums text-muted/70">
                    {note.length}/{NOTE_MAX}
                  </span>
                </label>

                {error && (
                  <p role="alert" className="rounded-2xl bg-clay/15 px-4 py-3 text-[15px] text-[#8A4B37]">
                    {error}
                  </p>
                )}
                <Button type="submit" disabled={!canSend} className="w-full disabled:opacity-40" data-testid="report-submit">
                  {state === "sending" ? "שולחים…" : "שליחת דיווח"}
                </Button>
              </form>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
