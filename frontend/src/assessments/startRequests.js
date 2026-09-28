// Shared across page mounts so one page load sends exactly one start request
// (React's development double-mount would otherwise send two at once).
export const startRequests = new Map();

// Tests call this so cached requests never leak between test cases
export const resetStartRequests = () => startRequests.clear();
