import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen, ChevronLeft, ChevronRight, Copy, Download, EllipsisVertical, Lock, Share, SquarePlus, Star, X,
} from "lucide-react";
import { Button, IconButton } from "./ui.jsx";
import { promptInstall, useInstall } from "../lib/install.js";

/* ---------- Steps per platform ---------- */
const FLOWS = {
  ios: {
    scenes: ["browser", "sheet", "home"],
    steps: [
      { title: "לחצו על כפתור השיתוף", text: "הריבוע עם החץ למעלה, בסרגל של הדפדפן." },
      { title: "בחרו ״הוספה למסך הבית״", text: "גללו מעט למטה ברשימה אם לא רואים אותה." },
      { title: "לחצו ״הוספה״", text: "האייקון יופיע במסך הבית, פותחים ומשחקים." },
    ],
    hint: "לא רואים כפתור שיתוף? לחצו על ⋯ בסרגל ושם על ״שיתוף״.",
  },
  "android-prompt": {
    scenes: ["prompt", "home"],
    steps: [
      { title: "לחצו על ״התקנה עכשיו״", text: "חלון ההתקנה של המכשיר ייפתח מיד." },
      { title: "אשרו ״התקנה״", text: "האייקון יופיע במסך הבית, פותחים ומשחקים." },
    ],
  },
  "android-menu": {
    scenes: ["browser", "sheet", "home"],
    steps: [
      { title: "לחצו על ⋮ בפינת הדפדפן", text: "שלוש הנקודות ליד שורת הכתובת." },
      { title: "בחרו ״התקנת אפליקציה״", text: "או ״הוספה למסך הבית״, תלוי בדפדפן." },
      { title: "אשרו ״התקנה״", text: "האייקון יופיע במסך הבית, פותחים ומשחקים." },
    ],
  },
  "desktop-prompt": {
    scenes: ["prompt", "home"],
    steps: [
      { title: "לחצו על ״התקנה עכשיו״", text: "חלון ההתקנה של הדפדפן ייפתח מיד." },
      { title: "אשרו ״התקנה״", text: "האפליקציה תיפתח בחלון משלה, עם קיצור דרך." },
    ],
  },
};

/** Bottom sheet that explains (or performs) installing the PWA, tailored to iPhone / Android / desktop. */
export function InstallSheet({ open, onClose }) {
  const { platform, canPrompt } = useInstall();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [prompted, setPrompted] = useState(false); // the prompt event is single-use: keep this flow while it's showing
  const viaPrompt = canPrompt || prompted;
  const flowId = platform === "ios" ? "ios" : viaPrompt ? `${platform}-prompt` : platform === "android" ? "android-menu" : "desktop-prompt";
  const flow = FLOWS[flowId];

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setDone(false);
    setPrompted(false);
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || done) return;
    const t = setInterval(() => setStep((s) => (s + 1) % flow.steps.length), 2600);
    return () => clearInterval(t);
  }, [open, done, flow.steps.length]);

  const install = async () => {
    setPrompted(true);
    const outcome = await promptInstall();
    if (outcome === "accepted") {
      setDone(true);
      setTimeout(onClose, 1800);
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
            aria-label="התקנת האפליקציה"
            data-testid="install-sheet"
            data-flow={flowId}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-[32px] bg-canvas/95 shadow-2xl backdrop-blur-2xl"
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
            <div className="flex items-start justify-between gap-3 px-5 pt-3">
              <div>
                <h2 className="font-display text-[26px] leading-tight">התקינו את האפליקציה</h2>
                <p className="mt-1 text-[14px] leading-snug text-muted">פתיחה מהירה ממסך הבית, במסך מלא ובלי שורת כתובת.</p>
              </div>
              <IconButton label="סגירה" onClick={onClose} data-testid="install-close" className="shrink-0">
                <X size={20} />
              </IconButton>
            </div>

            <div
              className="overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),20px)] pt-4"
              onPointerDownCapture={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-4">
                <PhoneDemo flowId={flowId} scene={done ? "home" : flow.scenes[step]} />
                <ol className="flex min-w-0 flex-1 flex-col gap-2.5" data-testid="install-steps">
                  {flow.steps.map((s, i) => {
                    const active = !done && i === step;
                    return (
                      <motion.li
                        key={s.title}
                        animate={{ opacity: active ? 1 : 0.5, x: active ? -2 : 0 }}
                        transition={{ duration: 0.25 }}
                        className="flex gap-2.5"
                      >
                        <span
                          className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold transition-colors ${
                            active ? "bg-gold text-white" : "bg-ink/8 text-ink-soft"
                          }`}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold leading-snug">{s.title}</p>
                          <p className="text-[13px] leading-snug text-muted">{s.text}</p>
                        </div>
                      </motion.li>
                    );
                  })}
                </ol>
              </div>

              {flow.hint && <p className="mt-4 rounded-2xl bg-ink/5 px-4 py-2.5 text-[13px] leading-snug text-ink-soft">{flow.hint}</p>}

              <div className="mt-4">
                {done ? (
                  <p className="flex h-14 items-center justify-center text-[17px] font-medium text-gold" data-testid="install-done">
                    הותקן! מעכשיו פותחים ממסך הבית
                  </p>
                ) : viaPrompt ? (
                  <Button className="w-full" onClick={install} disabled={!canPrompt} data-testid="install-prompt">
                    <Download size={19} strokeWidth={1.9} />
                    התקנה עכשיו
                  </Button>
                ) : (
                  <Button variant="glass" className="w-full" onClick={onClose} data-testid="install-ok">
                    הבנתי
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ---------- Animated mini phone ---------- */

/** Pulsing gold "tap here" ring. */
function Tap({ className = "" }) {
  return (
    <span className={`pointer-events-none absolute flex items-center justify-center ${className}`}>
      <motion.span
        className="absolute size-7 rounded-full border-2 border-gold"
        initial={{ scale: 0.6, opacity: 0.9 }}
        animate={{ scale: 1.5, opacity: 0 }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "easeOut", delay: 0.35 }}
      />
      <motion.span
        className="size-4 rounded-full bg-gold/45"
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.1, 1] }}
        transition={{ duration: 0.4, delay: 0.3 }}
      />
    </span>
  );
}

function PageLines({ dim }) {
  return (
    <div className={`flex flex-1 flex-col items-center gap-1.5 px-3 pt-5 transition-opacity ${dim ? "opacity-40" : ""}`}>
      <img src="/icon.svg" alt="" className="mb-1 size-8 rounded-[9px]" />
      <div className="h-2 w-16 rounded-full bg-ink/25" />
      <div className="h-1.5 w-20 rounded-full bg-ink/10" />
      <div className="h-1.5 w-14 rounded-full bg-ink/10" />
      <div className="mt-auto mb-2 h-5 w-full rounded-full bg-ink/80" />
    </div>
  );
}

const sceneAnim = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 1.02 },
  transition: { duration: 0.25 },
};

function PhoneDemo({ flowId, scene }) {
  const ios = flowId === "ios";
  const desktop = flowId.startsWith("desktop");
  return (
    <div
      aria-hidden
      className={`relative shrink-0 overflow-hidden border-[5px] border-ink bg-[#FBF8F3] shadow-[var(--shadow-soft)] ${
        desktop ? "h-[150px] w-[170px] rounded-[14px]" : "h-[244px] w-[124px] rounded-[26px]"
      }`}
      data-testid="install-demo"
      data-scene={scene}
    >
      {!desktop && <div className="absolute left-1/2 top-1.5 z-20 h-3 w-10 -translate-x-1/2 rounded-full bg-ink" />}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div key={scene} {...sceneAnim} className="absolute inset-0 flex flex-col">
          {scene === "home" ? <HomeScreen desktop={desktop} /> : ios ? <IosBrowser scene={scene} /> : <AndroidBrowser scene={scene} desktop={desktop} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function IosBrowser({ scene }) {
  const sheet = scene === "sheet";
  return (
    <>
      <div className="h-6" />
      <PageLines dim={sheet} />
      {/* Safari bottom bar */}
      <div dir="ltr" className={`relative flex h-9 items-center justify-around border-t border-ink/10 bg-white/90 px-1 text-ink/70 ${sheet ? "opacity-40" : ""}`}>
        <ChevronLeft size={13} />
        <ChevronRight size={13} className="opacity-40" />
        <span className="relative flex items-center justify-center">
          <Share size={14} className={sheet ? "" : "text-gold"} strokeWidth={2.2} />
          {!sheet && <Tap />}
        </span>
        <BookOpen size={13} />
        <Copy size={13} />
      </div>
      <div className="h-3 bg-white/90" />
      {/* Share sheet */}
      <AnimatePresence>
        {sheet && (
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="absolute inset-x-0 bottom-0 rounded-t-[14px] bg-[#F2F2F7] px-1.5 pb-4 pt-2 shadow-[0_-6px_20px_rgb(0_0_0/0.12)]"
          >
            <div className="mx-auto mb-2 h-1 w-6 rounded-full bg-ink/20" />
            <div className="overflow-hidden rounded-lg bg-white text-[8.5px] text-ink">
              <Row icon={Copy} label="העתקה" />
              <Row icon={Star} label="הוספה למועדפים" />
              <Row icon={SquarePlus} label="הוספה למסך הבית" highlight />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function AndroidBrowser({ scene, desktop }) {
  const menu = scene === "sheet";
  const prompt = scene === "prompt";
  return (
    <>
      {!desktop && <div className="h-5" />}
      {/* Chrome address bar (RTL: menu on the left) */}
      <div className="relative flex h-7 items-center gap-1 bg-white/90 px-1.5">
        <div className="flex h-4.5 flex-1 items-center gap-1 rounded-full bg-ink/6 px-1.5 text-[7px] text-ink/60" dir="ltr">
          <Lock size={7} />
          openhearts…
          {desktop && <Download size={8} className="ml-auto text-gold" />}
        </div>
        <span className="relative order-last flex items-center justify-center">
          <EllipsisVertical size={13} className={!menu && !prompt ? "text-gold" : "text-ink/70"} />
          {scene === "browser" && <Tap />}
        </span>
      </div>
      <PageLines dim={menu || prompt} />
      <AnimatePresence>
        {menu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{ transformOrigin: "top left" }}
            className={`absolute left-1 ${desktop ? "top-7" : "top-12"} w-[96px] overflow-hidden rounded-lg bg-white text-[8px] text-ink shadow-[0_6px_20px_rgb(0_0_0/0.18)]`}
          >
            <Row icon={Star} label="סימניות" />
            <Row icon={Copy} label="שיתוף" />
            <Row icon={Download} label="התקנת אפליקציה" highlight />
          </motion.div>
        )}
        {prompt && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-x-1.5 ${desktop ? "top-9" : "bottom-3"} rounded-xl bg-white p-2 text-ink shadow-[0_6px_20px_rgb(0_0_0/0.2)]`}
          >
            <div className="flex items-center gap-1.5">
              <img src="/icon.svg" alt="" className="size-6 rounded-md" />
              <div className="min-w-0">
                <p className="text-[8.5px] font-semibold leading-tight">להתקין את האפליקציה?</p>
                <p className="text-[7px] text-muted">לבבות פתוחים</p>
              </div>
            </div>
            <div className="mt-2 flex justify-end gap-1 text-[7.5px] font-medium">
              <span className="rounded-full px-2 py-1 text-ink/50">ביטול</span>
              <span className="relative rounded-full bg-ink px-2.5 py-1 text-white">
                התקנה
                <Tap className="inset-0" />
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Row({ icon: Icon, label, highlight }) {
  return (
    <div className={`relative flex items-center justify-between gap-1 border-b border-ink/5 px-2 py-1.5 last:border-0 ${highlight ? "bg-gold/15 font-semibold" : ""}`}>
      <span className="truncate">{label}</span>
      <Icon size={9} className={highlight ? "text-gold" : "text-ink/50"} />
      {highlight && <Tap className="inset-0" />}
    </div>
  );
}

function HomeScreen({ desktop }) {
  const tiles = ["#CFD9E6", "#E2D3DF", "#D9E3D4", "#E9D9BD", "#D6D2E6", "#E6D5CC", "#CBD6CF", "#E3DDCF"];
  return (
    <div className={`grid flex-1 content-start gap-2.5 bg-gradient-to-b from-[#D9C9AE] to-[#B9C4D6] ${desktop ? "grid-cols-5 p-3" : "grid-cols-3 px-3 pt-8"}`}>
      {tiles.slice(0, desktop ? 4 : 5).map((c, i) => (
        <div key={i} className="aspect-square rounded-[8px] opacity-80" style={{ background: c }} />
      ))}
      <motion.div
        className="flex flex-col items-center gap-0.5"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.25, 1], opacity: 1 }}
        transition={{ duration: 0.55, delay: 0.25 }}
      >
        <img src="/icon.svg" alt="" className="aspect-square w-full rounded-[8px] shadow-[0_0_0_2px_rgb(216_190_140/0.9),0_4px_10px_rgb(0_0_0/0.25)]" />
        <span className="whitespace-nowrap text-[6px] font-medium text-white drop-shadow">לבבות פתוחים</span>
      </motion.div>
    </div>
  );
}

/** Home-screen pill that opens the sheet (hidden inside the installed app). */
export function InstallButton({ onClick }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      data-testid="install-open"
      className="glass inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium text-ink"
    >
      <Download size={15} strokeWidth={2} className="text-gold" />
      התקנת האפליקציה
    </motion.button>
  );
}
