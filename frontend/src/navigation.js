// Single source of truth for pages: the header, the router and the
// placeholder pages all read from this list.
export const PAGES = [
  {
    path: "/explore",
    label: "Explore",
    inNav: false,
    phase: 10,
    title: "Career Explorer",
    description:
      "Browse careers as a tree: from your education to specializations, higher studies, government careers and entrepreneurship.",
  },
  {
    path: "/roadmap",
    label: "Roadmap",
    inNav: true,
    phase: 10,
    title: "Career Roadmap",
    description:
      "A stage-by-stage learning plan for your target career that skips what you already know.",
  },
  {
    path: "/resources",
    label: "Exams & Colleges",
    inNav: true,
    phase: 11,
    title: "Exams, Colleges & Scholarships",
    description:
      "Filterable lists with official source links and the date each entry was last verified.",
  },
  {
    path: "/mentor",
    label: "Mentor",
    inNav: true,
    phase: 12,
    title: "AI Career Mentor",
    description:
      "Ask career questions and get answers that use your profile and roadmap as context.",
  },
];

export const NAV_ITEMS = [
  { path: "/careers", label: "Careers" },
  { path: "/next-steps", label: "Next Steps" },
  { path: "/assessments", label: "Assessments" },
  ...PAGES.filter((page) => page.inNav),
];
