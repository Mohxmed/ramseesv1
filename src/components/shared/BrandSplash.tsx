import Image from "next/image";

interface BrandSplashProps {
  label?: string;
}

export function BrandSplash({ label = "جاري التحميل..." }: BrandSplashProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-zinc-950">
      {/* Ambient glow behind the logo */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.07),transparent_65%)]" />

      <div className="animate-fade-in-up flex flex-col items-center">
        <div className="relative">
          <div className="absolute -inset-3 rounded-full border border-line/70" />
          <div className="absolute -inset-3 animate-spin rounded-full border-2 border-transparent border-t-up [animation-duration:1.4s]" />
          <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-card border border-line bg-surface-1 shadow-[0_8px_28px_-6px_rgb(0_0_0/0.6)]">
            <Image
              src="/favicon.jpg"
              alt="شعار RAMSEES"
              width={80}
              height={80}
              priority
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        <h1 className="mt-6 text-2xl font-bold tracking-wide text-zinc-50">RAMSEES</h1>
        <p className="mt-1 text-xs text-muted">نظام تداول البيتكوين</p>
      </div>

      <div className="mt-9 flex flex-col items-center gap-3">
        <div className="h-1 w-52 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full w-1/3 animate-[loading-bar_1.2s_ease-in-out_infinite] rounded-full bg-up" />
        </div>
        <p className="text-2xs text-muted">{label}</p>
      </div>
    </div>
  );
}