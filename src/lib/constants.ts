// ---------------------------------------------------------------------------
// Shared app-wide constants.
// ---------------------------------------------------------------------------

/**
 * How many messages an anonymous (not-yet-signed-up) user may send before
 * they are prompted to create an account. Enforced server-side in
 * `/api/chat` and surfaced client-side via `/api/usage`.
 */
export const ANON_MESSAGE_LIMIT = 3;
