/** Strips `passwordHash` before a `User` (with or without relations spread
 * onto it) is returned from a controller — Prisma has no reliable way to
 * exclude a field by default in this client version, so every call site
 * that returns a raw `prisma.user.*` result to an HTTP response must run it
 * through this first. */
export function toSafeUser<T extends { passwordHash?: string | null }>(
  user: T,
): Omit<T, 'passwordHash'> {
  const safe: Partial<T> = { ...user };
  delete safe.passwordHash;
  return safe as Omit<T, 'passwordHash'>;
}

export function toSafeUsers<T extends { passwordHash?: string | null }>(
  users: T[],
): Omit<T, 'passwordHash'>[] {
  return users.map(toSafeUser);
}
