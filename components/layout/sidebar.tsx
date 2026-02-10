"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Palmtree,
  FolderKanban,
  Users,
  BarChart3,
  TrendingUp,
  Sparkles,
  Shield,
  Receipt,
  Settings,
  LogOut,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LogoIcon } from "@/components/ui/logo-icon";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LocaleToggle } from "@/components/ui/locale-toggle";
import { useTranslations } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface NavItem {
  labelKey: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
  badge?: boolean;
  superAdminOnly?: boolean;
}

const navItems: NavItem[] = [
  { labelKey: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "admin", href: "/admin", icon: BarChart3, roles: ["admin"], badge: true },
  { labelKey: "team", href: "/team", icon: Users, roles: ["admin", "manager"] },
  { labelKey: "projects", href: "/projects", icon: FolderKanban, roles: ["admin", "manager"] },
  { labelKey: "aiAssistant", href: "/ai", icon: Sparkles, roles: ["admin", "manager"], badge: true },
  { labelKey: "analytics", href: "/analytics", icon: TrendingUp, roles: ["admin", "manager"] },
  { labelKey: "expenses", href: "/expenses", icon: Receipt },
  { labelKey: "vacations", href: "/vacations", icon: Palmtree },
  { labelKey: "settings", href: "/settings", icon: Settings },
  { labelKey: "platform", href: "/super-admin", icon: Shield, superAdminOnly: true },
];

interface SidebarProps {
  userRole: string;
  isSuperAdmin?: boolean;
  supportMode?: boolean;
  supportCompanyName?: string | null;
}

export function Sidebar({ userRole, isSuperAdmin: superAdmin, supportMode, supportCompanyName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("nav");
  const ts = useTranslations("support");
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});
  const [exiting, setExiting] = useState(false);

  const visibleItems = navItems.filter((item) => {
    if (item.superAdminOnly) return superAdmin;
    return item.roles ? item.roles.includes(userRole) : true;
  });

  useEffect(() => {
    if (userRole === "admin" || userRole === "manager") {
      const fetchCounts = () => {
        fetch("/api/admin/pending-counts")
          .then((res) => (res.ok ? res.json() : { counts: {} }))
          .then((data) => {
            const counts = data.counts || {};
            // Aggregate approvals + vacation counts into admin badge
            const adminCount = (counts.approvals || 0) + (counts.expenseApprovals || 0) + (counts.vacationManagement || 0);
            setBadgeCounts({ ...counts, admin: adminCount });
          })
          .catch(() => {});
      };
      fetchCounts();
      const interval = setInterval(fetchCounts, 60000);
      return () => clearInterval(interval);
    }
  }, [userRole]);

  const handleExitSupport = async () => {
    setExiting(true);
    try {
      const res = await fetch("/api/super-admin/access/exit", { method: "POST" });
      if (res.ok) {
        toast.success(ts("sessionEnded"));
        router.push("/super-admin");
        router.refresh();
      } else {
        toast.error(ts("exitFailed"));
      }
    } catch {
      toast.error(ts("exitFailed"));
    } finally {
      setExiting(false);
    }
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border -ml-2">
        <LogoIcon className="h-[5.5rem] w-[5.5rem] text-brand-500" />
        <span className="text-lg font-bold text-foreground">{t("timetrack")}</span>
      </div>

      {/* Support Mode Banner */}
      {supportMode && supportCompanyName && (
        <div className="mx-3 mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span className="text-xs font-semibold">{ts("supportMode")}</span>
          </div>
          <p className="mt-1 text-xs text-amber-600 dark:text-amber-500 truncate">
            {supportCompanyName}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2 h-7 w-full border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900"
            onClick={handleExitSupport}
            disabled={exiting}
          >
            <LogOut className="mr-1.5 h-3 w-3" />
            {exiting ? ts("exiting") : ts("exitSupport")}
          </Button>
        </div>
      )}

      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const count = badgeCounts[item.labelKey] || 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={`sidebar-${item.labelKey}`}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="flex-1">{t(item.labelKey)}</span>
              {item.badge && count > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1.5 text-[10px] font-bold text-white">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserButton afterSignOutUrl="/" />
            <span className="text-sm text-muted-foreground">{t("account")}</span>
          </div>
          <div className="flex items-center gap-1">
            <LocaleToggle />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </aside>
  );
}
