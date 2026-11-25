/** Same-site redirect target for ?next= (anything else falls back to /account). */
export function safeNext(next: string | string[] | null | undefined): string {
  const n = Array.isArray(next) ? next[0] : next;
  if (!n || !n.startsWith("/") || n.startsWith("//") || n.startsWith("/\\") || n.startsWith("/api/") || n.length > 300) return "/account";
  return n;
}
