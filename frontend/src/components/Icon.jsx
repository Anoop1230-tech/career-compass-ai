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
