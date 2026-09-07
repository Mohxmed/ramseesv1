"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { NAVIGATION } from "@/config/navigation";
import { PanelLeftCloseIcon } from "@/components/icons/icons";

type SidebarProps = {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNavigate?: () => void;
};

function NavItem({
  href,
  label,
  icon: Icon,
  collapsed,
  active,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: typeof NAVIGATION[number]["icon"];
  collapsed: boolean;
  active: boolean;
  onNavigate?: () => void;
}) {
  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-3 rounded-panel py-2.5 text-sm font-medium transition-colors ${
        collapsed ? "justify-center px-0" : "px-3"
      } ${
        active
          ? "bg-up/10 text-up-fg"
          : "text-muted hover:bg-surface-2/70 hover:text-zinc-100"
      }`}
    >
      <span
        className={`flex shrink-0 items-center justify-center ${
          active ? "text-up-fg" : "text-muted group-hover:text-zinc-300"
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      {!collapsed && <span className="truncate">{label}</span>}

      {active && !collapsed && (
        <span className="ml-auto h-5 w-0.5 rounded-full bg-up-fg" />
      )}

      {collapsed && (
        <span
          role="tooltip"
          className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-panel border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-zinc-100 opacity-0 shadow-pop transition-opacity group-hover:opacity-100 md:block"
        >
          {label}
        </span>
      )}
    </Link>
  );

  return link;
}

export function Sidebar({ collapsed, onToggleCollapse, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div
        className={`flex items-center border-b border-line py-5 ${
          collapsed ? "justify-center px-0" : "px-5"
        }`}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg">
          <Image
            src="/favicon.jpg"
            alt="شعار RAMSEES"
            width={36}
            height={36}
            className="h-full w-full object-cover"
          />
        </div>
        {!collapsed && (
          <div className="mr-3 min-w-0">
            <h1 className="truncate text-sm font-bold text-zinc-50">RAMSEES</h1>
            <p className="truncate text-2xs text-muted">
              نظام تداول البيتكوين
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav
        className={`flex-1 overflow-y-auto px-3 py-4 ${
          collapsed ? "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden" : ""
        }`}
      >
        <ul className="space-y-1">
          {NAVIGATION.map((item) => (
            <li key={item.href}>
              <NavItem
                href={item.href}
                label={item.label}
                icon={item.icon}
                collapsed={collapsed}
                active={pathname === item.href}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-line p-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          className={`group relative flex w-full items-center gap-3 rounded-panel py-2.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2/70 hover:text-zinc-200 ${
            collapsed ? "justify-center px-0" : "px-3"
          }`}
        >
          <PanelLeftCloseIcon className="h-5 w-5 shrink-0" />
          {!collapsed && <span>طي الشريط</span>}
          {collapsed && (
            <span
              role="tooltip"
              className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-panel border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-zinc-100 opacity-0 shadow-pop transition-opacity group-hover:opacity-100 md:block"
            >
              توسيع الشريط
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
