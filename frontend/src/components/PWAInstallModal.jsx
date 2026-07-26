import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PWAInstallModal({ isOpen, onClose, deferredPrompt, onInstallPwa, initialTab = 'pwa' }) {
  const [isStandalone, setIsStandalone] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab); // 'pwa' | 'apk' | 'ios'

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    const checkStandalone = () => {
      const isMqy = window.matchMedia('(display-mode: standalone)').matches;
      const isNavStandalone = window.navigator.standalone;
      setIsStandalone(isMqy || isNavStandalone);
    };
    checkStandalone();
  }, []);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        {/* Overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="relative w-full max-w-md bg-[#0e1626] border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden text-right"
          dir="rtl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Ambient background glow */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-[var(--accent-glow,#10b981)] rounded-full blur-3xl opacity-20 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl opacity-20 pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white flex items-center justify-center font-bold text-sm transition-all z-10"
          >
            ✕
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[var(--accent,#10b981)] to-emerald-400 flex items-center justify-center text-2xl text-slate-950 font-black shadow-lg">
              📱
            </div>
            <div>
              <h3 className="text-lg font-black text-white">تثبيت وتنزيل التطبيق (APK & PWA)</h3>
              <p className="text-xs text-white/60 font-bold mt-0.5">احصل على تجربة تطبيق مستقلة وسريعة بدون تقطيع</p>
            </div>
          </div>

          {/* Tabs header */}
          <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5 mb-5 text-xs font-bold">
            <button
              onClick={() => setActiveTab('pwa')}
              className={`flex-1 py-2.5 rounded-xl transition-all ${
                activeTab === 'pwa'
                  ? 'bg-[var(--accent,#10b981)] text-slate-950 font-black shadow-md'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              ⚡ تطبيق الويب (PWA)
            </button>
            <button
              onClick={() => setActiveTab('apk')}
              className={`flex-1 py-2.5 rounded-xl transition-all ${
                activeTab === 'apk'
                  ? 'bg-[var(--accent,#10b981)] text-slate-950 font-black shadow-md'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              🤖 أندرويد (APK)
            </button>
            <button
              onClick={() => setActiveTab('ios')}
              className={`flex-1 py-2.5 rounded-xl transition-all ${
                activeTab === 'ios'
                  ? 'bg-[var(--accent,#10b981)] text-slate-950 font-black shadow-md'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              🍏 آيفون (iOS)
            </button>
          </div>

          {/* Tab 1: PWA */}
          {activeTab === 'pwa' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/3 border border-white/5 text-xs space-y-2">
                <div className="flex items-center gap-2 text-[var(--accent,#10b981)] font-black text-sm">
                  <span>✨</span>
                  <span>مميزات تطبيق الويب التقدمي (PWA):</span>
                </div>
                <ul className="space-y-1.5 text-white/80 font-semibold pr-4 list-disc text-[11px]">
                  <li>يعمل كسفينة مستقلة بملء الشاشة بدون شريط المتصفح.</li>
                  <li>مزامنة فورية وتخزين الجداول للعمل بدون إنترنت (Offline).</li>
                  <li>تنبيهات فورية عند تغيير المواعيد أو القاعات.</li>
                  <li>حجم خفيف جداً ولا يستهلك ذاكرة الهاتف.</li>
                </ul>
              </div>

              {isStandalone ? (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-center font-black text-xs">
                  ✅ التطبيق مثبت ومثبت بالفعل حالياً على جهازك!
                </div>
              ) : deferredPrompt ? (
                <button
                  onClick={async () => {
                    if (onInstallPwa) {
                      await onInstallPwa();
                    } else if (deferredPrompt) {
                      deferredPrompt.prompt();
                      await deferredPrompt.userChoice;
                    }
                    onClose();
                  }}
                  className="w-full py-4 rounded-2xl bg-gradient-to-r from-[var(--accent,#10b981)] to-emerald-400 text-slate-950 font-black text-sm shadow-[0_0_20px_var(--accent-glow,#10b98144)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>📥</span>
                  <span>تثبيت التطبيق الآن على الشاشة الرئيسية</span>
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-white/70 font-bold leading-relaxed">
                    لتثبيت التطبيق يدويًا على جهازك:
                  </p>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-[11px] text-white/80 font-bold space-y-1">
                    <p>1. افتح قائمة المتصفح (⋮ في Chrome أو مشاركة ⎋ في Safari).</p>
                    <p>2. اختر <span className="text-[var(--accent,#10b981)]">"التثبيت كـ تطبيق"</span> أو <span className="text-[var(--accent,#10b981)]">"الإضافة إلى الشاشة الرئيسية"</span>.</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: APK */}
          {activeTab === 'apk' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/3 border border-white/5 text-xs space-y-2">
                <div className="flex items-center gap-2 text-cyan-400 font-black text-sm">
                  <span>🤖</span>
                  <span>تطبيق أندرويد المستقل (Direct APK):</span>
                </div>
                <p className="text-[11px] text-white/80 font-semibold leading-relaxed">
                  حمل ملف الـ APK المباشر لنظام أندرويد وتثبيته مباشرة كـ حزمة تطبيق (Android Package) جاهزة بدون حاجة لمتصفح.
                </p>
              </div>

              <a
                href="/Manar_Schedule.apk"
                download="Manar_Schedule.apk"
                onClick={() => {
                  setTimeout(onClose, 1000);
                }}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-sm shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer text-center no-underline"
              >
                <span>📥</span>
                <span>تحميل ملف APK مباشر (Android)</span>
              </a>
              <p className="text-[10px] text-white/40 text-center font-bold">
                حجم الملف: 40 ميجابايت • متوافق مع جميع أجهزة أندرويد
              </p>
            </div>
          )}

          {/* Tab 3: iOS Safari */}
          {activeTab === 'ios' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/3 border border-white/5 text-xs space-y-3">
                <div className="flex items-center gap-2 text-purple-400 font-black text-sm">
                  <span>🍏</span>
                  <span>طريقة التثبيت على الآيفون والآيباد (iOS):</span>
                </div>
                <div className="space-y-2 text-[11px] text-white/90 font-bold">
                  <div className="flex gap-2.5 items-start p-2.5 rounded-xl bg-white/5">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 text-[10px] font-black">1</span>
                    <p>افتح هذا الموقع من متصفح <span className="text-purple-300">Safari</span> على هاتفك.</p>
                  </div>
                  <div className="flex gap-2.5 items-start p-2.5 rounded-xl bg-white/5">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 text-[10px] font-black">2</span>
                    <p>اضغط على زر المشاركة <span className="text-purple-300">⎋ (Share)</span> في أسفل الشاشة.</p>
                  </div>
                  <div className="flex gap-2.5 items-start p-2.5 rounded-xl bg-white/5">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 text-[10px] font-black">3</span>
                    <p>اختر <span className="text-purple-300">"إضافة إلى الشاشة الرئيسية" (Add to Home Screen)</span>.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer note */}
          <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] text-white/40 font-bold">
            <span>نظام جداول منار الذكي 💡</span>
            <span>تحديثات مستمرة 🚀</span>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
