"use client";

import { useState, type ReactNode } from "react";
import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu as MuiMenu,
  MenuItem,
} from "@mui/material";
import { ThemeGate, colors, radius } from "@/components/ui";
import { SettingsIcon } from "@/components/icons/icons";

export interface WalletActionItem {
  key: string;
  label: string;
  icon: ReactNode;
  /** Destructive actions render in the danger tone. */
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}

/**
 * Material 3 actions menu for the imported wallet.
 *
 * A single settings icon anchors a dropdown holding every wallet-level action
 * (تحديث البيانات، إعادة مزامنة كاملة، إلغاء الاقتران، حذف المحفظة). The caller
 * passes the exact item list for the current connection state, so a
 * disconnected wallet only surfaces the actions that still make sense.
 *
 * Menus close on selection or outside click; destructive items are colored by
 * the caller's `danger` flag so the delete action reads unmistakably.
 */
export function WalletActionsMenu({
  items,
  disabled = false,
}: {
  items: WalletActionItem[];
  disabled?: boolean;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const close = () => setAnchorEl(null);

  const pick = (item: WalletActionItem) => {
    close();
    item.onSelect();
  };

  return (
    <ThemeGate>
      <IconButton
        onClick={(e) => setAnchorEl(e.currentTarget)}
        disabled={disabled}
        size="small"
        aria-label="إعدادات المحفظة"
        aria-haspopup="menu"
        aria-expanded={open}
        sx={{
          height: 28,
          border: `1px solid ${colors.line}`,
          borderRadius: radius.panel,
          color: colors.muted,
          transition: "color 150ms ease, background-color 150ms ease",
          "&:hover": { color: colors.foreground, backgroundColor: colors.surface2 },
          "&:disabled": { opacity: 0.5 },
        }}
      >
        <SettingsIcon className="h-4 w-4" />
      </IconButton>

      <MuiMenu
        open={open}
        onClose={close}
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: { sx: { minWidth: 220, py: 0.75, mt: 0.5 } },
        }}
      >
        {items.map((item) => (
          <MenuItem
            key={item.key}
            onClick={() => pick(item)}
            disabled={item.disabled}
            sx={{
              gap: "10px",
              color: item.danger ? colors.downFg : colors.foreground,
              py: "6px",
              "&:hover": {
                backgroundColor: item.danger
                  ? "rgba(239, 68, 68, 0.1)"
                  : colors.surface2,
              },
              "&.Mui-disabled": { opacity: 0.4 },
            }}
          >
            <ListItemIcon
              sx={{
                minWidth: 0,
                color: item.danger ? colors.downFg : colors.muted,
              }}
            >
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              slotProps={{
                primary: { sx: { fontSize: 12, fontWeight: 600 } },
              }}
            />
          </MenuItem>
        ))}
      </MuiMenu>
    </ThemeGate>
  );
}