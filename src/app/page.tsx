import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">
        RAMSEES
      </h1>
      <p className="mt-2 text-lg text-zinc-500 dark:text-zinc-400">
        Personal Bitcoin Trading & Analysis System
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/login"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Login
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
