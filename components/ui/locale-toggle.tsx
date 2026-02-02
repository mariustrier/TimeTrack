"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n";

export function LocaleToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className={className || "h-9 w-9 text-xs font-bold"}>
        EN
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className || "h-9 w-9 text-xs font-bold"}
      onClick={() => setLocale(locale === "en" ? "da" : "en")}
      title={locale === "en" ? "Skift til dansk" : "Switch to English"}
    >
      {locale === "en" ? "DA" : "EN"}
    </Button>
  );
}
