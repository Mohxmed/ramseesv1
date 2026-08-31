import Link from "next/link";
import Image from "next/image";
import { LoginForm } from "@/components/auth/LoginForm";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { RedirectIfAuthenticated } from "@/components/auth/RedirectIfAuthenticated";

export default function LoginPage() {
  return (
    <RedirectIfAuthenticated>
      <div className="space-y-6">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/favicon.jpg"
            alt="شعار RAMSEES"
            width={64}
            height={64}
            className="h-16 w-16 rounded-xl object-cover"
          />
          <h1 className="mt-3 text-2xl font-bold text-zinc-50">RAMSEES</h1>
          <p className="mt-1 text-sm text-zinc-500">تسجيل الدخول إلى حسابك</p>
        </div>

        <div className="rounded-panel border border-line bg-surface-2/40 p-6">
          <LoginForm />

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="text-xs text-muted">أو</span>
            <div className="h-px flex-1 bg-line" />
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
