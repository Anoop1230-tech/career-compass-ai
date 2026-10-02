// Language list, stored choice and the translate() function (no React, so it can be used anywhere).
import en from "./en";
import hi from "./hi";
import optionsEn from "./options.en";
import optionsHi from "./options.hi";

export const LANGUAGES = [
  { value: "en", label: "English", short: "EN" },
  { value: "hi", label: "हिन्दी", short: "हि" },
];
export const DICTIONARIES = { en: { ...optionsEn, ...en }, hi: { ...optionsHi, ...hi } };
export const STORAGE_KEY = "cc-lang";

export function getStoredLanguage() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value in DICTIONARIES ? value : "en";
  } catch {
    return "en";
  }
}

/** Text for `key` in `lang`, falling back to English, then to the key; {name} placeholders are filled from vars. */
export function translate(lang, key, vars) {
  const text = DICTIONARIES[lang]?.[key] ?? DICTIONARIES.en[key] ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

/** Like translate(), but returns the fallback (e.g. the server's own text) when no dictionary has the key. */
export function translateOr(lang, key, fallback, vars) {
  return key in DICTIONARIES.en || key in (DICTIONARIES[lang] || {}) ? translate(lang, key, vars) : fallback;
}

/**
 * Choice lists from the server ({ stages: [{value, label}], ... }) with labels in `lang`.
 * Values the dictionaries don't know keep the server's label, so new server options still show.
 */
export function translateOptions(lang, options) {
  if (!options) return options;
  return Object.fromEntries(Object.entries(options).map(([list, items]) => [
    list,
    Array.isArray(items) && items.every((i) => i && typeof i === "object" && "value" in i)
      ? items.map((i) => ({ ...i, label: DICTIONARIES[lang]?.[`opt.${list}.${i.value}`] ?? i.label }))
      : items,
  ]));
}
