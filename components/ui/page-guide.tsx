"use client";

import { useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import { useGuideContext } from "@/components/ui/guide-context";

interface PageGuideProps {
  pageId: string;
  titleKey: string;
  descKey: string;
  tips: string[];
}

export function PageGuide({ pageId, titleKey, descKey, tips }: PageGuideProps) {
  const t = useTranslations("guides");
  const { isDismissed, dismiss } = useGuideContext();
  const [hiding, setHiding] = useState(false);

  if (isDismissed(pageId) || hiding) return null;

  const handleDismiss = () => {
    setHiding(true);
    dismiss(pageId);
  };

  return (
    <div className="mb-6 rounded-xl border border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-950/30 p-5 relative animate-in fade-in duration-300">
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-900">
          <Lightbulb className="h-4 w-4 text-brand-600 dark:text-brand-400" />
        </div>
        <div className="flex-1 pr-6">
          <h3 className="text-sm font-semibold text-foreground">{t(titleKey)}</h3>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{t(descKey)}</p>
          <ul className="mt-3 space-y-1.5">
            {tips.map((tipKey) => (
              <li key={tipKey} className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                {t(tipKey)}
              </li>
            ))}
          </ul>
          <button
            onClick={handleDismiss}
            className="mt-4 rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-600 transition-colors"
          >
            {t("gotIt")}
          </button>
        </div>
      </div>
    </div>
  );
}
