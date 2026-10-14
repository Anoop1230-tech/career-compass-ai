/** Degree families: many catalog stages (one per branch) shown as one row with the branches under it.
 * Labels: family.<key> in i18n/*.js */
export const FAMILIES = [
  { key: "btech", prefix: "EDU_BTECH_" },
  { key: "diploma", prefix: "EDU_DIPLOMA_" },
  { key: "mtech", prefix: "EDU_MTECH_" },
];

export function familyOf(stageId) {
  return (stageId && FAMILIES.find((f) => stageId.startsWith(f.prefix))) || null;
}

/** "B.Tech – Civil" -> "Civil" (Hindi names use a plain hyphen). */
export function branchName(name) {
  const m = /\s[–-]\s/.exec(name || "");
  return m ? name.slice(m.index + m[0].length) : name;
}

/**
 * Folds items of the same degree family into one entry, kept at the position of its first item.
 * Returns [{ item }] for single items and [{ family, items }] for families with 2+ branches.
 */
export function foldFamilies(items, getStageId) {
  const out = [];
  const byKey = new Map();
  for (const item of items) {
    const family = familyOf(getStageId(item));
    if (!family) {
      out.push({ item });
      continue;
    }
    if (!byKey.has(family.key)) {
      const entry = { family, items: [] };
      byKey.set(family.key, entry);
      out.push(entry);
    }
    byKey.get(family.key).items.push(item);
  }
  // A family with a single branch is shown as a normal item
  return out.map((e) => (e.items && e.items.length === 1 ? { item: e.items[0] } : e));
}

/** Stage dropdown groups: by level, but each degree family gets its own group of branch names. */
export function groupStages(stages, t) {
  const map = new Map();
  for (const s of stages) {
    const family = familyOf(s.stage_id);
    const label = family ? t(`family.${family.key}`) : t(`next.level.${s.level}`);
    if (!map.has(label)) map.set(label, []);
    map.get(label).push({ ...s, label: family ? branchName(s.name) : s.name });
  }
  return [...map.entries()];
}
