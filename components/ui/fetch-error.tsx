"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "@/lib/i18n";

interface FetchErrorProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function FetchError({ message, onRetry, className }: FetchErrorProps) {
  const t = useTranslations("common");

  return (
    <div className={`flex flex-col items-center justify-center py-16 ${className ?? ""}`}>
      <AlertCircle className="h-12 w-12 text-muted-foreground/50" />
      <h3 className="mt-4 text-lg font-semibold text-foreground">
        {t("fetchErrorTitle")}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {message || t("fetchErrorDescription")}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-4 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          {t("tryAgain")}
        </Button>
      )}
    </div>
  );
}
