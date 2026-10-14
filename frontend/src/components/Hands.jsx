/**
 * Human hand illustration, split in two layers so the deck can rest *on* the hand:
 *   <HandBase/>  sleeve, wrist, back of the hand and fingers (drawn behind the cards)
 *   <HandThumb/> thumb pressing on the deck (drawn in front of the cards)
 * Both are the LEFT hand in the same 180x210 coordinate space; pass `mirrored` for the right hand.
 */
const SKIN_LIGHT = "#F3D9BC";
const SKIN_MID = "#E4BC95";
const SKIN_DARK = "#C99A72";
const LINE = "#B98A63";

function Defs() {
  return (
    <defs>
      <linearGradient id="oh-skin" x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0" stopColor={SKIN_LIGHT} />
        <stop offset="0.6" stopColor={SKIN_MID} />
        <stop offset="1" stopColor="#D6A67E" />
      </linearGradient>
      <linearGradient id="oh-finger" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#D9AE86" />
        <stop offset="0.35" stopColor="#F1D3B2" />
        <stop offset="0.7" stopColor="#E6BF98" />
        <stop offset="1" stopColor="#CFA17A" />
      </linearGradient>
      <linearGradient id="oh-sleeve" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#2B314A" />
        <stop offset="0.5" stopColor="#222839" />
        <stop offset="1" stopColor="#181C2A" />
      </linearGradient>
      <radialGradient id="oh-palm-shade" cx="0.5" cy="0.9" r="0.7">
        <stop offset="0" stopColor="#B88660" stopOpacity="0.35" />
        <stop offset="1" stopColor="#B88660" stopOpacity="0" />
      </radialGradient>
      <filter id="oh-soft" x="-20%" y="-20%" width="150%" height="150%">
        <feDropShadow dx="0" dy="4" stdDeviation="4.5" floodColor="#1F2433" floodOpacity="0.25" />
      </filter>
    </defs>
  );
}

const wrap = (mirrored) => ({
  viewBox: "0 0 180 210",
  width: 150,
  height: 175,
  style: { transform: mirrored ? "scaleX(-1)" : undefined, overflow: "visible", display: "block" },
  "aria-hidden": true,
});

export function HandBase({ mirrored }) {
  return (
    <svg {...wrap(mirrored)}>
      <Defs />
      <g filter="url(#oh-soft)">
        {/* sleeve and cuff */}
        <path d="M34 214 L44 154 Q46 144 57 144 L113 144 Q124 144 126 154 L136 214 Z" fill="url(#oh-sleeve)" />
        <path d="M44 154 Q46 144 57 144 L113 144 Q124 144 126 154 L127 160 L43 160 Z" fill="#F6F2EA" />
        {/* wrist */}
        <path d="M56 150 C57 134 58 122 60 112 L112 112 C114 122 115 134 116 150 Z" fill="url(#oh-skin)" />
        {/* fingers, four of them, slightly fanned and curled under the deck */}
        <g fill="url(#oh-finger)" stroke={LINE} strokeWidth="0.9" strokeLinejoin="round">
          <path d="M40 74 C34 60 30 44 32 28 C33 20 44 20 46 28 C49 44 52 58 54 74 Z" />
          <path d="M60 68 C57 50 56 30 58 12 C59 3 72 3 73 12 C75 30 76 50 76 68 Z" />
          <path d="M82 68 C82 48 83 28 86 10 C88 1 101 2 101 11 C101 30 100 50 98 68 Z" />
          <path d="M104 70 C106 52 110 36 116 22 C119 14 130 17 128 26 C125 42 120 58 116 74 Z" />
        </g>
        {/* back of the hand */}
        <path d="M36 118 C28 98 30 74 40 62 C54 54 104 54 120 64 C134 76 136 100 126 118 C118 130 104 134 86 134 C62 134 44 130 36 118 Z" fill="url(#oh-skin)" stroke={LINE} strokeWidth="0.9" />
        <path d="M36 118 C28 98 30 74 40 62 C54 54 104 54 120 64 C134 76 136 100 126 118 C118 130 104 134 86 134 C62 134 44 130 36 118 Z" fill="url(#oh-palm-shade)" />
        {/* tendons and knuckle creases */}
        <g fill="none" stroke={LINE} strokeLinecap="round" opacity="0.55">
          <path d="M60 128 C58 110 56 94 52 78" strokeWidth="0.9" />
          <path d="M78 130 C78 112 78 94 78 76" strokeWidth="0.9" />
          <path d="M96 128 C98 110 100 94 104 78" strokeWidth="0.9" />
          <path d="M44 70 C48 66 52 66 56 68 M66 66 C70 62 74 62 78 64 M88 64 C92 62 96 62 100 66 M108 68 C112 66 116 68 118 72" strokeWidth="0.8" />
        </g>
      </g>
    </svg>
  );
}

export function HandThumb({ mirrored }) {
  return (
    <svg {...wrap(mirrored)}>
      <Defs />
      <g filter="url(#oh-soft)">
        <path
          d="M106 120 C118 106 128 90 142 70 C147 62 154 56 162 56 C171 56 175 65 170 73 C160 90 150 104 140 118 C134 126 126 134 118 138 Z"
          fill="url(#oh-skin)"
          stroke={LINE}
          strokeWidth="0.9"
          strokeLinejoin="round"
        />
        {/* joint crease */}
        <path d="M136 92 C141 95 147 95 152 92" fill="none" stroke={LINE} strokeWidth="0.9" strokeLinecap="round" opacity="0.6" />
        {/* thumbnail */}
        <path d="M158 58 C166 56 172 62 169 69 C167 73 160 74 154 71 C150 68 152 60 158 58 Z" fill="#FAEBD9" stroke="#D9B691" strokeWidth="0.7" />
        <path d="M157 61 C161 60 164 61 165 63" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      </g>
    </svg>
  );
}
