"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import {
  Clock,
  LayoutDashboard,
  Palmtree,
  FolderKanban,
  Users,
  BarChart3,
  CheckSquare,
  HardDrive,
  TrendingUp,
  Sparkles,
  Shield,
  Receipt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LocaleToggle } from "@/components/ui/locale-toggle";
import { useTranslations } from "@/lib/i18n";

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
  { labelKey: "expenses", href: "/expenses", icon: Receipt },
  { labelKey: "vacations", href: "/vacations", icon: Palmtree },
  { labelKey: "projects", href: "/projects", icon: FolderKanban, roles: ["admin", "manager"] },
  { labelKey: "team", href: "/team", icon: Users, roles: ["admin", "manager"] },
  { labelKey: "admin", href: "/admin", icon: BarChart3, roles: ["admin"] },
  { labelKey: "analytics", href: "/analytics", icon: TrendingUp, roles: ["admin", "manager"] },
  { labelKey: "aiAssistant", href: "/ai", icon: Sparkles, roles: ["admin", "manager"], badge: true },
  {
    labelKey: "approvals",
    href: "/admin/approvals",
    icon: CheckSquare,
    roles: ["admin"],
    badge: true,
  },
  {
    labelKey: "vacationManagement",
    href: "/admin/vacations",
    icon: Palmtree,
    roles: ["admin"],
    badge: true,
  },
  {
    labelKey: "backups",
    href: "/admin/backups",
    icon: HardDrive,
    roles: ["admin"],
  },
  {
    labelKey: "platform",
    href: "/super-admin",
    icon: Shield,
    superAdminOnly: true,
  },
];

interface SidebarProps {
  userRole: string;
  isSuperAdmin?: boolean;
}

export function Sidebar({ userRole, isSuperAdmin: superAdmin }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [badgeCounts, setBadgeCounts] = useState<Record<string, number>>({});

  const visibleItems = navItems.filter((item) => {
    if (item.superAdminOnly) return superAdmin;
    return item.roles ? item.roles.includes(userRole) : true;
  });

  useEffect(() => {
    if (userRole === "admin" || userRole === "manager") {
      const fetchCounts = () => {
        fetch("/api/admin/pending-counts")
          .then((res) => (res.ok ? res.json() : { counts: {} }))
          .then((data) => setBadgeCounts(data.counts || {}))
          .catch(() => {});
      };
      fetchCounts();
      const interval = setInterval(fetchCounts, 60000);
      return () => clearInterval(interval);
    }
  }, [userRole]);

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <Clock className="h-6 w-6 text-brand-500" />
        <span className="text-lg font-bold text-foreground">{t("timetrack")}</span>
      </div>

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
