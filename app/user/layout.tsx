"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, type CurrentRecruiter } from "@/lib/api";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LayoutDashboard,
  Clock3,
  Sun,
  Moon,
  LogOut,
  BriefcaseBusiness,
} from "lucide-react";

const navItems = [
  { href: "/user", label: "Interviews", icon: LayoutDashboard },
  { href: "/user/interviews", label: "History", icon: Clock3 },
];

function formatMinutes(minutes: number | undefined) {
  const safeMinutes = Math.max(0, minutes || 0);
  return `${safeMinutes} min`;
}

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [currentRecruiter, setCurrentRecruiter] = useState<CurrentRecruiter | null>(null);
  const [loadingRecruiter, setLoadingRecruiter] = useState(true);

  useEffect(() => {
    api
      .getCurrentRecruiter()
      .then(setCurrentRecruiter)
      .catch(() => setCurrentRecruiter(null))
      .finally(() => setLoadingRecruiter(false));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="fixed left-0 top-0 z-30 flex h-screen w-64 flex-col border-r border-border bg-sidebar">
        <div className="flex h-14 items-center gap-2 px-5">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-primary-foreground">
            <BriefcaseBusiness className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
            RecruitDesk
          </span>
        </div>

        <Separator />

        <div className="px-4 py-4">
          {loadingRecruiter ? (
            <div className="space-y-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : (
            <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3">
              <p className="text-xs font-medium text-sidebar-foreground">
                {currentRecruiter?.name || "Recruiter"}
              </p>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {currentRecruiter?.email || "Signed in"}
              </p>
              <div className="mt-3 rounded-md border border-sidebar-border bg-background/80 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Remaining Minutes
                </p>
                <p className="mt-1 text-lg font-semibold text-foreground">
                  {formatMinutes(currentRecruiter?.minutesRemaining)}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Used {formatMinutes(currentRecruiter?.minutesUsed)} of{" "}
                  {formatMinutes(currentRecruiter?.minutesAllocated)}
                </p>
              </div>
            </div>
          )}
        </div>

        <nav className="flex-1 space-y-1 px-3 py-1">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/user" && pathname.startsWith(item.href));

            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-border px-3 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="w-full justify-start gap-2 text-xs text-muted-foreground"
          >
            {theme === "dark" ? (
              <Sun className="h-3.5 w-3.5" />
            ) : (
              <Moon className="h-3.5 w-3.5" />
            )}
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start gap-2 text-xs text-muted-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </Button>
        </div>
      </aside>

      <main className="ml-64 flex-1">
        <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
