/**
 * Latin letters, Persian letters, digits and hyphens — mirrors the client-side
 * slug rule. Shared by the first-party and the platform APIs so the two cannot
 * drift apart; in particular neither may admit the `~` that separates a
 * tenant's key from its slug in LiveKit room names.
 */
export const ROOM_SLUG_PATTERN = /^[a-z0-9؀-ۿ-]+$/u;

export const ROOM_SLUG_MESSAGE =
  'نشانی اتاق فقط می‌تواند حرف، رقم و خط تیره داشته باشد.';
