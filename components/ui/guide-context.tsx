"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface GuideContextValue {
  isDismissed: (pageId: string) => boolean;
  dismiss: (pageId: string) => void;
}

const GuideContext = createContext<GuideContextValue>({
  isDismissed: () => false,
  dismiss: () => {},
});

export function GuideProvider({
  dismissedGuides: initial,
  children,
}: {
  dismissedGuides: string[];
  children: React.ReactNode;
}) {
  const [dismissed, setDismissed] = useState<string[]>(initial);

  const isDismissed = useCallback(
    (pageId: string) => dismissed.includes(pageId),
    [dismissed]
  );

  const dismiss = useCallback((pageId: string) => {
    setDismissed((prev) => [...prev, pageId]);
    fetch("/api/auth/dismiss-guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageId }),
    }).catch(() => {});
  }, []);

  return (
    <GuideContext.Provider value={{ isDismissed, dismiss }}>
      {children}
    </GuideContext.Provider>
  );
}

export function useGuideContext() {
  return useContext(GuideContext);
}
