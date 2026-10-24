// Filtre automatique de premier niveau. Ce n'est pas une modération : c'est un
// garde-fou qui bloque l'évident et les coordonnées personnelles. La vraie
// modération reste humaine (file de modération + signalements).
const BLOCKED = [
  'connard', 'connasse', 'salope', 'pute', 'encul', 'fdp', 'ntm', 'nique ta', 'niquer ta',
  'pd ', 'tapette', 'negro', 'bougnoul', 'youpin', 'sale arabe', 'sale noir', 'sale juif',
  'suicide-toi', 'va te tuer', 'tue-toi', 'kys', 'grosse vache', 'batard', 'bâtard',
];
const norm = (s) => ` ${String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[0@]/g, 'o').replace(/[1!]/g, 'i').replace(/3/g, 'e').replace(/\$/g, 's')} `;
// Chaque terme doit commencer un mot ("dispute" ne déclenche pas "pute").
const BLOCKED_RE = BLOCKED.map((w) => new RegExp(`(?:^|[^a-z])${norm(w).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));

// Protection des mineurs : pas d'échange de coordonnées dans les espaces publics.
const CONTACT = [
  /(?:\+33|0)\s*[1-9](?:[\s.-]*\d{2}){4}/,                 // téléphone FR
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,                // e-mail
  /\b(snap|snapchat|insta|whatsapp|telegram|discord)\s*[:@]\s*\S+/i, // "ajoute-moi sur snap: x"
];

export function checkText(text) {
  const n = norm(text);
  if (BLOCKED_RE.some((r) => r.test(n))) return { ok: false, reason: 'Ce message contient des propos interdits par la charte.' };
  if (CONTACT.some((r) => r.test(text))) return { ok: false, reason: 'Pas de coordonnées personnelles (téléphone, e-mail, pseudo d\'une autre appli) dans les espaces publics.' };
  return { ok: true };
}

export const AUTO_HIDE_REPORTS = 3; // un commentaire signalé par 3 personnes est masqué en attendant revue
