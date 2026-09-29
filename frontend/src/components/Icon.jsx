// Small inline SVG icon set (stroke style, 24x24 grid). No icon library:
// every icon is a few path strings, so the bundle stays tiny.
const PATHS = {
  compass: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "m15.5 8.5-2 5-5 2 2-5 5-2Z"],
  dashboard: ["M4 4h7v7H4z", "M13 4h7v4h-7z", "M13 10h7v10h-7z", "M4 13h7v7H4z"],
  steps: ["M4 19h4v-4h4v-4h4V7h4", "M16 3h4v4"],
  star: ["m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"],
  map: ["M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z", "M9 4v14", "M15 6v14"],
  briefcase: ["M4 8h16v11H4z", "M9 8V5h6v3", "M4 13h16"],
  tree: ["M6 3v12", "M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z", "M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M18 9a9 9 0 0 1-9 9"],
  target: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M12 12h.01"],
  clipboard: ["M9 4h6v3H9z", "M9 5H6v16h12V5h-3", "m9 14 2 2 4-4"],
  school: ["m2 9 10-5 10 5-10 5L2 9Z", "M6 11v5c3 2 9 2 12 0v-5", "M22 9v6"],
  chat: ["M4 5h16v11H9l-5 4V5Z", "M8 10h8", "M8 13h5"],
  user: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M4 21a8 8 0 0 1 16 0"],
  logout: ["M15 4h4v16h-4", "M10 8l-4 4 4 4", "M6 12h10"],
  login: ["M9 4H5v16h4", "M14 8l4 4-4 4", "M18 12H8"],
  menu: ["M4 7h16", "M4 12h16", "M4 17h16"],
  close: ["M6 6l12 12", "M18 6 6 18"],
  arrow: ["M5 12h14", "m13 6 6 6-6 6"],
  check: ["m5 12 5 5 9-10"],
  book: ["M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z", "M4 19a2 2 0 0 1 2-2h13"],
  spark: ["M12 3v4", "M12 17v4", "M3 12h4", "M17 12h4", "m6 6 2.5 2.5", "m15.5 15.5 2.5 2.5", "m18 6-2.5 2.5", "M8.5 15.5 6 18"],
  music: ["M9 18V5l11-2v13", "M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z", "M20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"],
  dance: ["M14 5.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z", "M6 10l5-2 3 3 4-1", "M11 8l-1 6 4 2 1 5", "M10 14l-3 6"],
  palette: ["M12 3a9 9 0 1 0 0 18c1 0 1.5-.8 1.5-1.5 0-1-.8-1.3-.8-2.2 0-.9.7-1.3 1.6-1.3H17a4 4 0 0 0 4-4c0-5-4-9-9-9Z",
    "M7.5 11h.01", "M10 7h.01", "M15 7h.01"],
  pen: ["M4 20l4-1 11-11-3-3L5 16l-1 4Z", "M14 6l3 3"],
  mic: ["M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z", "M5 11a7 7 0 0 0 14 0", "M12 18v3"],
  camera: ["M4 8h3l2-3h6l2 3h3v11H4z", "M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"],
  heart: ["M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"],
  sun: ["M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M12 2v2", "M12 20v2", "m4.9 4.9 1.4 1.4", "m17.7 17.7 1.4 1.4",
    "M2 12h2", "M20 12h2", "m4.9 19.1 1.4-1.4", "m17.7 6.3 1.4-1.4"],
  moon: ["M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"],
  contrast: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 3v18", "M12 7h4", "M12 11h6", "M12 15h5"],
  monitor: ["M3 4h18v12H3z", "M8 20h8", "M12 16v4"],
};

export default function Icon({ name, size = 20, className = "icon", strokeWidth = 1.8 }) {
  const paths = PATHS[name];
  if (!paths) return null;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
