const MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

export const fullName = (m) => [m.first_name, m.last_name].filter(Boolean).join(' ');

export const fullNameWithPatronymic = (m) =>
  [m.first_name, m.middle_name, m.last_name].filter(Boolean).join(' ');

export const initials = (m) =>
  `${(m.first_name || '').charAt(0)}${(m.last_name || '').charAt(0)}`.toUpperCase();

export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d}-${MONTHS[m - 1]}, ${y}`;
}

export const yearOf = (iso) => (iso ? Number(iso.slice(0, 4)) : null);

export function lifeSpan(m) {
  const born = yearOf(m.birth_date);
  const died = yearOf(m.death_date);
  if (!born && !died) return '';
  if (died) return `${born ?? '?'} – ${died}`;
  return `${born} –`;
}

export function ageOf(m, today = new Date()) {
  if (!m.birth_date) return null;
  const [by, bm, bd] = m.birth_date.split('-').map(Number);
  let ey = today.getFullYear();
  let em = today.getMonth() + 1;
  let ed = today.getDate();
  if (m.death_date) [ey, em, ed] = m.death_date.split('-').map(Number);
  let age = ey - by;
  if (em < bm || (em === bm && ed < bd)) age -= 1;
  return age;
}

export function daysLabel(days) {
  if (days === 0) return 'Bugun!';
  if (days === 1) return 'Ertaga';
  return `${days} kundan so'ng`;
}

// Oila daraxtini qurish: har bir tugun — er-xotin (yoki yolg'iz inson) va ularning bolalari.
export function buildForest(members) {
  const byId = new Map(members.map((m) => [m.id, m]));
  const childrenOf = new Map();
  for (const m of members) {
    for (const pid of [m.father_id, m.mother_id]) {
      if (pid && byId.has(pid)) {
        if (!childrenOf.has(pid)) childrenOf.set(pid, []);
        childrenOf.get(pid).push(m);
      }
    }
  }
  const hasParents = (m) =>
    Boolean((m.father_id && byId.has(m.father_id)) || (m.mother_id && byId.has(m.mother_id)));
  const byBirth = (a, b) =>
    (a.birth_date || '9999').localeCompare(b.birth_date || '9999') || a.id - b.id;

  const visited = new Set();

  function unitFor(person) {
    if (visited.has(person.id)) return null;
    visited.add(person.id);
    const spouse = person.spouse_id ? byId.get(person.spouse_id) : null;
    const partner = spouse && !visited.has(spouse.id) ? spouse : null;
    if (partner) visited.add(partner.id);

    const kids = new Map();
    for (const p of [person, partner]) {
      if (!p) continue;
      for (const kid of childrenOf.get(p.id) || []) kids.set(kid.id, kid);
    }
    const children = [...kids.values()].sort(byBirth).map(unitFor).filter(Boolean);
    return { person, partner, children };
  }

  const roots = [];
  const rootCandidates = [...members].filter((m) => !hasParents(m)).sort(byBirth);
  for (const m of rootCandidates) {
    // Ota-onasi bor odamga uylangan inson o'sha shoxda ko'rsatiladi.
    const spouse = m.spouse_id ? byId.get(m.spouse_id) : null;
    if (spouse && hasParents(spouse)) continue;
    const unit = unitFor(m);
    if (unit) roots.push(unit);
  }
  // Himoya: hech qaysi shoxga tushmagan a'zolar alohida ko'rsatiladi.
  for (const m of [...members].sort(byBirth)) {
    const unit = unitFor(m);
    if (unit) roots.push(unit);
  }
  return roots;
}
