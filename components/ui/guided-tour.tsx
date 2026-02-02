"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useTranslations } from "@/lib/i18n";
import { X } from "lucide-react";

// ─── Shared Tour Types & Overlay ────────────────────────────────────────────

interface TourStep {
  id: string;
  target?: string;
  titleKey: string;
  descKey: string;
  placement?: "top" | "bottom" | "left" | "right";
  adminOnly?: boolean;
}

interface TourOverlayProps {
  steps: TourStep[];
  namespace: string;
  tourId: string;
  onComplete: () => void;
}

function TourOverlay({ steps, namespace, tourId, onComplete }: TourOverlayProps) {
  const t = useTranslations(namespace);
  const tTour = useTranslations("tour");
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const isCentered = !step?.target;

  const updateTargetRect = useCallback(() => {
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
  }, [step]);

  // Scroll target into view when step changes
  useEffect(() => {
    if (!step?.target) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Update rect after scroll settles
      const timer = setTimeout(() => updateTargetRect(), 400);
      return () => clearTimeout(timer);
    }
  }, [step, updateTargetRect]);

  useEffect(() => {
    updateTargetRect();
    const handleResize = () => updateTargetRect();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [updateTargetRect]);

  const completeTour = useCallback(async () => {
    onComplete();
    try {
      await fetch("/api/auth/complete-tour", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tourId }),
      });
    } catch {}
  }, [tourId, onComplete]);

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

  const actuallyCenter = isCentered || !targetRect;

  const getTooltipStyle = (): React.CSSProperties => {
    if (actuallyCenter) {
      return { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    }
    const padding = 12;
    const placement = step.placement || "bottom";
    switch (placement) {
      case "right":
        return { position: "fixed", top: targetRect!.top + targetRect!.height / 2, left: targetRect!.right + padding, transform: "translateY(-50%)" };
      case "left":
        return { position: "fixed", top: targetRect!.top + targetRect!.height / 2, right: window.innerWidth - targetRect!.left + padding, transform: "translateY(-50%)" };
      case "top":
        return { position: "fixed", bottom: window.innerHeight - targetRect!.top + padding, left: targetRect!.left + targetRect!.width / 2, transform: "translateX(-50%)" };
      case "bottom":
      default:
        return { position: "fixed", top: targetRect!.bottom + padding, left: targetRect!.left + targetRect!.width / 2, transform: "translateX(-50%)" };
    }
  };

  const spotlightPadding = 8;
  const spotlightRadius = 8;

  return (
    <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: "none" }}>
      <svg className="fixed inset-0 w-full h-full">
        <defs>
          <mask id={`tour-mask-${tourId}`}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {targetRect && !actuallyCenter && (
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
          x="0" y="0" width="100%" height="100%"
          fill="rgba(0, 0, 0, 0.6)"
          mask={`url(#tour-mask-${tourId})`}
          style={{ pointerEvents: "auto" }}
        />
      </svg>

      {targetRect && !actuallyCenter && (
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

      <div
        ref={tooltipRef}
        style={{ ...getTooltipStyle(), pointerEvents: "auto" }}
        className="z-[10000] w-80 rounded-xl border border-border bg-card p-5 shadow-2xl"
      >
        <button
          onClick={handleSkip}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="text-xs font-medium text-brand-500 mb-2">
          {tTour("stepOf")
            .replace("{current}", String(currentStep + 1))
            .replace("{total}", String(steps.length))}
        </div>

        <h3 className="text-lg font-semibold text-foreground">{t(step.titleKey)}</h3>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{t(step.descKey)}</p>

        <div className="mt-5 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {tTour("skip")}
          </button>
          <button
            onClick={handleNext}
            className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            {isLastStep ? tTour("finish") : tTour("next")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Welcome Tour ───────────────────────────────────────────────────────────

const WELCOME_STEPS: TourStep[] = [
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
  const [active, setActive] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isAdmin = userRole === "admin" || userRole === "manager";
  const steps = WELCOME_STEPS.filter((step) => !step.adminOnly || isAdmin);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (showTour && pathname === "/dashboard") {
      const timer = setTimeout(() => setActive(true), 500);
      return () => clearTimeout(timer);
    }
  }, [showTour, pathname]);

  if (!mounted || !active) return null;

  return createPortal(
    <TourOverlay
      steps={steps}
      namespace="tour"
      tourId="welcome"
      onComplete={() => setActive(false)}
    />,
    document.body
  );
}

// ─── Admin Setup Tour ───────────────────────────────────────────────────────

const SETUP_STEPS: TourStep[] = [
  { id: "setup-welcome", titleKey: "welcome", descKey: "welcomeDesc" },
  { id: "setup-currency", target: "admin-currency", titleKey: "currency", descKey: "currencyDesc", placement: "top" },
  { id: "setup-bill", target: "admin-bill-rate", titleKey: "billRate", descKey: "billRateDesc", placement: "top" },
  { id: "setup-expense", target: "admin-expense-settings", titleKey: "expenseSettings", descKey: "expenseSettingsDesc", placement: "top" },
  { id: "setup-done", titleKey: "done", descKey: "doneDesc" },
];

interface AdminSetupTourProps {
  showTour: boolean;
  userRole: string;
}

export function AdminSetupTour({ showTour, userRole }: AdminSetupTourProps) {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isAdmin = userRole === "admin" || userRole === "manager";

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (showTour && isAdmin && pathname === "/admin") {
      const timer = setTimeout(() => setActive(true), 500);
      return () => clearTimeout(timer);
    }
  }, [showTour, isAdmin, pathname]);

  if (!mounted || !active) return null;

  return createPortal(
    <TourOverlay
      steps={SETUP_STEPS}
      namespace="setupTour"
      tourId="setup"
      onComplete={() => setActive(false)}
    />,
    document.body
  );
}
