// Labels and helpers shared by the assessment pages.

export const KIND_LABELS = {
  interest: "Interest profile",
  personality: "Personality and work style",
  aptitude: "Aptitude quiz",
};

export const SCALE_LABELS = {
  // RIASEC
  R: "Realistic – hands-on, tools, machines",
  I: "Investigative – analysing, researching",
  A: "Artistic – creating, designing",
  S: "Social – helping, teaching",
  E: "Enterprising – leading, persuading",
  C: "Conventional – organising, detail",
  // Personality
  extraversion: "Extraversion",
  agreeableness: "Agreeableness",
  conscientiousness: "Conscientiousness",
  emotional_stability: "Emotional stability",
  openness: "Openness to ideas",
  leadership: "Leadership",
  risk_tolerance: "Comfort with risk",
  team_orientation: "Team orientation",
  creativity: "Creativity",
  research_orientation: "Research orientation",
  // Aptitude
  numerical: "Numerical",
  logical: "Logical",
  verbal: "Verbal",
  spatial: "Spatial",
  problem_solving: "Problem solving",
};

export const LIKERT = {
  like: ["Strongly dislike", "Dislike", "Not sure", "Like", "Strongly like"],
  agree: ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"],
};

export const scaleLabel = (key) => SCALE_LABELS[key] || key.replaceAll("_", " ");

// Answers are kept in the browser while the test is in progress,
// so a refresh or accidental tab close does not lose them.
const storageKey = (kind, attemptId) => `cc_assessment_${kind}_${attemptId}`;

export function loadProgress(kind, attemptId) {
  try {
    const raw = window.localStorage.getItem(storageKey(kind, attemptId));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : { answers: {}, index: 0 };
  } catch {
    return { answers: {}, index: 0 }; // corrupted or blocked storage: start clean
  }
}

export function saveProgress(kind, attemptId, progress) {
  try {
    window.localStorage.setItem(storageKey(kind, attemptId), JSON.stringify(progress));
  } catch {
    // Storage full or disabled (private mode): the test still works, just without resume
  }
}

export function clearProgress(kind, attemptId) {
  try {
    window.localStorage.removeItem(storageKey(kind, attemptId));
  } catch {
    /* ignore */
  }
}
