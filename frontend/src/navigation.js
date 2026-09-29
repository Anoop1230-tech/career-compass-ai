// Single source of truth for the product's features.
// Arranged in the order a user moves through the product: first their own
// journey, then exploring options, then preparing. The sidebar, the home page
// and the dashboard all read this list, so they never drift apart.
export const NAV_GROUPS = [
  {
    label: "Your journey",
    hint: "Personal guidance built from your profile",
    items: [
      { path: "/dashboard", label: "Dashboard", icon: "dashboard", text: "Your progress and the best thing to do next." },
      { path: "/next-steps", label: "Next Steps", icon: "steps", text: "Realistic paths from your current stage." },
      { path: "/for-you", label: "For You", icon: "star", text: "Careers ranked for you, with the reasons." },
      { path: "/roadmap", label: "Roadmap", icon: "map", text: "A stage-by-stage plan to your target career." },
    ],
  },
  {
    label: "Explore",
    hint: "Look around before you decide",
    items: [
      { path: "/careers", label: "Careers", icon: "briefcase", text: "Search careers: skills, exams and paths." },
      { path: "/explore", label: "Career Tree", icon: "tree", text: "Open the path step by step, school to promotion." },
      { path: "/dream-check", label: "Can I become…?", icon: "target", text: "Check a dream career: route, time, blockers." },
    ],
  },
  {
    label: "Prepare",
    hint: "Get ready for the next move",
    items: [
      { path: "/assessments", label: "Assessments", icon: "clipboard", text: "Short interest, aptitude and personality tests." },
      { path: "/resources", label: "Exams & Colleges", icon: "school", text: "Exams, colleges and scholarships, official links." },
      { path: "/mentor", label: "Mentor", icon: "chat", text: "Ask questions answered from your own profile." },
    ],
  },
];

// Flat list (every menu link), for anything that just needs all paths.
export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);
