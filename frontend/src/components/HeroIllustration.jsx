import { useI18n } from "../i18n";
/**
 * Original hero illustration: a student at a signpost choosing a direction, with a winding road
 * into the hills. Matches the headline "Where are you now, and where do you want to go?".
 * Colours come from CSS variables (--art-*), so the scene follows the theme: day in light mode,
 * a night sky with a moon and stars in dark mode. Flat colours only (no gradients).
 * Motion (drifting clouds, twinkling stars, swaying sign, waving flag, the road drawing itself)
 * is CSS-only and stops for reduced-motion users.
 */
const v = (name) => `var(--art-${name})`;

// Sign boards: [label, y, points right?, board colour, text colour]
const BOARDS = [
  ["Technology", 150, true, v("green"), "#ffffff"],
  ["Creative Arts", 192, false, v("terracotta"), "#ffffff"],
  ["Government", 234, true, v("ink"), "#ffffff"],
  ["Business", 276, false, v("board-light"), v("board-light-text")],
];

const STARS = [[60, 40, 2], [130, 70, 1.6], [210, 34, 2.2], [250, 96, 1.4], [470, 190, 1.8], [30, 180, 1.5],
  [300, 150, 1.4], [480, 40, 1.6], [190, 120, 1.2]];

function Board({ label, y, right, fill, text, index }) {
  const { t } = useI18n();
  const x0 = 150; // post centre
  const points = right
    ? `${x0 - 6},${y} ${x0 + 124},${y} ${x0 + 140},${y + 16} ${x0 + 124},${y + 32} ${x0 - 6},${y + 32}`
    : `${x0 + 6},${y} ${x0 - 124},${y} ${x0 - 140},${y + 16} ${x0 - 124},${y + 32} ${x0 + 6},${y + 32}`;
  return (
    <g className="hero-art__board" style={{ "--i": index, transformOrigin: `${x0}px ${y + 16}px` }}>
      <polygon points={points} fill={fill} stroke={label === "Business" ? v("edge") : fill} strokeWidth="2"
        strokeLinejoin="round" />
      <text x={right ? x0 + 62 : x0 - 62} y={y + 21.5} textAnchor="middle" fill={text}
        fontFamily="system-ui, 'Segoe UI', Roboto, Arial, sans-serif" fontSize="14.5" fontWeight="700">
        {t(`home.hero.board.${index}`)}
      </text>
    </g>
  );
}

function Tree({ x, y, r, fill }) {
  return (
    <g>
      <rect x={x - 3} y={y} width="6" height={r * 1.1} rx="3" fill={v("wood")} />
      <circle cx={x} cy={y - r * 0.2} r={r} fill={fill} />
    </g>
  );
}

function Cloud({ x, y, s = 1, slow = false }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <g className={slow ? "hero-art__cloud hero-art__cloud--slow" : "hero-art__cloud"} fill={v("cloud")}>
        <rect x="0" y="14" width="96" height="24" rx="12" />
        <circle cx="34" cy="16" r="16" />
        <circle cx="58" cy="12" r="20" />
      </g>
    </g>
  );
}

export default function HeroIllustration() {
  const { t } = useI18n();
  return (
    <svg className="hero-art__svg" viewBox="0 0 520 460" role="img"
      aria-label={t("home.hero.alt")}>
      <defs>
        <clipPath id="hero-frame"><rect width="520" height="460" rx="28" /></clipPath>
      </defs>
      <g clipPath="url(#hero-frame)">
        {/* Sky, stars (night only), sun or moon, clouds, birds */}
        <rect width="520" height="460" fill={v("sky")} />
        <g className="hero-art__stars" fill="#f4efe6">
          {STARS.map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} className="hero-art__star" style={{ "--i": i }} />
          ))}
        </g>
        <circle className="hero-art__halo" cx="408" cy="104" r="52" fill={v("sun-halo")} />
        <circle cx="408" cy="104" r="32" fill={v("sun")} />
        <Cloud x={300} y={52} s={0.9} />
        <Cloud x={24} y={96} s={0.7} slow />
        <g className="hero-art__birds" fill="none" stroke={v("ink")} strokeWidth="2.2" strokeLinecap="round" opacity="0.55">
          <path d="M 330 150 q 6 -6 12 0 q 6 -6 12 0" />
          <path d="M 362 132 q 5 -5 10 0 q 5 -5 10 0" />
        </g>

        {/* Hills, far to near */}
        <path d="M0 262 C 70 228 140 232 210 252 C 290 276 360 214 520 236 L520 460 L0 460 Z" fill={v("hill-far")} />
        <path d="M0 300 C 100 268 190 284 270 300 C 360 318 440 276 520 286 L520 460 L0 460 Z" fill={v("hill-near")} />
        <Tree x={452} y={262} r={15} fill={v("tree")} />
        <Tree x={482} y={270} r={11} fill={v("tree-dark")} />
        <path d="M0 348 C 130 326 360 332 520 346 L520 460 L0 460 Z" fill={v("ground")} />

        {/* Winding road from the front to the horizon, ending at a flag */}
        <path d="M 300 460 C 316 420 404 404 386 372 C 372 348 300 350 316 322 C 326 306 350 298 364 292
                 L 374 292 C 364 300 344 310 338 324 C 328 346 424 350 426 378 C 430 416 372 430 382 460 Z"
          fill={v("road")} stroke={v("edge")} strokeWidth="2" strokeLinejoin="round" />
        <path className="hero-art__lane" d="M 341 460 C 356 424 410 408 406 376 C 402 350 318 352 328 324 C 334 310 352 300 368 293"
          fill="none" stroke={v("edge")} strokeWidth="2.5" strokeDasharray="10 11" strokeLinecap="round" />
        <line x1="370" y1="292" x2="370" y2="252" stroke={v("ink")} strokeWidth="3" strokeLinecap="round" />
        <path className="hero-art__flag" d="M 371 253 L 394 261 L 371 270 Z" fill={v("terracotta")} />

        {/* Signpost */}
        <ellipse cx="150" cy="392" rx="46" ry="8" fill={v("edge")} opacity="0.7" />
        <rect x="143" y="126" width="14" height="268" rx="4" fill={v("wood")} />
        <rect x="138" y="118" width="24" height="12" rx="6" fill={v("ink")} />
        {BOARDS.map(([label, y, right, fill, text], i) => (
          <Board key={label} label={label} y={y} right={right} fill={fill} text={text} index={i} />
        ))}

        {/* Student looking up at the sign */}
        <g transform="translate(26 16)">
          <ellipse cx="262" cy="416" rx="34" ry="6" fill={v("edge")} opacity="0.7" />
          <g strokeLinecap="round" fill="none">
            <line x1="256" y1="360" x2="252" y2="408" stroke={v("ink")} strokeWidth="12" />
            <line x1="270" y1="360" x2="274" y2="408" stroke={v("ink")} strokeWidth="12" />
          </g>
          <rect x="240" y="406" width="18" height="9" rx="4.5" fill={v("ink")} />
          <rect x="268" y="406" width="18" height="9" rx="4.5" fill={v("ink")} />
          <rect x="270" y="310" width="24" height="44" rx="8" fill={v("terracotta")} />
          <rect x="244" y="300" width="36" height="66" rx="14" fill={v("green")} />
          <line x1="276" y1="312" x2="282" y2="350" stroke={v("green-dark")} strokeWidth="4" strokeLinecap="round" />
          {/* arm raised, pointing at the sign */}
          <g className="hero-art__arm">
            <line x1="252" y1="314" x2="222" y2="286" stroke={v("green")} strokeWidth="12" strokeLinecap="round" />
            <circle cx="218" cy="282" r="6.5" fill={v("skin")} />
          </g>
          <rect x="256" y="288" width="12" height="16" rx="5" fill={v("skin")} />
          <circle cx="262" cy="276" r="18" fill={v("skin")} />
          <path d="M 244 274 C 242 254 280 250 281 272 C 274 266 262 264 252 268 Z" fill={v("ink")} />
          <circle cx="253" cy="279" r="2" fill={v("ink")} />
        </g>
      </g>
      <rect x="1" y="1" width="518" height="458" rx="27" fill="none" stroke={v("frame")} strokeWidth="2" />
    </svg>
  );
}
