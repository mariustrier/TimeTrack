"use client";

import { Info } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { useTranslations } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface InfoTooltipProps {
  textKey: string;
  namespace?: string;
  size?: number;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}

export function InfoTooltip({
  textKey,
  namespace = "infoTips",
  size = 14,
  className,
  side = "top",
}: InfoTooltipProps) {
  const t = useTranslations(namespace);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center justify-center cursor-help text-muted-foreground hover:text-foreground transition-colors",
            className
          )}
          tabIndex={0}
        >
          <Info className="shrink-0" style={{ width: size, height: size }} />
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs text-sm">
        {t(textKey)}
      </TooltipContent>
    </Tooltip>
  );
}
