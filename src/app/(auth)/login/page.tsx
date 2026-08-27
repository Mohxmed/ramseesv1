import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { RedirectIfAuthenticated } from "@/components/auth/RedirectIfAuthenticated";

export default function LoginPage() {
  return (
    <RedirectIfAuthenticated>
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-50">RAMSEES</h1>
          <p className="mt-1 text-sm text-zinc-500">تسجيل الدخول إلى حسابك</p>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6">
          <LoginForm />

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-xs text-zinc-500">أو</span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          <GoogleSignInButton />
        </div>

        <p className="text-center text-sm text-zinc-500">
          ليس لديك حساب؟{" "}
          <Link
            href="/register"
            className="font-medium text-zinc-100 hover:underline"
          >
            إنشاء حساب
          </Link>
        </p>
      </div>
    </RedirectIfAuthenticated>
  );
}
