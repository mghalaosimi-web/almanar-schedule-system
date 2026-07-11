/**
 * Resolves a friendly, user-facing error message from an axios/fetch error.
 * Specifically checks for network errors, timeouts, and translates them to Arabic/English.
 *
 * @param {Error} err - The error object caught in try-catch.
 * @param {string} fallbackMsg - Default fallback message.
 * @param {boolean} isAr - Whether active language is Arabic.
 * @returns {string} The formatted friendly message.
 */
export function getFriendlyErrorMessage(err, fallbackMsg, isAr) {
  // If it's a network offline error
  if (!navigator.onLine || err.message === 'Network Error' || err.code === 'ERR_NETWORK') {
    return isAr
      ? 'فشل الاتصال بالخادم. يرجى التحقق من اتصال شبكة الإنترنت لديك.'
      : 'Network connection failed. Please check your internet connection.';
  }

  // If it's a timeout error
  if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
    return isAr
      ? 'انتهت مهلة الطلب. يرجى المحاولة مرة أخرى لاحقاً.'
      : 'Connection timed out. Please try again later.';
  }

  // If we have an API response error
  if (err.response) {
    const status = err.response.status;
    const serverError = err.response.data?.error || err.response.data?.message;

    if (serverError) {
      return serverError;
    }

    if (status === 400) {
      return isAr ? 'طلب غير صالح. يرجى التحقق من البيانات المدخلة.' : 'Invalid request. Please check inputs.';
    }
    if (status === 401) {
      return isAr ? 'جلسة العمل منتهية أو غير مصرح بها. يرجى تسجيل الدخول.' : 'Session expired or unauthorized. Please sign in.';
    }
    if (status === 403) {
      return isAr ? 'غير مسموح لك بإجراء هذه العملية.' : 'Forbidden. You do not have permission.';
    }
    if (status === 404) {
      return isAr ? 'العنصر المطلوب غير موجود.' : 'Requested resource not found.';
    }
    if (status >= 500) {
      return isAr 
        ? 'حدث خطأ في خادم النظام (500). يرجى المحاولة لاحقاً.' 
        : 'Internal server error (500). Please try again later.';
    }
  }

  // Fallback
  return fallbackMsg || err.message || (isAr ? 'حدث خطأ غير متوقع' : 'An unexpected error occurred');
}
