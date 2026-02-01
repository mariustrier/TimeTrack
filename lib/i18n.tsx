"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import en from "@/messages/en.json";
import da from "@/messages/da.json";
import { da as daLocale } from "date-fns/locale/da";
import type { Locale as DateLocale } from "date-fns";

type Locale = "en" | "da";

const messages: Record<Locale, Record<string, unknown>> = { en, da };

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextType>({
  locale: "en",
  setLocale: () => {},
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("locale") as Locale | null;
    if (stored === "en" || stored === "da") {
      setLocaleState(stored);
    }
    setMounted(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem("locale", newLocale);
  }, []);

  if (!mounted) {
    return (
      <LocaleContext.Provider value={{ locale: "en", setLocale }}>
        {children}
      </LocaleContext.Provider>
    );
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === "object" && key in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }
  return typeof current === "string" ? current : path;
}

export function useTranslations(namespace?: string) {
  const { locale } = useLocale();

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const fullKey = namespace ? `${namespace}.${key}` : key;
      let value = getNestedValue(messages[locale], fullKey);
      // Fallback to English
      if (value === fullKey && locale !== "en") {
        value = getNestedValue(messages.en, fullKey);
      }
      // Interpolate params like {name}, {count}
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          value = value.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return value;
    },
    [locale, namespace]
  );

  return t;
}

export function useDateLocale(): DateLocale | undefined {
  const { locale } = useLocale();
  return locale === "da" ? (daLocale as DateLocale) : undefined;
}
