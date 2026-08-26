import Link from "next/link";
import { NAVIGATION } from "@/config/app";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">
        RAMSEES
      </h1>
      <p className="mt-2 text-lg text-zinc-500 dark:text-zinc-400">
        Personal Bitcoin Trading & Analysis System
      </p>
      <div className="mt-8 flex gap-4">
        {NAVIGATION.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
