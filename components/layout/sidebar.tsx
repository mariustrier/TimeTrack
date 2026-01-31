"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Clock,
  LayoutDashboard,
  Palmtree,
  FolderKanban,
  Users,
  BarChart3,
  CheckSquare,
  HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Vacations", href: "/vacations", icon: Palmtree },
  { label: "Projects", href: "/projects", icon: FolderKanban, adminOnly: true },
  { label: "Team", href: "/team", icon: Users, adminOnly: true },
  { label: "Admin", href: "/admin", icon: BarChart3, adminOnly: true },
  {
    label: "Approvals",
    href: "/admin/approvals",
    icon: CheckSquare,
    adminOnly: true,
  },
  {
    label: "Vacation Management",
    href: "/admin/vacations",
    icon: Palmtree,
    adminOnly: true,
  },
  {
    label: "Backups",
    href: "/admin/backups",
    icon: HardDrive,
    adminOnly: true,
  },
];

interface SidebarProps {
  userRole: string;
}

export function Sidebar({ userRole }: SidebarProps) {
  const pathname = usePathname();
  const isAdmin = userRole === "admin";

  const visibleItems = navItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-border bg-card">
      <div className="flex h-16 items-center gap-2 border-b border-border px-6">
        <Clock className="h-6 w-6 text-brand-500" />
        <span className="text-lg font-bold text-foreground">TimeTrack</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
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
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserButton afterSignOutUrl="/" />
            <span className="text-sm text-muted-foreground">Account</span>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
