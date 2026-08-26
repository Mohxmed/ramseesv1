import Link from "next/link";
import { NAVIGATION } from "@/config/app";

export function Sidebar() {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          RAMSEES
        </h1>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Bitcoin Trading System
        </p>
      </div>
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {NAVIGATION.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
