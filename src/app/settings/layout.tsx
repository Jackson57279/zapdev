"use client";

import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  UserIcon,
  CreditCardIcon,
  LinkIcon,
  SettingsIcon,
} from "lucide-react";

const settingsNav = [
  {
    title: "Overview",
    href: "/settings",
    icon: SettingsIcon,
  },
  {
    title: "Profile",
    href: "/settings/profile",
    icon: UserIcon,
  },
  {
    title: "Subscription",
    href: "/settings/subscription",
    icon: CreditCardIcon,
  },
  {
    title: "Connections",
    href: "/settings/connections",
    icon: LinkIcon,
  },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const location = useLocation();
  const pathname = location.pathname;

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-sidebar p-6">
        <h2 className="text-lg font-semibold mb-4">Settings</h2>
        <nav className="space-y-1">
          {settingsNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.title}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8">
        {children}
      </main>
    </div>
  );
}
