// Single source of truth for pages: the header, the router and the
// placeholder pages all read from this list.
export const PAGES = [
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
  { path: "/for-you", label: "For You" },
  { path: "/careers", label: "Careers" },
  { path: "/next-steps", label: "Next Steps" },
  { path: "/assessments", label: "Assessments" },
  { path: "/roadmap", label: "Roadmap" },
  { path: "/resources", label: "Exams & Colleges" },
  ...PAGES.filter((page) => page.inNav),
];
