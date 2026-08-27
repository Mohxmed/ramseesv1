import Link from "next/link";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { RedirectIfAuthenticated } from "@/components/auth/RedirectIfAuthenticated";

export default function RegisterPage() {
  return (
    <RedirectIfAuthenticated>
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-50">RAMSEES</h1>
          <p className="mt-1 text-sm text-zinc-500">إنشاء حساب جديد</p>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-6">
          <RegisterForm />

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-xs text-zinc-500">أو</span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          <GoogleSignInButton />
        </div>

        <p className="text-center text-sm text-zinc-500">
          لديك حساب بالفعل؟{" "}
          <Link
            href="/login"
            className="font-medium text-zinc-100 hover:underline"
          >
            تسجيل الدخول
          </Link>
        </p>
      </div>
    </RedirectIfAuthenticated>
  );
}
