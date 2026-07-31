/** Avatar initials: first + last word ("Sara Colombo" -> "SC"), first two
 * letters for a single word, "?" for nothing. Handles contacts known only
 * by email as well as full names. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
