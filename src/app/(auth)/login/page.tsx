import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export default function LoginPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          RAMSEES
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          تسجيل الدخول إلى حسابك
        </p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <LoginForm />

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
          <span className="text-xs text-zinc-400">أو</span>
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
        </div>

        <GoogleSignInButton />
      </div>

      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        ليس لديك حساب؟{" "}
        <Link
          href="/register"
          className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
        >
          إنشاء حساب
        </Link>
      </p>
    </div>
  );
}
