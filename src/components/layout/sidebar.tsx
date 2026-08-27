import Link from "next/link";
import { NAVIGATION } from "@/config/app";

export function Sidebar() {
  return (
    <aside className="flex h-full w-64 flex-col border-l border-zinc-800 bg-zinc-900/40">
      <div className="border-b border-zinc-800 px-6 py-5">
        <h1 className="text-xl font-bold text-zinc-50">RAMSEES</h1>
        <p className="mt-1 text-xs text-zinc-500">نظام تداول البيتكوين</p>
      </div>
      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {NAVIGATION.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-md px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
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
