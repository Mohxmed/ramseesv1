"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/hooks/useAuth";
import { Popover, Badge } from "@/components/ui";
import {
  LogoutIcon,
  SettingsIcon,
  SlidersIcon,
  UserIcon,
} from "@/components/icons/icons";

function initialLetter(name: string): string {
  return (name.trim().charAt(0) || "").toUpperCase();
}

/** User identity + account menu (avatar, name, profile / settings / logout). */
export function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const displayName = user?.displayName || user?.email?.split("@")[0] || "مستخدم";
  const letter = initialLetter(user?.displayName ?? user?.email ?? "م");

  function close() {
    setAnchorEl(null);
  }

  function go(path: string) {
    close();
    router.push(path);
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="قائمة المستخدم"
        title={displayName}
        className={`flex h-9 w-9 items-center justify-center rounded-panel transition-colors ${
          open ? "bg-surface-2" : "hover:bg-surface-2"
        }`}
      >
        {user?.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.photoURL}
            alt=""
            className="h-7 w-7 shrink-0 rounded-full border border-line object-cover"
          />
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-up/15 text-xs font-bold text-up-fg ring-1 ring-up/25">
            {letter}
          </span>
        )}
      </button>

      <Popover
        open={open}
        onClose={close}
        anchorEl={anchorEl}
        width={260}
      >
        <div className="mb-1 flex items-center gap-2.5 border-b border-line/70 pb-2">
          {user?.photoURL ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.photoURL}
              alt=""
              className="h-9 w-9 shrink-0 rounded-full border border-line object-cover"
            />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-3/70 text-sm font-bold text-zinc-100">
              {letter}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-zinc-100">
              {displayName}
            </p>
            {user?.email && (
              <p className="truncate text-2xs text-muted" dir="ltr">
                {user.email}
              </p>
            )}
          </div>
          <Badge tone="good">حساب مفعّل</Badge>
        </div>

        <div className="-mx-1 space-y-0.5">
          <MenuRow
            icon={<UserIcon className="h-4 w-4" />}
            label="الملف الشخصي"
            onClick={() => go("/settings")}
          />
          <MenuRow
            icon={<SettingsIcon className="h-4 w-4" />}
            label="إعدادات الحساب"
            onClick={() => go("/settings")}
          />
          <MenuRow
            icon={<SlidersIcon className="h-4 w-4" />}
            label="إعدادات النظام"
            onClick={() => go("/settings")}
          />
          <div className="my-1 border-t border-line/60" />
          <MenuRow
            icon={<LogoutIcon className="h-4 w-4" />}
            label="تسجيل الخروج"
            destructive
            onClick={() => {
              close();
              void logout();
            }}
          />
        </div>
      </Popover>
    </>
  );
}

function MenuRow({
  icon,
  label,
  onClick,
  destructive = false,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-panel px-2.5 py-2 text-xs font-medium transition-colors hover:bg-surface-2/70 ${
        destructive ? "text-down-fg hover:bg-down/10" : "text-zinc-200"
      }`}
    >
      <span className={destructive ? "text-down-fg" : "text-muted"}>{icon}</span>
      {label}
    </button>
  );
}