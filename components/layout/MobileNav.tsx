"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  BarChart3,
  FolderKanban,
  Receipt,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "@/lib/i18n";

interface MobileNavItem {
  labelKey: string;
  href: string;
  icon: React.ElementType;
  roles?: string[];
}

const mobileNavItems: MobileNavItem[] = [
  { labelKey: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { labelKey: "management", href: "/admin", icon: BarChart3, roles: ["admin", "manager"] },
  { labelKey: "expenses", href: "/expenses", icon: Receipt },
  { labelKey: "projects", href: "/projects", icon: FolderKanban },
  { labelKey: "settings", href: "/settings", icon: Settings },
];

interface MobileNavProps {
  userRole: string;
}

export function MobileNav({ userRole }: MobileNavProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [menuOpen, setMenuOpen] = useState(false);

  const visibleItems = mobileNavItems.filter((item) =>
    item.roles ? item.roles.includes(userRole) : true
  );

  // For employees, show dashboard, expenses, projects, settings
  // For admins, show dashboard, management, projects, settings + hamburger
  const displayItems = visibleItems.slice(0, 4);

  return (
    <>
      {/* Overlay sidebar for hamburger menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMenuOpen(false)}
          />
          <div className="relative z-50 w-64 bg-card border-r border-border h-full overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <span className="text-lg font-bold text-foreground">{t("timetrack")}</span>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-1 rounded-md hover:bg-accent"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <nav className="p-3 space-y-1">
              {visibleItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{t(item.labelKey)}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Bottom navigation bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden items-center justify-around border-t border-border bg-card px-2 pb-[env(safe-area-inset-bottom)] h-16">
        {displayItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-md transition-colors min-w-[3rem]",
                isActive
                  ? "text-brand-600 dark:text-brand-400"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-tight">{t(item.labelKey)}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMenuOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-md text-muted-foreground min-w-[3rem]"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-medium leading-tight">Menu</span>
        </button>
      </nav>
    </>
  );
}
