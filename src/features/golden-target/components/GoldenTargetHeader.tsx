export function GoldenTargetHeader() {
  return (
    <div className="animate-fade-in-up">
      <h1 className="text-3xl font-bold text-zinc-50">الهدف الذهبي</h1>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
        <span className="rounded-full border border-zinc-700 px-3 py-1">
          20 حركة
        </span>
        <span className="rounded-full border border-zinc-700 px-3 py-1">
          نمو 100%
        </span>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
        استراتيجية نمو تراكمي: في كل حركة تستهدف مضاعفة قيمة رأس المال بنسبة
        100%، بدءًا من قيمة 2 وصولًا إلى 1,048,576 بعد 20 حركة.
      </p>
    </div>
  );
}
