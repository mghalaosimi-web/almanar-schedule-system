/**
 * @file haptics.js
 * @description وحدة الاستجابة الاهتزازية للتحكم في اهتزازات اللمس (Vibro-tactile Haptic Feedback).
 * تعتمد على HTML5 Vibration API وتراعي تفضيلات المستخدم المعينة في الإعدادات.
 */

export const isHapticsSupported = () => {
  return typeof window !== 'undefined' && 'navigator' in window && typeof window.navigator.vibrate === 'function';
};

export const isHapticsEnabled = () => {
  if (typeof window === 'undefined') return false;
  const setting = localStorage.getItem('student_haptics_enabled');
  return setting !== 'false'; // Default to true if not set
};

export const triggerHaptic = (pattern) => {
  if (!isHapticsEnabled() || !isHapticsSupported()) return;
  try {
    window.navigator.vibrate(pattern);
  } catch (err) {
    // Silent catch for unsupported browsers/devices
  }
};

export const haptics = {
  /**
   * اهتزاز ناعم وخفيف جداً عند اختيار تبويب أو النقر السريع
   */
  selection: () => triggerHaptic(8),

  /**
   * اهتزاز نقرة خفيفة
   */
  impactLight: () => triggerHaptic(14),

  /**
   * اهتزاز نقرة متوسطة عند فتح شاشة أو زر رئيسي
   */
  impactMedium: () => triggerHaptic(28),

  /**
   * اهتزاز مبهج ومزدوج عند نجاح عملية أو الإتمام
   */
  success: () => triggerHaptic([15, 30, 25]),

  /**
   * اهتزاز تنبيه عند حدوث تحذير
   */
  warning: () => triggerHaptic([30, 40, 30]),

  /**
   * اهتزاز حاد عند حدوث خطأ أو رفض
   */
  error: () => triggerHaptic([50, 40, 50, 40, 50]),
};

export default haptics;
