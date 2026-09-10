"use client";

/**
 * Non-fatal notice shown when the saved goals plan could not be read from
 * Firestore (e.g. security rules not deployed yet / offline). The board still
 * renders a fresh constant-anchored plan; this explains why it may not match
 * the plan the user saved earlier.
 */
export function LoadIssueBanner({ issue }: { issue: string | null }) {
  if (!issue) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-card border border-warn/40 bg-warn/5 px-4 py-3 text-xs text-zinc-300">
      <span className="font-semibold text-warn-fg">
        تعذر قراءة أهدافك المحفوظة من الخادم
      </span>
      <span className="text-muted">
        تُعرض خطة مؤقتة مبنيّة على الأساس الحالي، ولن تُحفظ تعديلاتك حتى يعمل
        الوصول. تحقق من اتصالك، ومن نشر قواعد الحماية:
        <code dir="ltr" className="mx-1 rounded bg-surface-2/60 px-1.5 py-0.5">
          firebase deploy --only firestore:rules,firestore:indexes
        </code>
      </span>
      {issue && (
        <span dir="ltr" className="text-2xs text-muted/70">
          {issue}
        </span>
      )}
    </div>
  );
}