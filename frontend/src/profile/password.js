// Shared password rule (same as the backend), so forms can say what is wrong before sending.
export function passwordProblem(password) {
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Include at least one letter and one number.";
  return "";
}

export const PASSWORD_HINT = "At least 8 characters, with a letter and a number.";
