// Shared password rule (same as the backend), so forms can say what is wrong before sending.
// Returns a translation key (see i18n/en.js "password.*"), or "" when the password is fine.
export function passwordProblem(password) {
  if (password.length < 8) return "password.tooShort";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "password.letterAndNumber";
  return "";
}

export const PASSWORD_HINT = "password.hint";
