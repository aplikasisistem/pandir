import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, SUPPORTED_LANGUAGES, LanguageItem } from '../utils/translations';

interface LanguageContextType {
  currentLang: string;
  setLanguage: (lang: string) => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
  languages: LanguageItem[];
  currentLanguageItem: LanguageItem;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'pandirstore_lang';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLang, setCurrentLangState] = useState<string>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) return saved;
        // Check browser language preference if available
        const browserLang = navigator.language?.toLowerCase();
        if (browserLang && !browserLang.startsWith('id')) {
          return 'en';
        }
      }
    } catch {
      // Fallback
    }
    return 'id';
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = currentLang;
      document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    }
  }, [currentLang]);

  const setLanguage = useCallback((newLang: string) => {
    setCurrentLangState(newLang);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, newLang);
        // Also sync Google Translate cookie if someone uses Google Translate widget
        const cookieVal = `/id/${newLang}`;
        document.cookie = `googtrans=${cookieVal}; path=/;`;
        if (window.location.hostname) {
          document.cookie = `googtrans=${cookieVal}; path=/; domain=${window.location.hostname};`;
        }
        const selectEl = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;
        if (selectEl) {
          selectEl.value = newLang;
          selectEl.dispatchEvent(new Event('change'));
        }
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, []);

  const t = useCallback(
    (key: string, variables?: Record<string, string | number>): string => {
      const activeDict = translations[currentLang] || translations['id'] || {};
      let text = activeDict[key] || translations['en']?.[key] || translations['id']?.[key] || key;

      if (variables) {
        Object.entries(variables).forEach(([k, v]) => {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        });
      }

      return text;
    },
    [currentLang]
  );

  const currentLanguageItem =
    SUPPORTED_LANGUAGES.find((item) => item.code.toLowerCase() === currentLang.toLowerCase()) ||
    SUPPORTED_LANGUAGES[0];

  return (
    <LanguageContext.Provider
      value={{
        currentLang,
        setLanguage,
        t,
        languages: SUPPORTED_LANGUAGES,
        currentLanguageItem,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
