import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/layout/sidebar";
import { isSuperAdmin } from "@/lib/auth";
import { Toaster } from "sonner";
import { LocaleProvider } from "@/lib/i18n";
import { CookieConsent } from "@/components/ui/cookie-consent";
import { GuidedTour } from "@/components/ui/guided-tour";

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

  return (
    <LocaleProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        <Sidebar userRole={user.role} isSuperAdmin={isSuperAdmin(user.email)} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 lg:p-8">{children}</div>
        </main>
        <Toaster richColors />
        <CookieConsent />
        <GuidedTour showTour={!user.tourCompletedAt} userRole={user.role} />
      </div>
    </LocaleProvider>
  );
}
