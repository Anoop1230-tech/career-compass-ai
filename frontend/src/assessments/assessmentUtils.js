// Labels and helpers shared by the assessment pages. Texts live in i18n/*.js:
//   assess.kind.<kind>  (test names)   assess.scale.<key>  (RIASEC, traits, aptitude categories)
//   assess.likert.<scale>.<1-5>        (answer choices)

export const LIKERT_SIZE = 5;

/** Label for a score scale; unknown keys fall back to readable text. */
export const scaleLabel = (t, key) => {
  const label = t(`assess.scale.${key}`);
  return label === `assess.scale.${key}` ? key.replaceAll("_", " ") : label;
};
export const kindLabel = (t, kind) => t(`assess.kind.${kind}`);
export const likertLabels = (t, scale) =>
  Array.from({ length: LIKERT_SIZE }, (_, i) => t(`assess.likert.${scale}.${i + 1}`));

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
