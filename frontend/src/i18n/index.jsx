// Tiny translation system (no library). Components call useI18n().t("key", { name: "Asha" }).
// Texts live in en.js and hi.js; the chosen language is saved per browser and set on <html lang>.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { setContentLanguage } from "../services/api";
import { DICTIONARIES, STORAGE_KEY, getStoredLanguage, translate, translateOptions, translateOr } from "./core";

const I18nContext = createContext({
  lang: "en", setLang: () => {}, t: (key, vars) => translate("en", key, vars), tOr: (key, fallback) => fallback, tOptions: (o) => o,
});

export function LanguageProvider({ children, initial }) {
  const [lang, setLangState] = useState(() => initial || getStoredLanguage());
  // Set during render (not in an effect) so requests made by children's effects already use it
  setContentLanguage(lang);

  const setLang = useCallback((value) => {
    if (!(value in DICTIONARIES)) return;
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* storage blocked: the language still applies for this visit */
    }
    setLangState(value);
  }, []);

  useEffect(() => {
    // Screen readers pick the right voice, and the browser the right font, from <html lang>
    document.documentElement.setAttribute("lang", lang);
  }, [lang]);

  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);
  const tOr = useCallback((key, fallback, vars) => translateOr(lang, key, fallback, vars), [lang]);
  const tOptions = useCallback((options) => translateOptions(lang, options), [lang]);
  const value = useMemo(() => ({ lang, setLang, t, tOr, tOptions }), [lang, setLang, t, tOr, tOptions]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() {
  return useContext(I18nContext);
}
