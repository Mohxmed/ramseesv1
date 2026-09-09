/**
 * SERVER-ONLY — never import from client components.
 *
 * Centralized exchange error taxonomy. Components must NOT scatter try/catch;
 * they catch ExchangeError and render `userMessage`. Raw upstream errors never
 * reach users directly (they may embed keys/signatures), so the adapter maps
 * them into safe, user-understandable Arabic messages at the boundary.
 */

export type ExchangeErrorKind =
  | "CONNECTION"
  | "AUTHENTICATION"
  | "PERMISSION"
  | "GEO_BLOCKED"
  | "RATE_LIMIT"
  | "NETWORK"
  | "VALIDATION"
  | "DATA_MAPPING"
  | "SYNC"
  | "RECONCILIATION"
  | "UNSUPPORTED"
  | "UNKNOWN";

export interface ExchangeErrorOptions {
  kind?: ExchangeErrorKind;
  code?: string;
  retryable?: boolean;
  context?: Record<string, unknown>;
  cause?: unknown;
}

const KIND_DEFAULT: ExchangeErrorKind = "UNKNOWN";

/** Public, safe message per kind — no raw payloads, no secrets. */
export function userSafeExchangeMessage(kind: ExchangeErrorKind): string {
  switch (kind) {
    case "AUTHENTICATION":
      return "API Key غير صالح — تحقق من المفتاح والسر.";
    case "PERMISSION":
      return "صلاحيات API غير كافية — فعّل أذونات القراءة فقط للمنصة.";
    case "GEO_BLOCKED":
      return "منصة Binance تحجب منطقة خادم التطبيق — غيّر منطقة مشروع Vercel إلى منطقة غير محظورة (مثل أوروبا) ثم أعد المحاولة.";
    case "RATE_LIMIT":
      return "تم تجاوز حد الطلبات — سنعيد المحاولة بعد لحظات.";
    case "NETWORK":
      return "تعذر الوصول إلى المنصة — تحقق من الاتصال وحاول مجددًا.";
    case "VALIDATION":
      return "بيانات الإدخال غير صالحة.";
    case "DATA_MAPPING":
      return "حدث خطأ أثناء معالجة بيانات المنصة.";
    case "SYNC":
      return "فشلت المزامنة — جرب زر المزامنة اليدوية.";
    case "RECONCILIATION":
      return "يوجد فرق بين رصيد المنصة والرصيد المحفوظ.";
    case "CONNECTION":
      return "تعذر الاتصال بالمنصة.";
    case "UNSUPPORTED":
      return "هذه المنصة غير مدعومة حاليًا.";
    case "UNKNOWN":
    default:
      return "حدث خطأ غير متوقع.";
  }
}

export class ExchangeError extends Error {
  readonly kind: ExchangeErrorKind;
  readonly code: string;
  readonly retryable: boolean;
  readonly context: Record<string, unknown>;
  readonly userMessage: string;

  constructor(message: string, opts: ExchangeErrorOptions = {}) {
    const kind = opts.kind ?? KIND_DEFAULT;
    super(message);
    this.name = "ExchangeError";
    this.kind = kind;
    this.code = opts.code ?? kind;
    this.retryable = opts.retryable ?? false;
    this.context = opts.context ?? {};
    this.userMessage = userSafeExchangeMessage(kind);
    if (opts.cause !== undefined) {
      (this as { cause?: unknown }).cause = opts.cause;
    }
  }

  static auth(message = "authentication failed", context?: Record<string, unknown>): ExchangeError {
    return new ExchangeError(message, { kind: "AUTHENTICATION", code: "AUTH_FAILED", context });
  }
  static unsupportedExchange(exchange: string): ExchangeError {
    return new ExchangeError(`unsupported exchange: ${exchange}`, {
      kind: "UNSUPPORTED",
      code: "UNSUPPORTED_EXCHANGE",
      context: { exchange },
    });
  }
  static rateLimit(context: Record<string, unknown>): ExchangeError {
    return new ExchangeError("rate limit exceeded", { kind: "RATE_LIMIT", code: "RATE_LIMITED", retryable: true, context });
  }
  static geoBlocked(context: Record<string, unknown>): ExchangeError {
    return new ExchangeError("restricted region", { kind: "GEO_BLOCKED", code: "REGION_BLOCKED", context });
  }
  static network(message = "network failure", context?: Record<string, unknown>): ExchangeError {
    return new ExchangeError(message, { kind: "NETWORK", code: "NETWORK_ERROR", retryable: true, context });
  }
  static mapping(context?: Record<string, unknown>): ExchangeError {
    return new ExchangeError("data mapping failure", { kind: "DATA_MAPPING", code: "DATA_MAPPING_ERROR", context });
  }
  static validation(context?: Record<string, unknown>): ExchangeError {
    return new ExchangeError("validation failure", { kind: "VALIDATION", code: "VALIDATION_ERROR", context });
  }
}

/** Map an exchange failure kind to the HTTP status a route should use. */
export function exchangeErrorHttpStatus(kind: ExchangeErrorKind): number {
  switch (kind) {
    case "VALIDATION":
    case "AUTHENTICATION":
      return 400;
    case "PERMISSION":
    case "GEO_BLOCKED":
      return 403;
    case "RATE_LIMIT":
      return 429;
    default:
      return 502;
  }
}

/** Map an HTTP status to a retryable/fatal classification. */
export function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}