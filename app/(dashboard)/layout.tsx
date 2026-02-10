import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/layout/sidebar";
import { isSuperAdmin } from "@/lib/auth";
import { Toaster } from "sonner";
import { LocaleProvider } from "@/lib/i18n";
import { CookieConsent } from "@/components/ui/cookie-consent";
import { GuidedTour, AdminSetupTour, ProjectsTour, TeamTour } from "@/components/ui/guided-tour";
import { GuideProvider } from "@/components/ui/guide-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CompanyProvider } from "@/lib/company-context";

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
    include: { company: { select: { logoUrl: true } } },
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

  return (
    <LocaleProvider>
      <TooltipProvider delayDuration={200}>
      <CompanyProvider logoUrl={user.company?.logoUrl ?? null}>
      <GuideProvider dismissedGuides={user.dismissedGuides}>
        <div className="flex h-screen overflow-hidden bg-background">
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
