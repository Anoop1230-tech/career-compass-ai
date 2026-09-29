/**
 * Original hero illustration: a student at a signpost choosing a direction, with a winding road
 * into the hills. Matches the headline "Where are you now, and where do you want to go?".
 * Flat colours from the site palette only (no gradients). Drawn inline: no extra download, sharp on
 * every screen. The clouds drift slowly; this stops for reduced-motion users (see CSS).
 */
const INK = "#1f2a26";
const GREEN = "#1f5c4a";
const GREEN_MID = "#5f8f78";
const GREEN_LIGHT = "#bcd3c6";
const GREEN_PALE = "#dde8e1";
const TERRACOTTA = "#a94c22";
const TERRA_SOFT = "#f2d9ca";
const SKY = "#f3efe7";
const GROUND = "#e8dfcd";
const ROAD = "#faf8f4";
const EDGE = "#cdc3b1";
const WOOD = "#7a5236";
const SKIN = "#b9785a";

// Sign boards: [label, y, points right?, board colour, text colour]
const BOARDS = [
  ["Technology", 150, true, GREEN, "#ffffff"],
  ["Creative Arts", 192, false, TERRACOTTA, "#ffffff"],
  ["Government", 234, true, INK, "#ffffff"],
  ["Business", 276, false, "#ffffff", INK],
];

function Board({ label, y, right, fill, text }) {
  const x0 = 150; // post centre
  const points = right
    ? `${x0 - 6},${y} ${x0 + 124},${y} ${x0 + 140},${y + 16} ${x0 + 124},${y + 32} ${x0 - 6},${y + 32}`
    : `${x0 + 6},${y} ${x0 - 124},${y} ${x0 - 140},${y + 16} ${x0 - 124},${y + 32} ${x0 + 6},${y + 32}`;
  return (
    <g>
      <polygon points={points} fill={fill} stroke={fill === "#ffffff" ? EDGE : fill} strokeWidth="2" strokeLinejoin="round" />
      <text x={right ? x0 + 62 : x0 - 62} y={y + 21.5} textAnchor="middle" fill={text}
        fontFamily="system-ui, 'Segoe UI', Roboto, Arial, sans-serif" fontSize="14.5" fontWeight="700">
        {label}
      </text>
    </g>
  );
}

function Tree({ x, y, r, fill }) {
  return (
    <g>
      <rect x={x - 3} y={y} width="6" height={r * 1.1} rx="3" fill={WOOD} />
      <circle cx={x} cy={y - r * 0.2} r={r} fill={fill} />
    </g>
  );
}

function Cloud({ x, y, s = 1 }) {
  return (
    <g className="hero-art__cloud" transform={`translate(${x} ${y}) scale(${s})`} fill="#ffffff">
      <rect x="0" y="14" width="96" height="24" rx="12" />
      <circle cx="34" cy="16" r="16" />
      <circle cx="58" cy="12" r="20" />
    </g>
  );
}

export default function HeroIllustration() {
  return (
    <svg className="hero-art__svg" viewBox="0 0 520 460" role="img"
      aria-label="A student at a signpost choosing between career paths: Technology, Creative Arts, Government and Business">
      <defs>
        <clipPath id="hero-frame"><rect width="520" height="460" rx="28" /></clipPath>
      </defs>
      <g clipPath="url(#hero-frame)">
        {/* Sky, sun, clouds, birds */}
        <rect width="520" height="460" fill={SKY} />
        <circle cx="408" cy="104" r="52" fill={TERRA_SOFT} />
        <circle cx="408" cy="104" r="32" fill="#e7b598" />
        <Cloud x={300} y={52} s={0.9} />
        <Cloud x={24} y={96} s={0.7} />
        <g fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" opacity="0.55">
          <path d="M 330 150 q 6 -6 12 0 q 6 -6 12 0" />
          <path d="M 362 132 q 5 -5 10 0 q 5 -5 10 0" />
        </g>

        {/* Hills, far to near */}
        <path d="M0 262 C 70 228 140 232 210 252 C 290 276 360 214 520 236 L520 460 L0 460 Z" fill={GREEN_PALE} />
        <path d="M0 300 C 100 268 190 284 270 300 C 360 318 440 276 520 286 L520 460 L0 460 Z" fill={GREEN_LIGHT} />
        <Tree x={452} y={262} r={15} fill={GREEN_MID} />
        <Tree x={482} y={270} r={11} fill={GREEN} />
        <path d="M0 348 C 130 326 360 332 520 346 L520 460 L0 460 Z" fill={GROUND} />

        {/* Winding road from the front to the horizon, ending at a flag */}
        <path d="M 300 460 C 316 420 404 404 386 372 C 372 348 300 350 316 322 C 326 306 350 298 364 292
                 L 374 292 C 364 300 344 310 338 324 C 328 346 424 350 426 378 C 430 416 372 430 382 460 Z"
          fill={ROAD} stroke={EDGE} strokeWidth="2" strokeLinejoin="round" />
        <path d="M 341 460 C 356 424 410 408 406 376 C 402 350 318 352 328 324 C 334 310 352 300 368 293"
          fill="none" stroke={EDGE} strokeWidth="2.5" strokeDasharray="10 11" strokeLinecap="round" />
        <line x1="370" y1="292" x2="370" y2="252" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <path d="M 371 253 L 394 261 L 371 270 Z" fill={TERRACOTTA} />

        {/* Signpost */}
        <ellipse cx="150" cy="392" rx="46" ry="8" fill={EDGE} opacity="0.7" />
        <rect x="143" y="126" width="14" height="268" rx="4" fill={WOOD} />
        <rect x="138" y="118" width="24" height="12" rx="6" fill={INK} />
        {BOARDS.map(([label, y, right, fill, text]) => (
          <Board key={label} label={label} y={y} right={right} fill={fill} text={text} />
        ))}

        {/* Student looking up at the sign */}
        <g transform="translate(26 16)">
        <ellipse cx="262" cy="416" rx="34" ry="6" fill={EDGE} opacity="0.7" />
        <g strokeLinecap="round" fill="none">
          <line x1="256" y1="360" x2="252" y2="408" stroke={INK} strokeWidth="12" />
          <line x1="270" y1="360" x2="274" y2="408" stroke={INK} strokeWidth="12" />
        </g>
        <rect x="240" y="406" width="18" height="9" rx="4.5" fill={INK} />
        <rect x="268" y="406" width="18" height="9" rx="4.5" fill={INK} />
        <rect x="270" y="310" width="24" height="44" rx="8" fill={TERRACOTTA} />
        <rect x="244" y="300" width="36" height="66" rx="14" fill={GREEN} />
        <line x1="276" y1="312" x2="282" y2="350" stroke="#174a3b" strokeWidth="4" strokeLinecap="round" />
        {/* arm raised, pointing at the sign */}
        <line x1="252" y1="314" x2="222" y2="286" stroke={GREEN} strokeWidth="12" strokeLinecap="round" />
        <circle cx="218" cy="282" r="6.5" fill={SKIN} />
        <rect x="256" y="288" width="12" height="16" rx="5" fill={SKIN} />
        <circle cx="262" cy="276" r="18" fill={SKIN} />
        <path d="M 244 274 C 242 254 280 250 281 272 C 274 266 262 264 252 268 Z" fill={INK} />
        <circle cx="253" cy="279" r="2" fill={INK} />
        </g>
      </g>
      <rect x="1" y="1" width="518" height="458" rx="27" fill="none" stroke="#e6dfd2" strokeWidth="2" />
    </svg>
  );
}
