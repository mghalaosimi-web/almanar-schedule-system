import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

export default function LicenseSuspended() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[#000] p-4 relative overflow-hidden" style={{ fontFamily: "'Urbanist', 'Inter', sans-serif" }}>
      {/* Dynamic ambient background orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] rounded-full blur-[150px] mix-blend-screen pointer-events-none opacity-20 bg-red-500/20 animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] rounded-full blur-[150px] mix-blend-screen pointer-events-none opacity-10 bg-orange-500/20 animate-pulse" style={{ animationDelay: '2s' }} />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="w-full max-w-md bg-white/[0.02] backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden"
      >
        {/* Visual premium accent line */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-red-500 via-orange-500 to-red-500" />
        
        {/* Warning Icon Badge */}
        <div className="mx-auto mb-6 w-16 h-16 rounded-2xl bg-gradient-to-tr from-red-500/20 to-orange-500/10 border border-red-500/30 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(239,68,68,0.15)] animate-pulse">
          🔌
        </div>

        <h1 className="text-2xl font-black text-white uppercase tracking-wider mb-3 bg-clip-text bg-gradient-to-r from-red-400 to-orange-400">
          {isAr ? 'تم تعليق ترخيص النظام' : 'License Revoked'}
        </h1>
        
        <p className="text-sm font-bold text-slate-300 leading-relaxed mb-6">
          {isAr 
            ? 'تم تعليق ترخيص النظام لهذه المؤسسة، يرجى التواصل مع المطور (M.GH.AL).' 
            : 'The system license for this institution has been suspended. Please contact the developer (M.GH.AL).'}
        </p>

        {/* Developer signature pill */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
          <span>STATUS: LICENSE_SUSPENDED</span>
        </div>

        {/* Action Button */}
        <div className="mt-8">
          <button
            onClick={() => window.location.href = '/login'}
            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/25 text-white rounded-xl text-xs font-black transition-all cursor-pointer"
          >
            {isAr ? 'العودة لصفحة تسجيل الدخول' : 'Back to Login'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
