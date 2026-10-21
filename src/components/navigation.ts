import {
  AppWindow,
  Box,
  Calendar,
  CalendarDays,
  LayoutDashboard,
  QrCode,
  Settings,
  Truck,
  type LucideIcon,
} from "lucide-react";

/**
 * Single source of truth for navigation. The desktop sidebar shows every
 * item grouped by `group`; the phone tab bar shows the items with `tab`
 * set, in that order, and everything else goes behind "More".
 */
export type NavItem = {
  key: "dashboard" | "inventory" | "scan" | "projects" | "rentals" | "calendar" | "apps" | "settings";
  href: string;
  icon: LucideIcon;
  group: "main" | "tools";
  /** Position in the phone tab bar (1-based); undefined = behind "More". */
  tab?: number;
};

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", href: "/dashboard", icon: LayoutDashboard, group: "main", tab: 1 },
  { key: "inventory", href: "/inventory", icon: Box, group: "main", tab: 2 },
  { key: "projects", href: "/projects", icon: CalendarDays, group: "main", tab: 4 },
  { key: "rentals", href: "/rentals", icon: Truck, group: "main" },
  { key: "calendar", href: "/calendar", icon: Calendar, group: "main" },
  { key: "scan", href: "/scan", icon: QrCode, group: "tools", tab: 3 },
  { key: "apps", href: "/apps", icon: AppWindow, group: "tools" },
  { key: "settings", href: "/settings", icon: Settings, group: "tools" },
];

export const TAB_ITEMS = NAV_ITEMS.filter((i) => i.tab).sort((a, b) => a.tab! - b.tab!);
export const MORE_ITEMS = NAV_ITEMS.filter((i) => !i.tab);

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}
