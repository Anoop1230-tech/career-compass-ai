/**
 * Original hero illustration: a runner on a winding track that circles a compass.
 * Flat colours from the site palette only (no gradients), drawn inline so it costs no extra request
 * and stays sharp on every screen. The needle sways slowly; this stops for reduced-motion users (see CSS).
 */
const INK = "#1f2a26";
const GREEN = "#1f5c4a";
const TERRACOTTA = "#a94c22";
const SAND = "#f3efe7";
const TRACK = "#e7dcc8";
const TRACK_EDGE = "#cdc3b1";
const SKIN = "#b9785a";

// The track is an ellipse around the compass: the top half passes behind it, the bottom half in front
const BACK = "M 30 252 A 210 66 0 0 1 450 252";
const FRONT = "M 450 252 A 210 66 0 0 1 30 252";

function Track({ d }) {
  return (
    <g fill="none">
      <path d={d} stroke={TRACK_EDGE} strokeWidth="30" />
      <path d={d} stroke={TRACK} strokeWidth="25" />
      <path d={d} stroke="#ffffff" strokeWidth="2.5" strokeDasharray="12 12" />
    </g>
  );
}

const TICKS = Array.from({ length: 24 }, (_, i) => i * 15);

export default function HeroIllustration() {
  return (
    <svg className="hero-art__svg" viewBox="0 0 480 440" role="img"
      aria-label="A runner on a winding track around a large compass, heading towards a flag">
      {/* Soft sand disc behind everything */}
      <circle cx="240" cy="215" r="200" fill={SAND} />
      <circle cx="96" cy="70" r="7" fill={TRACK_EDGE} />
      <circle cx="410" cy="96" r="5" fill={TERRACOTTA} opacity="0.6" />
      <circle cx="72" cy="360" r="5" fill={GREEN} opacity="0.5" />

      <Track d={BACK} />

      {/* Finish flag on the far side of the track */}
      <line x1="380" y1="204" x2="380" y2="130" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      <path d="M 382 132 L 418 144 L 382 158 Z" fill={TERRACOTTA} />

      {/* Compass */}
      <circle cx="240" cy="210" r="126" fill="#ffffff" stroke={GREEN} strokeWidth="8" />
      <circle cx="240" cy="210" r="104" fill="none" stroke={TRACK_EDGE} strokeWidth="1.5" />
      {TICKS.map((deg) => (
        <line key={deg} x1="240" y1={deg % 90 === 0 ? 94 : 98} x2="240" y2="106"
          stroke={deg % 90 === 0 ? GREEN : TRACK_EDGE} strokeWidth={deg % 90 === 0 ? 4 : 2} strokeLinecap="round"
          transform={`rotate(${deg} 240 210)`} />
      ))}
      <g fontFamily="Georgia, 'Palatino Linotype', serif" fontSize="22" fontWeight="700" fill={INK} textAnchor="middle">
        <text x="240" y="134">N</text>
        <text x="322" y="218">E</text>
        <text x="240" y="303">S</text>
        <text x="158" y="218">W</text>
      </g>
      <g className="hero-art__needle">
        <path d="M 240 140 L 257 210 L 223 210 Z" fill={TERRACOTTA} />
        <path d="M 240 280 L 257 210 L 223 210 Z" fill={INK} />
        <circle cx="240" cy="210" r="8" fill="#ffffff" stroke={INK} strokeWidth="3" />
      </g>

      <Track d={FRONT} />

      {/* Runner on the open part of the track, heading round to the flag */}
      <g transform="translate(-2 -63) scale(1.2)">
      <g stroke={TRACK_EDGE} strokeWidth="4" strokeLinecap="round">
        <line x1="276" y1="252" x2="300" y2="252" />
        <line x1="268" y1="268" x2="296" y2="268" />
        <line x1="282" y1="284" x2="302" y2="284" />
      </g>

      {/* Runner, heading right (white outline keeps the figure clear against the compass) */}
      <g strokeLinecap="round" strokeLinejoin="round" fill="none">
        <g stroke="#ffffff" strokeWidth="17">
          <polyline points="338,268 326,286 306,294" />
          <polyline points="338,268 356,283 360,304" />
          <line x1="348" y1="236" x2="338" y2="268" />
        </g>
        {/* back arm and leg */}
        <polyline points="346,242 331,252 320,240" stroke={SKIN} strokeWidth="7" />
        <polyline points="338,268 326,286 306,294" stroke={GREEN} strokeWidth="10" />
        {/* body */}
        <line x1="348" y1="236" x2="338" y2="268" stroke={TERRACOTTA} strokeWidth="15" />
        {/* front leg and arm */}
        <polyline points="338,268 356,283 360,304" stroke={GREEN} strokeWidth="10" />
        <polyline points="366,304 358,304" stroke={INK} strokeWidth="7" />
        <polyline points="310,295 302,292" stroke={INK} strokeWidth="7" />
        <polyline points="348,242 363,255 376,245" stroke={SKIN} strokeWidth="7" />
      </g>
      <circle cx="354" cy="220" r="11" fill={SKIN} stroke="#ffffff" strokeWidth="3" />
      <path d="M 344 217 A 11 11 0 0 1 365 215 L 352 213 Z" fill={INK} />
      </g>
    </svg>
  );
}
