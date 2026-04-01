"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  FileText,
  Users,
  ClipboardList,
  Code,
  Sun,
  Moon,
  LogOut,
  BriefcaseBusiness,
  ChevronRight,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/templates", label: "Templates", icon: FileText },
  { href: "/admin/recruiters", label: "Recruiters", icon: Users },
  { href: "/admin/interviews", label: "Interviews", icon: ClipboardList },
  { href: "/admin/embed", label: "Embed", icon: Code },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-30 flex h-screen w-64 flex-col border-r border-border/50 bg-sidebar/50 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-3 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg primary-gradient text-primary-foreground shadow-md shadow-primary/20">
            <BriefcaseBusiness className="h-4 w-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-sidebar-foreground">
            RecruitDesk
          </span>
        </div>

        <div className="px-4 py-4">
          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Admin Workspace</p>
            <p className="mt-0.5 text-xs font-medium text-foreground/80 truncate">Enterprise Control</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/admin" && pathname.startsWith(item.href));

            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <item.icon className={`h-4.5 w-4.5 transition-colors ${isActive ? "text-primary-foreground" : "text-muted-foreground/70 group-hover:text-primary"}`} />
                  <span className="flex-1">{item.label}</span>
                  {isActive && (
                    <ChevronRight className="h-3.5 w-3.5 opacity-70" />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2 p-4">
          <div className="rounded-2xl border border-border/50 bg-muted/30 p-4">
            <p className="text-xs font-semibold">Pro Plan</p>
            <p className="mt-1 text-[10px] text-muted-foreground leading-relaxed">Your organization is on the enterprise tier.</p>
          </div>
          
          <div className="flex flex-col gap-1">
            <button
              onClick={toggleTheme}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
              <span>{theme === "dark" ? "Light theme" : "Dark theme"}</span>
            </button>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-destructive/80 transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-64 flex-1">
        <div className="mx-auto max-w-6xl px-8 py-8 animate-in fade-in slide-in-from-bottom-2 duration-700">{children}</div>
      </main>
    </div>
  );
}
