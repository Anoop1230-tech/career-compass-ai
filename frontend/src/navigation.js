// Single source of truth for the product's features.
// Arranged in the order a user moves through the product: first their own
// journey, then exploring options, then preparing. The sidebar, the home page
// and the dashboard all read this list, so they never drift apart.
// `key` is the translation key (i18n/en.js: "nav.<key>" and "nav.<key>.text");
// label/text are the English originals, used as a fallback.
export const NAV_GROUPS = [
  {
    key: "group.journey",
    label: "Your journey",
    hint: "Personal guidance built from your profile",
    items: [
      { key: "dashboard", path: "/dashboard", label: "Dashboard", icon: "dashboard", text: "Your progress and the best thing to do next." },
      { key: "nextSteps", path: "/next-steps", label: "Next Steps", icon: "steps", text: "Realistic paths from your current stage." },
      { key: "forYou", path: "/for-you", label: "For You", icon: "star", text: "Careers ranked for you, with the reasons." },
      { key: "roadmap", path: "/roadmap", label: "Roadmap", icon: "map", text: "A stage-by-stage plan to your target career." },
      { key: "report", path: "/report", label: "My Report", icon: "print", text: "One page to print or save as PDF." },
    ],
  },
  {
    key: "group.explore",
    label: "Explore",
    hint: "Look around before you decide",
    items: [
      { key: "careers", path: "/careers", label: "Careers", icon: "briefcase", text: "Search careers: skills, exams and paths." },
      { key: "explore", path: "/explore", label: "Career Tree", icon: "tree", text: "Open the path step by step, school to promotion." },
      { key: "dreamCheck", path: "/dream-check", label: "Can I become…?", icon: "target", text: "Check a dream career: route, time, blockers." },
      { key: "compare", path: "/compare", label: "Compare", icon: "compare", text: "Put 2–3 careers side by side." },
    ],
  },
  {
    key: "group.prepare",
    label: "Prepare",
    hint: "Get ready for the next move",
    items: [
      { key: "assessments", path: "/assessments", label: "Assessments", icon: "clipboard", text: "Short interest, aptitude and personality tests." },
      { key: "resources", path: "/resources", label: "Exams & Colleges", icon: "school", text: "Exams, colleges and scholarships, official links." },
      { key: "mentor", path: "/mentor", label: "Mentor", icon: "chat", text: "Ask questions answered from your own profile." },
    ],
  },
];

// Flat list (every menu link), for anything that just needs all paths.
export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

/** Translated label, description and hint for a group or item. */
export const navLabel = (t, entry) => t(`nav.${entry.key}`);
export const navText = (t, entry) => t(`nav.${entry.key}.${entry.items ? "hint" : "text"}`);
