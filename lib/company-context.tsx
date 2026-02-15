"use client";

import { createContext, useContext } from "react";

interface CompanyContextValue {
  logoUrl: string | null;
  isDemo: boolean;
}

const MISSING = Symbol("CompanyContext not provided");
const CompanyContext = createContext<CompanyContextValue | typeof MISSING>(MISSING);

function useCompanyContext(): CompanyContextValue {
  const ctx = useContext(CompanyContext);
  if (ctx === MISSING) {
    throw new Error("useCompanyLogo/useIsDemo must be used inside <CompanyProvider>");
  }
  return ctx;
}

export function CompanyProvider({
  logoUrl,
  isDemo,
  children,
}: {
  logoUrl: string | null;
  isDemo: boolean;
  children: React.ReactNode;
}) {
  return (
    <CompanyContext.Provider value={{ logoUrl, isDemo }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompanyLogo() {
  return useCompanyContext().logoUrl;
}

export function useIsDemo() {
  return useCompanyContext().isDemo;
}
