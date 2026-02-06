"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { useTranslations } from "@/lib/i18n";
import { useGuideContext } from "@/components/ui/guide-context";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

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
  userRole?: string;
  dismissGuideId?: string;
  onComplete: () => void;
}

function TourOverlay({ steps, namespace, tourId, userRole, dismissGuideId, onComplete }: TourOverlayProps) {
  const t = useTranslations(namespace);
  const tTour = useTranslations("tour");
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tooltipSize, setTooltipSize] = useState({ width: 0, height: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const step = steps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;
  const isCentered = !step?.target;

  // Use role-specific done description if available
  const getDesc = useCallback((descKey: string) => {
    if (descKey === "doneDesc" && userRole && userRole !== "admin" && userRole !== "manager") {
      const employeeDesc = t("doneDescEmployee");
      if (employeeDesc && employeeDesc !== "doneDescEmployee") return employeeDesc;
    }
    return t(descKey);
  }, [t, userRole]);

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

    // Check if a dialog is currently open
    const dialog = document.querySelector('[role="dialog"]');
    setDialogOpen(!!dialog);
  }, [step]);

  // Measure tooltip size for auto-flip positioning
  useEffect(() => {
    if (tooltipRef.current) {
      const { offsetWidth, offsetHeight } = tooltipRef.current;
      if (offsetWidth !== tooltipSize.width || offsetHeight !== tooltipSize.height) {
        setTooltipSize({ width: offsetWidth, height: offsetHeight });
      }
    }
  });

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

  // ResizeObserver on the target element
  useEffect(() => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }

    if (!step?.target) return;

    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (el) {
      resizeObserverRef.current = new ResizeObserver(() => updateTargetRect());
      resizeObserverRef.current.observe(el);
    }

    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [step, updateTargetRect]);

  useEffect(() => {
    updateTargetRect();
    const handleResize = () => updateTargetRect();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);

    // MutationObserver to detect DOM changes (dialogs opening, content expanding)
    const observer = new MutationObserver(() => updateTargetRect());
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
      observer.disconnect();
    };
  }, [updateTargetRect]);

  const { dismiss } = useGuideContext();

  const completeTour = useCallback(async () => {
    onComplete();
    if (dismissGuideId) {
      // Page-specific tours use the dismissedGuides mechanism
      dismiss(dismissGuideId);
    } else {
      // Main tours use the dedicated complete-tour endpoint
      try {
        await fetch("/api/auth/complete-tour", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tourId }),
        });
      } catch {}
    }
  }, [tourId, dismissGuideId, onComplete, dismiss]);

  const handleNext = useCallback(() => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      completeTour();
    }
  }, [currentStep, steps.length, completeTour]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    completeTour();
  }, [completeTour]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleSkip();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleBack();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSkip, handleNext, handleBack]);

  const actuallyCenter = isCentered || !targetRect;

  // Auto-flip positioning: compute placement then check if it fits
  const getTooltipStyle = (): React.CSSProperties => {
    if (actuallyCenter) {
      return { position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    }

    const padding = 12;
    const viewportMargin = 16;
    let placement = step.placement || "bottom";

    // Auto-flip if tooltip would overflow
    const tw = tooltipSize.width || 320;
    const th = tooltipSize.height || 200;

    if (placement === "bottom" && targetRect!.bottom + padding + th > window.innerHeight - viewportMargin) {
      if (targetRect!.top - padding - th > viewportMargin) placement = "top";
    } else if (placement === "top" && targetRect!.top - padding - th < viewportMargin) {
      if (targetRect!.bottom + padding + th < window.innerHeight - viewportMargin) placement = "bottom";
    } else if (placement === "right" && targetRect!.right + padding + tw > window.innerWidth - viewportMargin) {
      if (targetRect!.left - padding - tw > viewportMargin) placement = "left";
    } else if (placement === "left" && targetRect!.left - padding - tw < viewportMargin) {
      if (targetRect!.right + padding + tw < window.innerWidth - viewportMargin) placement = "right";
    }

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

  const sr = targetRect && !actuallyCenter ? {
    top: targetRect.top - spotlightPadding,
    left: targetRect.left - spotlightPadding,
    right: targetRect.right + spotlightPadding,
    bottom: targetRect.bottom + spotlightPadding,
    width: targetRect.width + spotlightPadding * 2,
    height: targetRect.height + spotlightPadding * 2,
  } : null;

  return (
    <div className="fixed inset-0 z-[9999]" style={{ pointerEvents: "none" }}>
      {/* Visual overlay with SVG mask for rounded spotlight */}
      <svg className="fixed inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
        <defs>
          <mask id={`tour-mask-${tourId}`}>
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {sr && (
              <rect
                x={sr.left} y={sr.top}
                width={sr.width} height={sr.height}
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
        />
      </svg>

      {/* Click-blocking: four divs around spotlight so the hole is truly interactive */}
      {/* When a dialog is open, disable click-blocking to allow interaction with the dialog */}
      {!dialogOpen && (sr ? (
        <>
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: sr.top, pointerEvents: "auto" }} />
          <div style={{ position: "fixed", top: sr.bottom, left: 0, right: 0, bottom: 0, pointerEvents: "auto" }} />
          <div style={{ position: "fixed", top: sr.top, left: 0, width: sr.left, height: sr.height, pointerEvents: "auto" }} />
          <div style={{ position: "fixed", top: sr.top, left: sr.right, right: 0, height: sr.height, pointerEvents: "auto" }} />
        </>
      ) : (
        <div style={{ position: "fixed", inset: 0, pointerEvents: "auto" }} />
      ))}

      {sr && (
        <div
          className="fixed border-2 border-brand-400 rounded-lg pointer-events-none transition-all duration-300"
          style={{
            top: sr.top,
            left: sr.left,
            width: sr.width,
            height: sr.height,
            boxShadow: "0 0 0 2px rgba(99, 102, 241, 0.3), 0 0 20px rgba(99, 102, 241, 0.15)",
          }}
        />
      )}

      <div
        ref={tooltipRef}
        style={{ ...getTooltipStyle(), pointerEvents: "auto", transition: "top 300ms ease, left 300ms ease, bottom 300ms ease, right 300ms ease" }}
        className="z-[10000] w-80 rounded-xl border border-border bg-card p-5 shadow-2xl"
      >
        <button
          onClick={handleSkip}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close tour"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-medium text-brand-500">
            {tTour("stepOf")
              .replace("{current}", String(currentStep + 1))
              .replace("{total}", String(steps.length))}
          </span>
          {/* Progress dots */}
          <div className="flex items-center gap-1 ml-auto mr-6">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-colors duration-200 ${
                  i === currentStep ? "bg-brand-500" : i < currentStep ? "bg-brand-300" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>

        <h3 className="text-lg font-semibold text-foreground">{t(step.titleKey)}</h3>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{getDesc(step.descKey)}</p>

        <div className="mt-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!isFirstStep && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {tTour("back")}
              </button>
            )}
            <button
              onClick={handleSkip}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {tTour("skip")}
            </button>
          </div>
          <button
            onClick={handleNext}
            className="flex items-center gap-1 rounded-lg bg-brand-500 px-5 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            {isLastStep ? tTour("finish") : tTour("next")}
            {!isLastStep && <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Welcome Tour ───────────────────────────────────────────────────────────

const WELCOME_STEPS: TourStep[] = [
  { id: "welcome", titleKey: "welcome", descKey: "welcomeDesc" },
  { id: "timesheet", target: "timesheet", titleKey: "timesheet", descKey: "timesheetDesc", placement: "top" },
  { id: "stats", target: "stat-cards", titleKey: "stats", descKey: "statsDesc", placement: "bottom" },
  { id: "expenses", target: "sidebar-expenses", titleKey: "expenses", descKey: "expensesDesc", placement: "right" },
  { id: "vacations", target: "sidebar-vacations", titleKey: "vacations", descKey: "vacationsDesc", placement: "right" },
  { id: "projects", target: "sidebar-projects", titleKey: "projects", descKey: "projectsDesc", placement: "right", adminOnly: true },
  { id: "team", target: "sidebar-team", titleKey: "team", descKey: "teamDesc", placement: "right", adminOnly: true },
  { id: "admin", target: "sidebar-admin", titleKey: "admin", descKey: "adminDesc", placement: "right", adminOnly: true },
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
  const steps = useMemo(
    () => WELCOME_STEPS.filter((step) => !step.adminOnly || isAdmin),
    [isAdmin]
  );

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
      userRole={userRole}
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
  { id: "setup-company-expenses", target: "admin-company-expenses", titleKey: "companyExpenses", descKey: "companyExpensesDesc", placement: "top" },
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

// ─── Projects Page Tour ─────────────────────────────────────────────────────

const PROJECTS_STEPS: TourStep[] = [
  { id: "projects-welcome", titleKey: "welcome", descKey: "welcomeDesc" },
  { id: "projects-tabs", target: "projects-tabs", titleKey: "tabs", descKey: "tabsDesc", placement: "bottom" },
  { id: "projects-create", target: "projects-create-btn", titleKey: "createBtn", descKey: "createBtnDesc", placement: "bottom" },
  { id: "projects-table", target: "projects-table", titleKey: "table", descKey: "tableDesc", placement: "top" },
  { id: "projects-timeline", target: "projects-timeline-tab", titleKey: "timelineTab", descKey: "timelineTabDesc", placement: "bottom" },
  { id: "projects-done", titleKey: "done", descKey: "doneDesc" },
];

export function ProjectsTour() {
  const pathname = usePathname();
  const { isDismissed } = useGuideContext();
  const [active, setActive] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isDismissed("tour-projects") && pathname === "/projects") {
      const timer = setTimeout(() => setActive(true), 600);
      return () => clearTimeout(timer);
    }
  }, [isDismissed, pathname]);

  if (!mounted || !active) return null;

  return createPortal(
    <TourOverlay
      steps={PROJECTS_STEPS}
      namespace="projectsTour"
      tourId="projects"
      dismissGuideId="tour-projects"
      onComplete={() => setActive(false)}
    />,
    document.body
  );
}

// ─── Team Page Tour ─────────────────────────────────────────────────────────

const TEAM_STEPS: TourStep[] = [
  { id: "team-welcome", titleKey: "welcome", descKey: "welcomeDesc" },
  { id: "team-tabs", target: "team-tabs", titleKey: "tabs", descKey: "tabsDesc", placement: "bottom" },
  { id: "team-invite", target: "team-invite-btn", titleKey: "inviteBtn", descKey: "inviteBtnDesc", placement: "bottom" },
  { id: "team-table", target: "team-table", titleKey: "table", descKey: "tableDesc", placement: "top" },
  { id: "team-resource", target: "team-resource-tab", titleKey: "resourceTab", descKey: "resourceTabDesc", placement: "bottom" },
  { id: "team-done", titleKey: "done", descKey: "doneDesc" },
];

export function TeamTour() {
  const pathname = usePathname();
  const { isDismissed } = useGuideContext();
  const [active, setActive] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isDismissed("tour-team") && pathname === "/team") {
      const timer = setTimeout(() => setActive(true), 600);
      return () => clearTimeout(timer);
    }
  }, [isDismissed, pathname]);

  if (!mounted || !active) return null;

  return createPortal(
    <TourOverlay
      steps={TEAM_STEPS}
      namespace="teamTour"
      tourId="team"
      dismissGuideId="tour-team"
      onComplete={() => setActive(false)}
    />,
    document.body
  );
}
