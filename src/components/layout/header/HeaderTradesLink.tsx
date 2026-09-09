import { TradesIcon } from "@/components/icons/icons";

/**
 * Trades entry — reserved slot in the header tool cluster. Ships disabled
 * until the trades feature lands; keeps the header layout stable.
 */
export function HeaderTradesLink() {
  return (
    <button
      type="button"
      aria-disabled="true"
      title="الصفقات — قريبًا"
      className="relative flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-panel text-zinc-500 opacity-70"
    >
      <TradesIcon className="h-[18px] w-[18px]" />
      <span
        aria-hidden
        className="absolute -top-px -right-px h-2 w-2 rounded-full bg-warn ring-2 ring-surface-1"
      />
    </button>
  );
}