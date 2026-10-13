import { motion } from "framer-motion";

const press = { whileTap: { scale: 0.96 }, transition: { type: "spring", stiffness: 500, damping: 30 } };

export function Button({ variant = "primary", className = "", children, ...props }) {
  const styles = {
    primary: "bg-ink text-white shadow-[0_10px_30px_-10px_rgb(29_29_31/0.55)]",
    glass: "glass text-ink",
    ghost: "text-ink-soft",
  };
  return (
    <motion.button
      {...press}
      className={`inline-flex h-14 items-center justify-center gap-2 rounded-full px-7 text-[17px] font-medium tracking-[-0.01em] ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export function IconButton({ label, className = "", children, ...props }) {
  return (
    <motion.button
      {...press}
      aria-label={label}
      title={label}
      className={`glass inline-flex size-11 items-center justify-center rounded-full text-ink ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export function Screen({ children, className = "" }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.1 } }}
      transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
      className={`relative mx-auto flex h-dvh w-full max-w-md flex-col px-5 safe-top safe-bottom ${className}`}
    >
      {children}
    </motion.main>
  );
}

export function TopBar({ left, center, right }) {
  return (
    <header className="relative z-10 flex h-12 items-center justify-between">
      <div className="flex w-16 justify-start">{right}</div>
      <div className="min-w-0 flex-1 text-center">{center}</div>
      <div className="flex w-16 justify-end">{left}</div>
    </header>
  );
}

/** Soft ambient light behind every screen. */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-32 -right-24 size-[420px] rounded-full bg-[#E9D9BD] opacity-60 blur-[90px]" />
      <div className="absolute top-1/3 -left-40 size-[380px] rounded-full bg-[#CFD9E6] opacity-50 blur-[100px]" />
      <div className="absolute -bottom-40 right-0 size-[360px] rounded-full bg-[#E2D3DF] opacity-40 blur-[100px]" />
    </div>
  );
}
