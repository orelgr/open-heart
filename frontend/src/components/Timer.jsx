import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, RotateCcw } from "lucide-react";

const R = 34;
const C = 2 * Math.PI * R;

export default function Timer({ seconds = 10 }) {
  const [left, setLeft] = useState(seconds * 1000);
  const [running, setRunning] = useState(false);
  const raf = useRef(0);

  useEffect(() => {
    if (!running) return;
    const end = performance.now() + left;
    const tick = () => {
      const remain = Math.max(0, end - performance.now());
      setLeft(remain);
      if (remain > 0) raf.current = requestAnimationFrame(tick);
      else {
        setRunning(false);
        navigator.vibrate?.([60, 40, 60]);
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const done = left === 0;
  const start = (e) => {
    e.stopPropagation();
    if (done) setLeft(seconds * 1000);
    setRunning(true);
  };

  return (
    <div className="flex flex-col items-center gap-3" data-no-flip>
      <div className="relative size-24">
        <svg viewBox="0 0 80 80" className="size-24 -rotate-90">
          <circle cx="40" cy="40" r={R} stroke="rgb(255 255 255 / 0.12)" strokeWidth="4" fill="none" />
          <circle
            cx="40" cy="40" r={R} stroke="#D8BE8C" strokeWidth="4" fill="none" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - left / (seconds * 1000))}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-3xl font-light tabular-nums text-white" data-testid="timer-value">
          {Math.ceil(left / 1000)}
        </span>
      </div>
      {!running && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={start}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-gold-soft px-5 text-[15px] font-medium text-night"
        >
          {done ? <RotateCcw size={16} /> : <Play size={16} />}
          {done ? "הזמן נגמר · שוב" : "הפעילו טיימר"}
        </motion.button>
      )}
    </div>
  );
}
