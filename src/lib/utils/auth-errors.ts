const FIREBASE_AUTH_ERRORS: Record<string, string> = {
  "auth/invalid-credential": "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
  "auth/email-already-in-use": "البريد الإلكتروني مستخدم بالفعل.",
  "auth/weak-password": "كلمة المرور ضعيفة. يجب أن تحتوي على 6 أحرف على الأقل.",
  "auth/user-not-found": "لا يوجد حساب بهذا البريد الإلكتروني.",
  "auth/wrong-password": "كلمة المرور غير صحيحة.",
  "auth/too-many-requests": "محاولات كثيرة جدًا. حاول مرة أخرى لاحقًا.",
  "auth/popup-closed-by-user": "تم إغلاق نافذة تسجيل الدخول.",
  "auth/network-request-failed": "خطأ في الاتصال بالشبكة. تحقق من اتصالك بالإنترنت.",
  "auth/operation-not-allowed": "عملية تسجيل الدخول هذه غير مسموح بها.",
  "auth/user-disabled": "هذا الحساب معطل.",
  "auth/popup-blocked": "تم حظر النافذة المنبثقة. اسمح بالنوافذ المنبثقة للمتصفح.",
  "auth/cancelled-popup-request": "تم إلغاء طلب تسجيل الدخول.",
  "auth/account-exists-with-different-credential": "يوجد حساب بهذا البريد الإلكتروني بطريقة تسجيل دخول مختلفة.",
};

const DEFAULT_ERROR_MESSAGE = "حدث خطأ غير متوقع. حاول مرة أخرى.";

export function getAuthErrorMessage(errorCode: string): string {
  return FIREBASE_AUTH_ERRORS[errorCode] ?? DEFAULT_ERROR_MESSAGE;
}
