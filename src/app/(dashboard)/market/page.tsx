export const metadata = {
  title: "الحالة العامة للسوق — RAMSEES",
  description:
    "نظرة عامة على الحالة العامة للسوق. صفحة قيد الإنشاء.",
};

export default function MarketPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 px-4 py-6" dir="rtl">
      <header>
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Market Status
        </div>
        <h1 className="text-xl font-bold text-zinc-100">الحالة العامة للسوق</h1>
      </header>
      <div className="rounded-2xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">
        هذه الصفحة قيد الإنشاء — سيُعرض هنا ملخص الحالة العامة للسوق قريباً.
      </div>
    </div>
  );
}
