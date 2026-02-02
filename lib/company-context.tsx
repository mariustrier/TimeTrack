"use client";

import { createContext, useContext } from "react";

interface CompanyContextValue {
  logoUrl: string | null;
}

const CompanyContext = createContext<CompanyContextValue>({ logoUrl: null });

export function CompanyProvider({
  logoUrl,
  children,
}: {
  logoUrl: string | null;
  children: React.ReactNode;
}) {
  return (
    <CompanyContext.Provider value={{ logoUrl }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompanyLogo() {
  return useContext(CompanyContext).logoUrl;
}
