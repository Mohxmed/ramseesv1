"use client";

/**
 * Non-fatal notice shown when the saved goals plan could not be read from
 * Firestore. The board still renders a fresh constant-anchored plan; this
 * explains why it may not match the plan saved earlier.
 *
 * A permission-denied read means the goals bucket is not covered by the rules
 * actually deployed on the Firebase project the web app talks to — the most
 * common cause is rules deployed to a different project, or an older rules
 * file still live on the server. We tailor that message to make it actionable.
 */
export function LoadIssueBanner({ issue }: { issue: string | null }) {
  if (!issue) return null;

  const isPermission =
    /permission|insufficient|denied/i.test(issue);

  return (
    <div className="flex flex-col gap-1.5 rounded-card border border-warn/40 bg-warn/5 px-4 py-3 text-xs text-zinc-300">
      <span className="font-semibold text-warn-fg">
        تعذر قراءة أهدافك المحفوظة من الخادم
      </span>

      {isPermission ? (
        <>
          <span className="text-muted">
            رفض الخادم قراءة بيانات الأهداف، مع أن قراءة المحفظة تعمل — وهذا
            يعني أن قواعد الحماية المنشورة فعليًا على المشروع لا تغطي مسار
            الأهداف (أو نُشرت لمشروع مختلف عن مشروع التطبيق). عادةً يكون
            المطلوب إعادة النشر بوعي على نفس المشروع:
          </span>
          <div dir="ltr" className="flex flex-col gap-1">
            <code className="rounded bg-surface-2/60 px-1.5 py-0.5">
              firebase use &lt;app-project-id&gt;
            </code>
            <code className="rounded bg-surface-2/60 px-1.5 py-0.5">
              firebase deploy --only firestore:rules
            </code>
            <code className="rounded bg-surface-2/60 px-1.5 py-0.5">
              firebase firestore:rules get
            </code>
          </div>
          <span className="text-2xs text-muted/80">
            تحقّق من مطابقة &quot;app-project-id&quot; لسعر
            <code dir="ltr" className="mx-1 rounded bg-surface-2/60 px-1 py-0.5">
              NEXT_PUBLIC_FIREBASE_PROJECT_ID
            </code>
            في بيئة النشر، وتأكد أن مخرجات firestore:rules get تحتوي على مسار
            <code dir="ltr" className="mx-1 rounded bg-surface-2/60 px-1 py-0.5">
              users/{'{'}userId{'}'}/goals/{'{'}document=**{'}'}
            </code>.
          </span>
        </>
      ) : (
        <span className="text-muted">
          تُعرض خطة مؤقتة مبنيّة على الأساس الحالي، ولن تُحفظ تعديلاتك حتى
          يعمل الوصول. تحقق من اتصالك وأعد المحاولة.
        </span>
      )}

      {issue && (
        <span dir="ltr" className="text-2xs text-muted/70">
          {issue}
        </span>
      )}
    </div>
  );
}