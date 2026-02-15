"use client";

import { createContext, useContext } from "react";

interface CompanyContextValue {
  logoUrl: string | null;
  isDemo: boolean;
}

const CompanyContext = createContext<CompanyContextValue>({ logoUrl: null, isDemo: false });

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
  return useContext(CompanyContext).logoUrl;
}

export function useIsDemo() {
  return useContext(CompanyContext).isDemo;
}
