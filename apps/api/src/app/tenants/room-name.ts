/**
 * Rooms live in one flat LiveKit namespace, so a tenant's slug has to be
 * prefixed with its key before it ever reaches LiveKit. Without this, two
 * customers who both call a room `daily` share one call.
 *
 * `~` is the separator because the slug rule (`CreateRoomDto`, and the client's
 * matching rule) only admits letters, digits and hyphens — so a `~` in a room
 * name can only ever be the one we put there.
 */
export const TENANT_ROOM_SEPARATOR = '~';

export function livekitRoomName(
  tenantKey: string | null | undefined,
  slug: string,
): string {
  return tenantKey ? `${tenantKey}${TENANT_ROOM_SEPARATOR}${slug}` : slug;
}

/**
 * Split a LiveKit room name back into the tenant key and the tenant-facing
 * slug. First-party rooms carry no prefix and come back with a null key.
 */
export function parseLivekitRoomName(room: string): {
  tenantKey: string | null;
  slug: string;
} {
  const at = room.indexOf(TENANT_ROOM_SEPARATOR);
  if (at === -1) return { tenantKey: null, slug: room };
  return { tenantKey: room.slice(0, at), slug: room.slice(at + 1) };
}
