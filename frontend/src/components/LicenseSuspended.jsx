import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

export default function LicenseSuspended() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-[#030303] p-4 relative overflow-hidden" style={{ fontFamily: "'Urbanist', 'Inter', sans-serif" }}>
      {/* Cyberpunk Dynamic Ambient Background */}
      <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] rounded-full blur-[150px] mix-blend-screen pointer-events-none opacity-20 bg-red-600/20 animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[70vw] h-[70vw] rounded-full blur-[150px] mix-blend-screen pointer-events-none opacity-10 bg-purple-600/20 animate-pulse" style={{ animationDelay: '2s' }} />

      {/* Cyber Grid Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none opacity-50" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut', type: 'spring', damping: 20 }}
        className="w-full max-w-lg bg-[#0a0a0a]/80 backdrop-blur-3xl border border-red-500/30 rounded-3xl p-10 shadow-[0_0_50px_rgba(239,68,68,0.15)] text-center relative overflow-hidden group"
      >
        {/* Animated Cyber Glitch Line */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-purple-500 to-red-600 group-hover:h-1.5 transition-all" />
        <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
        
        {/* Warning Icon Badge */}
        <div className="mx-auto mb-8 w-20 h-20 rounded-2xl bg-[#050505] border border-red-500/50 flex items-center justify-center text-4xl shadow-[inset_0_0_20px_rgba(239,68,68,0.3)] animate-pulse relative">
          <div className="absolute inset-0 rounded-2xl border border-red-500/30 animate-ping opacity-20" />
          💀
        </div>

        <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 uppercase tracking-widest mb-4">
          {isAr ? 'تم تعليق ترخيص النظام' : 'License Suspended'}
        </h1>
        
        <p className="text-base font-bold text-slate-300 leading-relaxed mb-8 tracking-wide">
          {isAr 
            ? 'ترخيص النظام معلق. يرجى التواصل مع المطور (M.GH.AL).' 
            : 'System license suspended. Please contact the developer (M.GH.AL).'}
        </p>

        {/* Developer signature pill */}
        <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-red-950/30 border border-red-500/20 text-xs font-mono text-red-400 font-black tracking-widest shadow-inner mb-8">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-ping shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
          <span>STATUS: LICENSE_REVOKED</span>
        </div>

        {/* Action Button */}
        <div className="mt-4">
          <button
            onClick={() => window.location.href = '/login'}
            className="w-full py-4 bg-red-600/10 hover:bg-red-600/20 border border-red-500/30 hover:border-red-500/50 text-red-400 rounded-xl text-xs font-black tracking-widest uppercase transition-all cursor-pointer shadow-[0_0_20px_rgba(239,68,68,0.1)] hover:shadow-[0_0_30px_rgba(239,68,68,0.2)]"
          >
            {isAr ? 'العودة لصفحة تسجيل الدخول' : 'Return to Authorization'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
