/** Open-heart mark: two arcs that almost meet - an open, unfinished heart. */
export function LogoMark({ size = 56, light = false }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" aria-hidden>
      <path d="M60 98C45 87 26 74 26 55c0-11 8-19 18-19 7 0 12 4 15 10" stroke="#B8955A" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M68 39c4-3 8-4 12-4 10 0 18 8 18 19 0 19-19 33-34 43" stroke={light ? "#F5F1EB" : "#1D1D1F"} strokeWidth="5.5" strokeLinecap="round" />
    </svg>
  );
}
