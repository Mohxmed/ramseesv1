"use client";

/** Last-resort global error boundary — replaces the whole app shell. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          background: "#09090b",
          color: "#f4f4f5",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: 24,
          }}
        >
          <div style={{ maxWidth: 400, textAlign: "center" }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
              تعذّر تشغيل التطبيق
            </h1>
            <p
              style={{
                fontSize: 12,
                color: "#71717a",
                lineHeight: 1.7,
                marginTop: 10,
              }}
            >
              {error.message || "حدث خطأ غير متوقع."}
            </p>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                marginTop: 20,
                borderRadius: 6,
                background: "rgba(16,185,129,0.8)",
                color: "#09090b",
                fontWeight: 700,
                fontSize: 13,
                padding: "10px 20px",
                border: 0,
                cursor: "pointer",
              }}
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}