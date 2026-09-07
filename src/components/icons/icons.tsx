/**
 * Application icon set — thin wrappers around Lucide icons.
 *
 * Every icon keeps the project's stable `IconProps` contract (a `className`
 * prop with a sensible default), so all existing consumers (sidebar, shell,
 * navigation, overlays, buttons) work unchanged while the glyphs themselves now
 * come from the `lucide-react` library.
 */

import {
  LayoutDashboard,
  Crosshair,
  TrendingUp,
  Settings as SettingsLucide,
  LogOut,
  Menu,
  X,
  PanelLeft,
  PanelLeftClose,
  Bitcoin,
  ListChecks,
  SearchCheck,
  Activity,
  Link2,
  Bell,
  UserRound,
  ChevronDown,
  Wifi,
  Clock,
  SlidersHorizontal,
  TriangleAlert,
  BarChart3,
  Zap,
  Play,
  Pause,
  Star,
  Trophy,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  ArrowUpDown,
  Wallet,
  Download,
  Plus,
  type LucideProps,
} from "lucide-react";

export type IconProps = {
  className?: string;
};

type Wrapped = (props: IconProps) => React.ReactElement;

function wrap(
  Icon: React.ComponentType<LucideProps>,
  defaultClassName = "h-5 w-5"
): Wrapped {
  return function WrappedIcon({ className = defaultClassName }: IconProps) {
    return (
      <Icon
        className={className}
        aria-hidden="true"
        strokeWidth={2}
        data-slot="icon"
      />
    );
  };
}

export const DashboardIcon = wrap(LayoutDashboard);
export const TargetIcon = wrap(Crosshair);
export const MarketIcon = wrap(TrendingUp);
export const SettingsIcon = wrap(SettingsLucide);
export const LogoutIcon = wrap(LogOut);
export const MenuIcon = wrap(Menu, "h-6 w-6");
export const CloseIcon = wrap(X);
export const PanelLeftIcon = wrap(PanelLeft);
export const PanelLeftCloseIcon = wrap(PanelLeftClose);
export const BitcoinIcon = wrap(Bitcoin);
export const DecisionIcon = wrap(ListChecks);
export const StrategyIcon = wrap(SearchCheck);
export const ScalpIcon = wrap(Activity);
export const LinkIcon = wrap(Link2);
export const BellIcon = wrap(Bell);
export const UserIcon = wrap(UserRound);
export const ChevronDownIcon = wrap(ChevronDown, "h-4 w-4");
export const WifiIcon = wrap(Wifi);
export const ClockIcon = wrap(Clock);
export const SlidersIcon = wrap(SlidersHorizontal);
export const AlertIcon = wrap(TriangleAlert);
export const ChartIcon = wrap(BarChart3);
export const ZapIcon = wrap(Zap);
export const PlayIcon = wrap(Play);
export const PauseIcon = wrap(Pause);
export const StarIcon = wrap(Star);
export const TrophyIcon = wrap(Trophy);
export const ArrowUpRightIcon = wrap(ArrowUpRight);
export const ArrowDownRightIcon = wrap(ArrowDownRight);
export const ArrowRightIcon = wrap(ArrowRight);
export const ArrowUpDownIcon = wrap(ArrowUpDown, "h-3.5 w-3.5");
export const WalletIcon = wrap(Wallet);
export const DownloadIcon = wrap(Download, "h-4 w-4");
export const PlusIcon = wrap(Plus);
