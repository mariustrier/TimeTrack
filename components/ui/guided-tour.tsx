"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useTranslations } from "@/lib/i18n";
import { X } from "lucide-react";

interface TourStep {
  id: string;
  target?: string; // data-tour attribute value, undefined = centered overlay
  titleKey: string;
  descKey: string;
  placement?: "top" | "bottom" | "left" | "right";
  adminOnly?: boolean;
}

const ALL_STEPS: TourStep[] = [
  { id: "welcome", titleKey: "welcome", descKey: "welcomeDesc" },
  { id: "projects", target: "sidebar-projects", titleKey: "projects", descKey: "projectsDesc", placement: "right", adminOnly: true },
  { id: "team", target: "sidebar-team", titleKey: "team", descKey: "teamDesc", placement: "right", adminOnly: true },
  { id: "admin", target: "sidebar-admin", titleKey: "admin", descKey: "adminDesc", placement: "right", adminOnly: true },
  { id: "timesheet", target: "timesheet", titleKey: "timesheet", descKey: "timesheetDesc", placement: "top" },
  { id: "stats", target: "stat-cards", titleKey: "stats", descKey: "statsDesc", placement: "bottom" },
  { id: "analytics", target: "sidebar-analytics", titleKey: "analytics", descKey: "analyticsDesc", placement: "right", adminOnly: true },
  { id: "done", titleKey: "done", descKey: "doneDesc" },
];

interface GuidedTourProps {
  showTour: boolean;
  userRole: string;
}

export function GuidedTour({ showTour, userRole }: GuidedTourProps) {
  const pathname = usePathname();
  const t = useTranslations("tour");
  const [active, setActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const isAdmin = userRole === "admin" || userRole === "manager";

  const steps = ALL_STEPS.filter((step) => !step.adminOnly || isAdmin);

  // Only activate on /dashboard
  useEffect(() => {
    if (showTour && pathname === "/dashboard") {
      // Small delay to let the dashboard render first
      const timer = setTimeout(() => setActive(true), 500);
      return () => clearTimeout(timer);
    }
  }, [showTour, pathname]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateTargetRect = useCallback(() => {
    const step = steps[currentStep];
    if (!step?.target) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [currentStep, steps]);

  useEffect(() => {
    if (!active) return;
    updateTargetRect();
    const handleResize = () => updateTargetRect();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [active, updateTargetRect]);

  const completeTour = useCallback(async () => {
    setActive(false);
    try {
      await fetch("/api/auth/complete-tour", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch {
      // Silently fail
    }
  }, []);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      completeTour();
    }
  };

  const handleSkip = () => {
    completeTour();
  };

  if (!mounted || !active) return null;

  const step = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const isCentered = !step.target || !targetRect;

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (isCentered) {
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const padding = 12;
    const placement = step.placement || "bottom";

    switch (placement) {
      case "right":
        return {
          position: "fixed",
          top: targetRect!.top + targetRect!.height / 2,
          left: targetRect!.right + padding,
          transform: "translateY(-50%)",
        };
      case "left":
        return {
          position: "fixed",
          top: targetRect!.top + targetRect!.height / 2,
          right: window.innerWidth - targetRect!.left + padding,
          transform: "translateY(-50%)",
        };
      case "top":
        return {
          position: "fixed",
          bottom: window.innerHeight - targetRect!.top + padding,
          left: targetRect!.left + targetRect!.width / 2,
          transform: "translateX(-50%)",
        };
      case "bottom":
      default:
        return {
          position: "fixed",
          top: targetRect!.bottom + padding,
          left: targetRect!.left + targetRect!.width / 2,
          transform: "translateX(-50%)",
        };
    }
  };

  // SVG spotlight mask
  const spotlightPadding = 8;
  const spotlightRadius = 8;

  const overlay = (
    <div className="fixed inset-0 z-[9999]" onClick={(e) => e.stopPropagation()}>
      {/* Backdrop with spotlight cutout */}
      <svg className="fixed inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
        <defs>
          <mask id="tour-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && !isCentered && (
              <rect
                x={targetRect.left - spotlightPadding}
                y={targetRect.top - spotlightPadding}
                width={targetRect.width + spotlightPadding * 2}
                height={targetRect.height + spotlightPadding * 2}
                rx={spotlightRadius}
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.6)"
          mask="url(#tour-spotlight-mask)"
          style={{ pointerEvents: "auto" }}
          onClick={handleSkip}
        />
      </svg>

      {/* Spotlight ring */}
      {targetRect && !isCentered && (
        <div
          className="fixed border-2 border-brand-400 rounded-lg pointer-events-none transition-all duration-300"
          style={{
            top: targetRect.top - spotlightPadding,
            left: targetRect.left - spotlightPadding,
            width: targetRect.width + spotlightPadding * 2,
            height: targetRect.height + spotlightPadding * 2,
            boxShadow: "0 0 0 2px rgba(99, 102, 241, 0.3), 0 0 20px rgba(99, 102, 241, 0.15)",
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        style={getTooltipStyle()}
        className="z-[10000] w-80 rounded-xl border border-border bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Step counter */}
        <div className="text-xs font-medium text-brand-500 mb-2">
          {t("stepOf")
            .replace("{current}", String(currentStep + 1))
            .replace("{total}", String(steps.length))}
        </div>

        {/* Content */}
        <h3 className="text-lg font-semibold text-foreground">{t(step.titleKey)}</h3>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{t(step.descKey)}</p>

        {/* Actions */}
        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("skip")}
          </button>
          <button
            onClick={handleNext}
            className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            {isLastStep ? t("finish") : t("next")}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
