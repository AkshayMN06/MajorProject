// Bold-only inline formatting (**text**) for lesson theory content — the
// only inline markdown used in moduleData.ts. Text is HTML-escaped first:
// teacher-authored and uploaded material flows through here and is
// untrusted, and the result is rendered with dangerouslySetInnerHTML.
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function formatInline(s: string): string {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, '<strong class="text-white">$1</strong>');
}
