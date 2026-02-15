import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/layout/Sidebar";
import { isSuperAdmin } from "@/lib/auth";
import { Toaster } from "sonner";
import { LocaleProvider } from "@/lib/i18n";
import { CookieConsent } from "@/components/ui/cookie-consent";
import { GuidedTour, AdminSetupTour, ProjectsTour, TeamTour } from "@/components/ui/guided-tour";
import { GuideProvider } from "@/components/ui/guide-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CompanyProvider } from "@/lib/company-context";
import { DemoBanner } from "@/components/DemoBanner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await db.user.findUnique({
    where: { clerkId: userId },
    include: { company: { select: { logoUrl: true, isDemo: true } } },
  });

  if (!user) {
    redirect("/onboarding");
  }

  if (user.deletedAt) {
    redirect("/sign-in");
  }

  if (!user.acceptedTermsAt) {
    redirect("/consent");
  }

  // Check for active support session (super admin only)
  let supportMode = false;
  let supportCompanyName: string | null = null;
  if (isSuperAdmin(user.email)) {
    const activeSupportAccess = await db.supportAccess.findFirst({
      where: { requestedBy: user.id, status: "active" },
      include: { company: { select: { name: true } } },
    });
    if (activeSupportAccess) {
      supportMode = true;
      supportCompanyName = activeSupportAccess.company.name;
    }
  }

  const isDemo = !!user.company?.isDemo;

  return (
    <LocaleProvider>
      <TooltipProvider delayDuration={200}>
      <CompanyProvider logoUrl={user.company?.logoUrl ?? null} isDemo={isDemo}>
      <GuideProvider dismissedGuides={user.dismissedGuides}>
        {isDemo && <DemoBanner />}
        <div className={`flex overflow-hidden bg-background ${isDemo ? "mt-[40px] h-[calc(100vh-40px)]" : "h-screen"}`}>
          <Sidebar
            userRole={user.role}
            isSuperAdmin={isSuperAdmin(user.email)}
            supportMode={supportMode}
            supportCompanyName={supportCompanyName}
          />
          <main className="flex-1 overflow-y-auto">
            <div className="p-6 lg:p-8">{children}</div>
          </main>
          <Toaster richColors />
          <CookieConsent />
          <GuidedTour showTour={!user.tourCompletedAt} userRole={user.role} />
          <AdminSetupTour showTour={!user.setupTourCompletedAt && !!user.tourCompletedAt} userRole={user.role} />
          <ProjectsTour />
          <TeamTour />
        </div>
      </GuideProvider>
      </CompanyProvider>
      </TooltipProvider>
    </LocaleProvider>
  );
}
