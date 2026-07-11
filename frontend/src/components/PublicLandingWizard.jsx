import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { API_URL } from '../config';
import Logo from '../Logo';
import ThemeSwitcher from '../ThemeSwitcher';

const containerVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, staggerChildren: 0.1 } },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.3 } }
};
const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100, damping: 15 } }
};

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const SCHED_DAYS = ['SATURDAY', 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'];
const DAYS_AR = {
  SUNDAY: 'الأحد',
  MONDAY: 'الاثنين',
  TUESDAY: 'الثلاثاء',
  WEDNESDAY: 'الأربعاء',
  THURSDAY: 'الخميس',
  FRIDAY: 'الجمعة',
  SATURDAY: 'السبت'
};
const DAYS_EN = {
  SUNDAY: 'Sunday',
  MONDAY: 'Monday',
  TUESDAY: 'Tuesday',
  WEDNESDAY: 'Wednesday',
  THURSDAY: 'Thursday',
  FRIDAY: 'Friday',
  SATURDAY: 'Saturday'
};


/* ── Developer Splash Screen ─────────────────────────────────────── */
function DevSplash({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.6 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--bg-primary)]"
      style={{ fontFamily: "'Urbanist', sans-serif" }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[120px] opacity-20 bg-cyan-500/30" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-[150px] opacity-10 bg-purple-500/30" />
      </div>

      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.2 }}
        className="relative z-10 flex flex-col items-center gap-6"
      >
        {/* Dev Logo Badge */}
        <div className="relative">
          <div className="absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-cyan-500/30 to-purple-500/20 blur-xl animate-pulse" />
          <div className="relative w-28 h-28 rounded-[2rem] bg-gradient-to-br from-white/10 to-black/60 border border-white/20 shadow-2xl flex items-center justify-center">
            <motion.span
              className="text-4xl font-black tracking-tighter select-none"
              style={{ background: 'linear-gradient(135deg, #22d3ee, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
              animate={{ textShadow: ['0 0 20px rgba(34,211,238,0.5)', '0 0 40px rgba(168,85,247,0.5)', '0 0 20px rgba(34,211,238,0.5)'] }}
              transition={{ repeat: Infinity, duration: 3 }}
            >
              M
            </motion.span>
          </div>
        </div>

        {/* Dev name */}
        <div className="text-center space-y-1">
          <a href="https://github.com/mghalaosimi-web" target="_blank" rel="noopener noreferrer">
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-2xl font-black tracking-widest text-white uppercase hover:text-[var(--accent)] transition-colors cursor-pointer"
            >
              M.GH.AL
            </motion.h1>
          </a>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-xs font-black tracking-[0.3em] uppercase text-cyan-400"
          >
            Full-Stack Engineer
          </motion.p>
        </div>

        {/* Social links */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="flex items-center gap-5 mt-2"
        >
          {/* WhatsApp */}
          <a href="https://wa.me/967776778675" target="_blank" rel="noopener noreferrer"
            className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 hover:bg-emerald-500 hover:text-white hover:scale-110 transition-all duration-300 shadow-lg animate-fade-in">
            <svg className="w-5.5 h-5.5 md:w-6 md:h-6 fill-current" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.449 5.4 0 9.793-4.393 9.797-9.799.002-2.618-1.01-5.08-2.858-6.932C16.36 2.022 13.9 1.01 11.3 1.01 5.9 1.01 1.5 5.4 1.5 10.8c0 1.5.4 3 1.2 4.4l-.9 3.4 3.4-.9v.054z"/>
            </svg>
          </a>
          {/* GitHub */}
          <a href="https://github.com/mghalaosimi-web" target="_blank" rel="noopener noreferrer"
            className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-purple-600/10 border border-purple-600/30 flex items-center justify-center text-purple-400 hover:bg-purple-600 hover:text-white hover:scale-110 transition-all duration-300 shadow-lg animate-fade-in">
            <svg className="w-5.5 h-5.5 md:w-6 md:h-6 fill-current" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
          </a>
          {/* Facebook */}
          <a href="https://www.facebook.com/share/17qDmKy45x/" target="_blank" rel="noopener noreferrer"
            className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-blue-600/10 border border-blue-600/30 flex items-center justify-center text-blue-400 hover:bg-blue-600 hover:text-white hover:scale-110 transition-all duration-300 shadow-lg">
            <svg className="w-5.5 h-5.5 md:w-6 md:h-6 fill-current" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </a>
          {/* Instagram */}
          <a href="https://www.instagram.com/m.gh.al.2006?igsh=MTR3b3Y4ODN4bWNpcw==" target="_blank" rel="noopener noreferrer"
            className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-pink-600/10 border border-pink-600/30 flex items-center justify-center text-pink-400 hover:bg-pink-600 hover:text-white hover:scale-110 transition-all duration-300 shadow-lg">
            <svg className="w-5.5 h-5.5 md:w-6 md:h-6 fill-current" viewBox="0 0 24 24">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051C.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
            </svg>
          </a>
          {/* Telegram */}
          <a href="https://t.me/mghalaosimi" target="_blank" rel="noopener noreferrer"
            className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 hover:bg-sky-500 hover:text-white hover:scale-110 transition-all duration-300 shadow-lg">
            <svg className="w-5.5 h-5.5 md:w-6 md:h-6 fill-current" viewBox="0 0 24 24">
              <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm5.562 8.161c-.18.717-.962 4.084-1.362 5.477-.168.587-.367.876-.566.906-.438.066-.772-.259-1.196-.537-.665-.436-1.041-.707-1.687-1.132-.747-.492-.263-.762.163-1.204.111-.116 2.049-1.879 2.087-2.041.005-.02.01-.097-.036-.136-.046-.04-.112-.027-.161-.016-.07.016-1.187.755-3.342 2.21-.316.217-.602.324-.858.318-.282-.006-.826-.16-1.229-.291-.496-.162-.889-.249-.855-.527.017-.145.218-.294.602-.446 2.366-.99 3.942-1.644 4.729-1.963 2.249-.913 2.716-1.071 3.021-1.076.067-.001.218.016.315.096.082.067.105.158.114.223.009.066.012.203.003.312z"/>
            </svg>
          </a>
          {/* TikTok */}
          <a href="https://tiktok.com/@mghalaosimi" target="_blank" rel="noopener noreferrer"
            className="w-11 h-11 md:w-12 md:h-12 rounded-2xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400 hover:bg-pink-500 hover:text-white hover:scale-110 transition-all duration-300 shadow-lg">
            <svg className="w-5.5 h-5.5 md:w-6 md:h-6 fill-current" viewBox="0 0 24 24">
              <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.06-2.89-.58-4.09-1.42-.76-.53-1.39-1.25-1.85-2.07v7.41c.01 2.32-.82 4.67-2.52 6.27-1.83 1.74-4.57 2.45-7.01 1.84-2.58-.65-4.83-2.62-5.65-5.15-.99-3.05.35-6.72 3.12-8.29 1.55-.88 3.4-.97 5.09-.43v4.22c-1.2-.56-2.73-.32-3.64.66-.96 1.03-1.12 2.75-.38 3.9.72 1.13 2.13 1.72 3.44 1.46 1.34-.28 2.36-1.47 2.38-2.86V.02z"/>
            </svg>
          </a>
        </motion.div>

        {/* Bio */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="text-[11px] text-white/50 font-bold text-center max-w-xs leading-relaxed px-4"
          dir="rtl"
        >
          نظام جداول منار الذكي — برمجة وتطوير م. محمد غالب العصيمي
        </motion.p>

        {/* Loading bar */}
        <motion.div className="w-48 h-0.5 bg-white/10 rounded-full overflow-hidden mt-2">
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 2.5, ease: 'easeInOut' }}
          />
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{ delay: 1.5, duration: 1.5, repeat: Infinity }}
          className="text-[9px] tracking-[0.4em] uppercase text-white/30 font-black"
        >
          Loading...
        </motion.p>
      </motion.div>
    </motion.div>
  );
}

/* ── Info Modal ─────────────────────────────────────────────────── */
function InfoModal({ type, onClose }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white/5 border border-white/10 backdrop-blur-2xl p-8 rounded-3xl shadow-2xl w-full max-w-lg relative"
        dir="rtl"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-white/60 hover:text-white text-xl font-bold bg-white/5 hover:bg-white/10 w-8 h-8 rounded-full flex items-center justify-center transition-all"
        >✕</button>

        {type === 'about' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-xl">📱</div>
              <h3 className="text-xl font-black text-[var(--accent)]">عن نظام جداول منار الذكي</h3>
            </div>
            <p className="text-sm text-white/80 leading-relaxed font-bold">
              نظام منار للجدولة الذكية هو منصة أكاديمية متكاملة تهدف لتسهيل وصول الطلاب وأعضاء هيئة التدريس لجداول المحاضرات والاختبارات المحدّثة لحظياً.
            </p>
            <div className="space-y-3 mt-4">
              {[
                { icon: '📅', title: 'جداول دراسية فورية', desc: 'تتبع أحدث مواعيد القاعات والمحاضرات بشكل لحظي.' },
                { icon: '🔔', title: 'إشعارات فورية', desc: 'تنبيهات فورية عند أي تعديل أو إلغاء لمحاضرة.' },
                { icon: '📲', title: 'حضور رقمي بالـ QR', desc: 'تسجيل الحضور في ثوانٍ عبر مسح رمز الاستجابة السريعة.' },
                { icon: '🌐', title: 'يعمل بدون إنترنت', desc: 'يعرض الجداول المخزنة حتى في حالة انقطاع الشبكة.' },
              ].map((f, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-xl bg-white/3 border border-white/5">
                  <span className="text-lg shrink-0">{f.icon}</span>
                  <div>
                    <p className="text-xs font-black text-white">{f.title}</p>
                    <p className="text-[11px] text-white/50 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 p-4 rounded-2xl bg-white/3 border border-white/5 text-center">
              <p className="text-[10px] text-white/40 font-bold">برمجة وتطوير</p>
              <p className="text-sm font-black text-[var(--accent)] mt-1">م. محمد غالب العصيمي</p>
              <div className="flex justify-center gap-3 mt-3 flex-wrap">
                <a href="https://wa.me/967776778675" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 text-[11px] font-bold flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.449 5.4 0 9.793-4.393 9.797-9.799.002-2.618-1.01-5.08-2.858-6.932C16.36 2.022 13.9 1.01 11.3 1.01 5.9 1.01 1.5 5.4 1.5 10.8c0 1.5.4 3 1.2 4.4l-.9 3.4 3.4-.9v.054z"/></svg>
                  واتساب
                </a>
                <a href="https://github.com/mghalaosimi-web" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 text-[11px] font-bold flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                  جيت هاب
                </a>
                <a href="https://www.facebook.com/share/17qDmKy45x/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-[11px] font-bold flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  فيسبوك
                </a>
                <a href="https://www.instagram.com/m.gh.al.2006?igsh=MTR3b3Y4ODN4bWNpcw==" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300 text-[11px] font-bold flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051C.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
                  إنستغرام
                </a>
                <a href="https://t.me/mghalaosimi" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:text-sky-300 text-[11px] font-bold flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm5.562 8.161c-.18.717-.962 4.084-1.362 5.477-.168.587-.367.876-.566.906-.438.066-.772-.259-1.196-.537-.665-.436-1.041-.707-1.687-1.132-.747-.492-.263-.762.163-1.204.111-.116 2.049-1.879 2.087-2.041.005-.02.01-.097-.036-.136-.046-.04-.112-.027-.161-.016-.07.016-1.187.755-3.342 2.21-.316.217-.602.324-.858.318-.282-.006-.826-.16-1.229-.291-.496-.162-.889-.249-.855-.527.017-.145.218-.294.602-.446 2.366-.99 3.942-1.644 4.729-1.963 2.249-.913 2.716-1.071 3.021-1.076.067-.001.218.016.315.096.082.067.105.158.114.223.009.066.012.203.003.312z"/></svg>
                  تيليقرام
                </a>
                <a href="https://tiktok.com/@mghalaosimi" target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300 text-[11px] font-bold flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.06-2.89-.58-4.09-1.42-.76-.53-1.39-1.25-1.85-2.07v7.41c.01 2.32-.82 4.67-2.52 6.27-1.83 1.74-4.57 2.45-7.01 1.84-2.58-.65-4.83-2.62-5.65-5.15-.99-3.05.35-6.72 3.12-8.29 1.55-.88 3.4-.97 5.09-.43v4.22c-1.2-.56-2.73-.32-3.64.66-.96 1.03-1.12 2.75-.38 3.9.72 1.13 2.13 1.72 3.44 1.46 1.34-.28 2.36-1.47 2.38-2.86V.02z"/></svg>
                  تيك توك
                </a>
              </div>
            </div>
          </div>
        )}

        {type === 'terms' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-xl">📋</div>
              <h3 className="text-xl font-black text-[var(--accent)]">الشروط والأحكام</h3>
            </div>
            <div className="text-xs text-white/70 space-y-3 leading-relaxed overflow-y-auto max-h-[350px] pl-2 font-bold">
              {[
                '١. استخدام النظام مخصص فقط للطلاب والأكاديميين المسجلين رسمياً في المؤسسات المشاركة.',
                '٢. يلتزم المستخدم بالحفاظ على سرية بيانات حسابه وعدم مشاركتها مع أطراف أخرى.',
                '٣. يتم تسجيل الحضور والغياب إلكترونياً ويتحمل الطالب مسؤولية صحة البيانات المرفوعة.',
                '٤. تحتفظ إدارة النظام بالحق في تعليق أي حساب يخالف شروط الاستخدام أو يسيء استخدام الميزات الرقمية.',
                '٥. لا يُسمح بمشاركة بيانات الحساب مع الغير أو استخدام حسابات الآخرين.',
                '٦. البيانات المدخلة (الاسم، الرقم الجامعي، الصورة) تُستخدم فقط لأغراض أكاديمية رسمية.',
                '٧. في حالة فقدان كلمة المرور، يجب التواصل مع إدارة الكلية.',
                '٨. الجهة المطورة غير مسؤولة عن أي أضرار ناجمة عن سوء استخدام النظام.',
              ].map((t, i) => (
                <p key={i} className="border-b border-white/5 pb-2">{t}</p>
              ))}
            </div>
          </div>
        )}

        {type === 'instructions' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-xl">📖</div>
              <h3 className="text-xl font-black text-[var(--accent)]">تعليمات الاستخدام</h3>
            </div>
            <div className="space-y-3 overflow-y-auto max-h-[380px]">
              {[
                { step: '١', icon: '🏫', title: 'اختيار الجامعة', desc: 'اختر محافظتك أولاً، ثم الجامعة أو الكلية التي تنتمي إليها.' },
                { step: '٢', icon: '📚', title: 'اختيار التخصص', desc: 'حدد كليتك وتخصصك الدراسي لعرض الجدول المناسب.' },
                { step: '٣', icon: '🔐', title: 'تسجيل الدخول', desc: 'إذا كان لديك حساب مسبقاً، سجّل دخولك. وإذا كنت طالباً جديداً، أنشئ حساباً وانتظر توثيقه من الإدارة.' },
                { step: '٤', icon: '📅', title: 'الجدول الدراسي', desc: 'بعد الدخول ستجد جدولك الأسبوعي مع جميع المحاضرات والقاعات.' },
                { step: '٥', icon: '📲', title: 'تسجيل الحضور', desc: 'عند بدء المحاضرة، استخدم ماسح الـ QR لتسجيل حضورك فوراً.' },
                { step: '٦', icon: '🔔', title: 'التنبيهات', desc: 'فعّل الإشعارات لتلقّي تنبيهات فورية عند أي تعديل في الجدول.' },
                { step: '٧', icon: '🌐', title: 'وضع عدم الاتصال', desc: 'النظام يعمل بدون إنترنت لعرض الجداول المخزنة سابقاً.' },
              ].map((s, i) => (
                <div key={i} className="flex gap-3 p-3 rounded-xl bg-white/3 border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent)]/20 flex items-center justify-center text-[var(--accent)] font-black text-xs shrink-0">{s.step}</div>
                  <div>
                    <p className="text-xs font-black text-white flex items-center gap-2">{s.icon} {s.title}</p>
                    <p className="text-[11px] text-white/50 leading-relaxed mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

/* ── Main Component ──────────────────────────────────────────────── */
export default function PublicLandingWizard() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();

  // Splash screen state
  const [showSplash, setShowSplash] = useState(() => {
    return !sessionStorage.getItem('splash_shown');
  });

  // Wizard flow
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [modalType, setModalType] = useState(null);

  // PWA Installer State & Listeners
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const checkStandalone = () => {
      const isMqy = window.matchMedia('(display-mode: standalone)').matches;
      const isNavStandalone = window.navigator.standalone; // iOS
      setIsStandalone(isMqy || isNavStandalone);
    };
    checkStandalone();
    
    // Listen for changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener('change', checkStandalone);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      mediaQuery.removeEventListener('change', checkStandalone);
    };
  }, []);

  const handlePwaButtonClick = async () => {
    if (isStandalone) {
      navigate('/login');
      return;
    }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA Install choice: ${outcome}`);
      setDeferredPrompt(null);
    } else {
      navigate('/login');
    }
  };

  // Data
  const [governorates, setGovernorates] = useState([]);
  const [universities, setUniversities] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [majors, setMajors] = useState([]);

  // Selected values
  const [selectedGov, setSelectedGov] = useState(null);
  const [selectedUni, setSelectedUni] = useState(null);
  const [selectedCollege, setSelectedCollege] = useState(null);
  const [selectedMajor, setSelectedMajor] = useState(null);

  const [schedules, setSchedules] = useState([]);
  const [scheduleFilterMode, setScheduleFilterMode] = useState('single'); // 'single' | 'all'
  const [publicSchedulesLoading, setPublicSchedulesLoading] = useState(false);

  useEffect(() => {
    if (step === 5 && selectedCollege?.id) {
      const fetchPublicSchedules = async () => {
        setPublicSchedulesLoading(true);
        try {
          const res = await axios.get(`${API_URL}/api/public/schedules?collegeId=${selectedCollege.id}`);
          if (res.data?.success) {
            setSchedules(res.data.data);
          }
        } catch (err) {
          console.error('Error fetching public schedules:', err);
          toast.error(isAr ? 'فشل تحميل الجداول الدراسية' : 'Failed to load schedules');
        } finally {
          setPublicSchedulesLoading(false);
        }
      };
      fetchPublicSchedules();
    }
  }, [step, selectedCollege?.id]);

  const handleDropdownGovChange = async (govId) => {
    const gov = governorates.find(g => g.id.toString() === govId);
    if (!gov) return;
    setSelectedGov(gov);
    setSelectedUni(null);
    setSelectedCollege(null);
    setSelectedMajor(null);
    setSchedules([]);
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/public/universities?govId=${gov.id}`);
      if (res.data?.success) {
        setUniversities(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDropdownUniChange = async (uniId) => {
    const uni = universities.find(u => u.id.toString() === uniId);
    if (!uni) return;
    setSelectedUni(uni);
    setSelectedCollege(null);
    setSelectedMajor(null);
    setSchedules([]);
    applyUniTheme(uni);
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/public/colleges?uniId=${uni.id}`);
      if (res.data?.success) {
        setColleges(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDropdownCollegeChange = async (collegeId) => {
    const col = colleges.find(c => c.id.toString() === collegeId);
    if (!col) return;
    setSelectedCollege(col);
    setSelectedMajor(null);
    setSchedules([]);
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/public/majors?collegeId=${col.id}`);
      if (res.data?.success) {
        setMajors(res.data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDropdownMajorChange = (majorId) => {
    const maj = majors.find(m => m.id.toString() === majorId);
    if (maj) {
      setSelectedMajor(maj);
      localStorage.setItem('preselectedMajorId', maj.id);
      localStorage.setItem('preselectedMajorName', maj.name);
    }
  };


  // Multi-tenancy Dynamic URL Resolution
  const { uniSlug, collegeSlug } = useParams();

  useEffect(() => {
    const resolveTenant = async () => {
      const slug = uniSlug || collegeSlug;
      if (!slug) return;

      setLoading(true);
      try {
        const govsRes = await axios.get(`${API_URL}/api/public/governorates`);
        let allGovs = [];
        if (govsRes.data?.success) {
          allGovs = govsRes.data.data;
          setGovernorates(allGovs);
        }

        const res = await axios.get(`${API_URL}/api/public/tenant/info?slug=${slug}`);
        if (res.data?.success && res.data.data) {
          const config = res.data.data;
          
          // Apply custom theme color
          const themeColor = config.themeColor || '#60c4ff';
          document.documentElement.style.setProperty('--accent', themeColor);
          document.documentElement.style.setProperty('--accent-glow', `${themeColor}33`);
          document.documentElement.style.setProperty('--accent-dim', `${themeColor}1a`);

          // Apply brand context to localStorage
          if (config.themeColor) localStorage.setItem('selectedUniversityThemeColor', config.themeColor);
          if (config.logoUrl) localStorage.setItem('selectedUniversityLogo', config.logoUrl);

          if (config.university) {
            const uni = config.university;
            setSelectedUni(uni);
            localStorage.setItem('selectedUniversityId', uni.id);
            localStorage.setItem('selectedUniversityName', uni.name || '');
            localStorage.setItem('selectedUniversitySlug', uni.slug || '');
            
            if (!config.themeColor && uni.themeColor) {
              document.documentElement.style.setProperty('--accent', uni.themeColor);
            }

            // Set governorate and fetch sibling universities
            if (uni.governorateId) {
              const matchedGov = allGovs.find(g => g.id === uni.governorateId);
              if (matchedGov) setSelectedGov(matchedGov);
              const unisRes = await axios.get(`${API_URL}/api/public/universities?govId=${uni.governorateId}`);
              if (unisRes.data?.success) {
                setUniversities(unisRes.data.data);
              }
            }
            
            // Fetch colleges for this university
            const colRes = await axios.get(`${API_URL}/api/public/colleges?uniId=${uni.id}`);
            if (colRes.data?.success) {
              let collegesData = colRes.data.data;
              setColleges(collegesData);
              localStorage.setItem(`cached_colleges_${uni.id}`, JSON.stringify(collegesData));
            }
            
            setStep(3); // Skip to College selection
          } else if (config.college) {
            const college = config.college;
            setSelectedCollege(college);
            localStorage.setItem('selectedCollegeId', college.id);
            localStorage.setItem('selectedCollegeName', college.name || '');
            localStorage.setItem('selectedCollegeSlug', college.slug || '');

            if (college.university) {
              const uni = college.university;
              setSelectedUni(uni);
              localStorage.setItem('selectedUniversityId', uni.id);
              localStorage.setItem('selectedUniversityName', uni.name || '');
              localStorage.setItem('selectedUniversitySlug', uni.slug || '');
              
              if (!config.themeColor && uni.themeColor) {
                document.documentElement.style.setProperty('--accent', uni.themeColor);
              }
              if (!config.logoUrl && uni.logoUrl) {
                localStorage.setItem('selectedUniversityLogo', uni.logoUrl);
              }

              // Set governorate and fetch sibling universities
              if (uni.governorateId) {
                const matchedGov = allGovs.find(g => g.id === uni.governorateId);
                if (matchedGov) setSelectedGov(matchedGov);
                const unisRes = await axios.get(`${API_URL}/api/public/universities?govId=${uni.governorateId}`);
                if (unisRes.data?.success) {
                  setUniversities(unisRes.data.data);
                }
              }

              // Fetch sibling colleges
              const colRes = await axios.get(`${API_URL}/api/public/colleges?uniId=${uni.id}`);
              if (colRes.data?.success) {
                setColleges(colRes.data.data);
              }
            }

            // Fetch majors for this college
            const majorsRes = await axios.get(`${API_URL}/api/public/majors?collegeId=${college.id}`);
            if (majorsRes.data?.success) {
              setMajors(majorsRes.data.data);
              setStep(4); // Skip to Major selection
            }
          }
        }
      } catch (err) {
        console.error('Error resolving tenant slug:', err);
        toast.error(isAr ? 'فشل تحميل إعدادات الرابط المخصص' : 'Failed to load tenant configuration');
      } finally {
        setLoading(false);
      }
    };
    
    resolveTenant();
  }, [uniSlug, collegeSlug]);

  // Developer mode tap counter (10 taps on logo = dev login)
  const devTapCount = useRef(0);
  const devTapTimer = useRef(null);

  const handleLogoTap = () => {
    devTapCount.current += 1;
    if (devTapTimer.current) clearTimeout(devTapTimer.current);
    devTapTimer.current = setTimeout(() => { devTapCount.current = 0; }, 2000);
    if (devTapCount.current >= 10) {
      devTapCount.current = 0;
      navigate('/login?tab=FACULTY&dev=true');
    }
  };

  // Session check
  useEffect(() => {
    const token = localStorage.getItem('manar_token');
    const userJson = localStorage.getItem('manar_user');
    if (token && userJson) {
      try {
        const user = JSON.parse(userJson);
        if (user.role === 'STUDENT') navigate('/student/home', { replace: true });
        else if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') navigate('/admin/overview', { replace: true });
        else if (user.role === 'LECTURER') navigate('/lecturer/home', { replace: true });
      } catch (e) {}
    }
  }, [navigate]);

  // Fetch governorates
  useEffect(() => {
    const fetchGovs = async () => {
      setLoading(true);
      try {
        // Try to load from cache first (offline support)
        const cached = localStorage.getItem('cached_governorates');
        if (cached) {
          const parsed = JSON.parse(cached);
          setGovernorates(parsed);
        }
        const res = await axios.get(`${API_URL}/api/public/governorates`);
        if (res.data?.success && res.data.data?.length > 0) {
          const filtered = res.data.data;
          setGovernorates(filtered);
          localStorage.setItem('cached_governorates', JSON.stringify(filtered));
        }
      } catch (err) {
        console.error('Error fetching governorates:', err);
        // Fallback to cache
        const cached = localStorage.getItem('cached_governorates');
        if (cached) {
          const parsed = JSON.parse(cached);
          setGovernorates(parsed);
        } else {
          // Static fallback — Hajjah
          setGovernorates([{ id: '63b8f7b1-0205-4da3-9a63-2d38dfdca859', name: 'حجة', nameEn: 'Hajjah' }]);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchGovs();
  }, []);

  const handleSplashDone = () => {
    sessionStorage.setItem('splash_shown', '1');
    setShowSplash(false);
  };

  const applyUniTheme = (uni) => {
    const color = uni?.themeColor || '#3b82f6';
    document.documentElement.style.setProperty('--accent', color);
    document.documentElement.style.setProperty('--accent-glow', `${color}33`);
    document.documentElement.style.setProperty('--accent-dim', `${color}1a`);
  };

  const handleSelectGov = async (gov) => {
    setSelectedGov(gov);
    setSelectedUni(null); setSelectedCollege(null); setSelectedMajor(null);
    setLoading(true);
    try {
      const cacheKey = `cached_universities_${gov.id}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) setUniversities(JSON.parse(cached));
      
      const res = await axios.get(`${API_URL}/api/public/universities?govId=${gov.id}`);
      if (res.data?.success) {
        setUniversities(res.data.data);
        localStorage.setItem(cacheKey, JSON.stringify(res.data.data));
        setStep(2);
      }
    } catch (err) {
      const cached = localStorage.getItem(`cached_universities_${gov.id}`);
      if (cached) { setUniversities(JSON.parse(cached)); setStep(2); }
      else toast.error(isAr ? 'فشل تحميل الجامعات' : 'Failed to load universities');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectUni = async (uni) => {
    setSelectedUni(uni);
    setSelectedCollege(null); setSelectedMajor(null);
    // Apply theme immediately on university selection
    applyUniTheme(uni);
    setLoading(true);

    // Store for later use
    localStorage.setItem('selectedUniversityId', uni.id);
    localStorage.setItem('selectedUniversityName', uni.name || '');
    localStorage.setItem('selectedUniversitySlug', uni.slug || '');
    localStorage.setItem('selectedUniversityThemeColor', uni.themeColor || '');
    const forcedLogo = uni.slug === 'hajjah-university' ? '/hajjah-logo-new.png' :
                       uni.slug === 'almanar-college' ? '/almanar-logo.png' : uni.logoUrl;
    if (forcedLogo) localStorage.setItem('selectedUniversityLogo', forcedLogo);

    try {
      const res = await axios.get(`${API_URL}/api/public/colleges?uniId=${uni.id}`);
      if (res.data?.success) {
        let collegesData = res.data.data;
        setColleges(collegesData);
        localStorage.setItem(`cached_colleges_${uni.id}`, JSON.stringify(collegesData));
        setStep(3); // Go to College selection normally (no skip for Al-Manar)
      }
    } catch (err) {
      toast.error(isAr ? 'فشل تحميل بيانات الجامعة' : 'Failed to load college data');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCollege = async (college) => {
    setSelectedCollege(college);
    setSelectedMajor(null);
    localStorage.setItem('selectedCollegeId', college.id);
    localStorage.setItem('selectedCollegeName', college.name || '');
    localStorage.setItem('selectedCollegeSlug', college.slug || '');
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/public/majors?collegeId=${college.id}`);
      if (res.data?.success) { setMajors(res.data.data); setStep(4); }
    } catch {
      toast.error(isAr ? 'فشل تحميل التخصصات' : 'Failed to load majors');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMajor = (major) => {
    setSelectedMajor(major);
    if (major?.id) localStorage.setItem('preselectedMajorId', major.id);
    if (major?.name) localStorage.setItem('preselectedMajorName', major.name);
    setStep(5);
  };

  const handleBack = () => {
    if (uniSlug && step === 3) return; // Cannot go back past college selection
    if (collegeSlug && step === 4) return; // Cannot go back past major selection

    if (step === 4 && (selectedUni?.slug === 'almanar-college' || selectedUni?.name?.includes('المنار'))) {
      setStep(2);
    } else if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleLogin = () => navigate('/login');
  const handleSignUp = () => navigate('/register', {
    state: { prefilledData: { collegeId: selectedCollege?.id, majorId: selectedMajor?.id } }
  });

  const handleAdminEntry = () => {
    navigate('/login?tab=FACULTY');
  };

  const progressPercentage = (step / 5) * 100;

  const getLogoSrc = (uni) => {
    if (!uni) return null;
    return uni.slug === 'hajjah-university' ? '/hajjah-logo-new.png' :
           uni.slug === 'almanar-college' ? '/almanar-logo.png' : uni.logoUrl;
  };

  return (
    <>
      {/* Developer Splash Screen */}
      <AnimatePresence>
        {showSplash && <DevSplash onDone={handleSplashDone} />}
      </AnimatePresence>

      {/* Main App */}
      <AnimatePresence>
        {!showSplash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            dir={isAr ? 'rtl' : 'ltr'}
            className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col items-center justify-center relative overflow-hidden font-urbanist selection:bg-[var(--accent)] selection:text-white transition-colors duration-700"
          >
            {/* Background Ambient Orbs */}
            <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full blur-[120px] mix-blend-screen pointer-events-none transition-colors duration-700 opacity-20" style={{ backgroundColor: 'var(--accent)' }} />
            <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full blur-[150px] mix-blend-screen pointer-events-none transition-colors duration-700 opacity-10" style={{ backgroundColor: 'var(--accent)' }} />

            {/* Top Utilities bar */}
            <div className="absolute top-6 right-6 z-50 flex items-center gap-4">
              <button
                onClick={() => {
                  // Clear offline caches and refresh
                  localStorage.removeItem('cached_govs');
                  window.location.reload();
                }}
                className="px-3.5 py-2 rounded-full bg-white/5 border border-white/10 text-[11px] hover:bg-white/10 transition-all font-bold flex items-center gap-1.5 text-white/80 hover:text-white"
                title={isAr ? "تحديث التطبيق" : "Refresh App"}
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <path d="M19 8l-4 4h3c0 3.31-2.69 6-6 6-1.01 0-1.97-.25-2.8-.7l-1.46 1.46C8.97 19.54 10.43 20 12 20c4.42 0 8-3.58 8-8h3l-4-4zM6 12c0-3.31 2.69-6 6-6 1.01 0 1.97.25 2.8.7l1.46-1.46C15.03 4.46 13.57 4 12 4c-4.42 0-8 3.58-8 8H1l4 4 4-4H6z"/>
                </svg>
                <span>{isAr ? 'تحديث' : 'Refresh'}</span>
              </button>
              <ThemeSwitcher />
              <button
                onClick={() => i18n.changeLanguage(isAr ? 'en' : 'ar')}
                className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs tracking-widest uppercase hover:bg-white/10 transition-all font-bold"
              >
                {isAr ? 'EN' : 'عربي'}
              </button>
            </div>

            <div className={`relative z-10 w-full mx-auto px-4 py-6 md:py-10 flex flex-col items-center transition-all duration-500 ${step === 5 ? 'max-w-7xl' : 'max-w-2xl'}`}>
              <div className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-[2.5rem] shadow-2xl p-6 md:p-10 backdrop-blur-xl flex flex-col items-center relative overflow-hidden transition-all duration-500">

              {/* Logo with tap-5-times dev trigger */}
              <div className="mb-6 flex flex-col items-center" onClick={handleLogoTap}>
                <div className="relative p-2 rounded-[2.5rem] bg-gradient-to-r from-transparent via-[var(--accent-glow)] to-transparent cursor-pointer select-none">
                  <div className="transform-gpu">
                    {selectedUni ? (
                      <motion.img
                        key={selectedUni.id}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                        src={getLogoSrc(selectedUni)}
                        alt="Uni Logo"
                        className="w-24 h-24 object-contain rounded-[2rem] border border-white/10 bg-black/60 p-2 shadow-lg"
                      />
                    ) : (
                      <Logo size="lg" />
                    )}
                  </div>
                </div>
              </div>

              {/* PWA Installer Button */}
              {(deferredPrompt || isStandalone) && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="w-full max-w-sm mb-6 px-4"
                >
                  <button
                    onClick={handlePwaButtonClick}
                    className="w-full py-3.5 px-6 rounded-2xl bg-white/5 border border-white/10 hover:border-[var(--accent)] text-white hover:text-[var(--accent)] hover:bg-[var(--accent-dim)] font-black text-xs uppercase tracking-wider transition-all duration-300 hover:shadow-[0_0_20px_var(--accent-glow)] flex items-center justify-center gap-3 backdrop-blur-md cursor-pointer"
                  >
                    {isStandalone ? (
                      <>
                        <span>📲</span>
                        <span>{isAr ? 'فتح التطبيق' : 'Open App'}</span>
                      </>
                    ) : (
                      <>
                        <span>📥</span>
                        <span>{isAr ? 'تثبيت التطبيق على الشاشة الرئيسية' : 'Install App'}</span>
                      </>
                    )}
                  </button>
                </motion.div>
              )}

              {/* Dynamic Title */}
              <div className="text-center mb-8">
                <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-3">
                  {step === 1 ? (isAr ? 'اختر محافظتك' : 'Select Governorate')
                   : step === 2 ? (isAr ? 'اختر جامعتك' : 'Select University')
                   : step === 3 ? (isAr ? 'اختر كليتك' : 'Select College')
                   : step === 4 ? (isAr ? 'اختر تخصصك الدراسي' : 'Select Specialization')
                   : (isAr ? 'مراجعة وتأكيد' : 'Review & Confirm')}
                </h1>
                <p className="text-[var(--text-secondary)] text-sm md:text-base">
                  {step === 1 ? (isAr ? 'الخطوة الأولى للالتحاق بالنظام المركزي الأكاديمي.' : 'First step to connect to the central academic system.')
                   : step === 2 ? (isAr ? 'اختر المؤسسة الأكاديمية التابعة لمحافظتك.' : 'Choose the academic institution under your governorate.')
                   : step === 3 ? (isAr ? 'حدد الكلية المنتمي إليها.' : 'Specify the college you belong to.')
                   : step === 4 ? (isAr ? 'اختر تخصصك الدراسي لعرض الجدول.' : 'Select your major to access the schedule.')
                   : (isAr ? 'مسارك الأكاديمي جاهز. اختر إجراءً للمتابعة.' : 'Your academic path is ready. Select an action.')}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md bg-white/5 h-1.5 rounded-full mb-10 overflow-hidden relative border border-white/5">
                <motion.div
                  className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-dim)]"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercentage}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>

              {/* Step Content */}
              <div className="w-full min-h-[300px] flex items-center justify-center">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-12 h-12 rounded-full border-4 border-[var(--accent)] border-t-transparent animate-spin mb-4" />
                    <p className="text-xs font-black tracking-wider text-[var(--text-secondary)] uppercase">
                      {isAr ? 'جاري التحميل...' : 'Loading...'}
                    </p>
                  </div>
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={step}
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="w-full"
                    >
                      {/* STEP 1: GOVERNORATES */}
                      {step === 1 && (
                        <div className="space-y-6 w-full max-w-2xl mx-auto">
                          {/* Admin/Faculty Portal Button */}
                          <motion.div variants={cardVariants} className="flex justify-center">
                            <button
                              onClick={handleAdminEntry}
                              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-white/5 hover:bg-gradient-to-r hover:from-[var(--accent)] hover:to-[var(--accent-dim)] border border-white/10 hover:border-[var(--accent)] hover:text-[var(--bg-primary)] text-white/90 font-black text-xs uppercase tracking-wider transition-all duration-300 hover:shadow-[0_0_20px_var(--accent-glow)] flex items-center justify-center gap-3"
                            >
                              💼 {isAr ? 'بوابة الإدارة والأكاديميين' : 'Admin & Faculty Portal'}
                            </button>
                          </motion.div>

                          {/* Governorates Grid */}
                          {governorates.length === 0 ? (
                            <motion.div variants={cardVariants} className="text-center py-16 text-white/30 font-bold text-sm">
                              <div className="text-4xl mb-3">🏛️</div>
                              <p>{isAr ? 'لا توجد محافظات مسجلة. سيضيفها المطور قريباً.' : 'No governorates registered yet. Developer will add them soon.'}</p>
                            </motion.div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                              {governorates.map((gov) => (
                                <motion.button
                                  key={gov.id}
                                  variants={cardVariants}
                                  onClick={() => handleSelectGov(gov)}
                                  className="p-6 rounded-3xl border border-white/5 bg-white/2 hover:bg-white/5 hover:border-[var(--accent)] hover:shadow-[0_0_20px_var(--accent-glow)] transition-all flex flex-col items-center justify-center group relative overflow-hidden"
                                  whileHover={{ scale: 1.03 }}
                                  style={{ minHeight: '120px' }}
                                >
                                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--accent-dim)]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                  <span className="text-2xl mb-2">🏛️</span>
                                  <span className="text-lg font-black text-white/90 group-hover:text-white">{gov.name}</span>
                                  <span className="text-[10px] uppercase font-bold text-white/40 group-hover:text-[var(--accent)] mt-2">
                                    {isAr ? 'انقر للاختيار' : 'Tap to select'}
                                  </span>
                                </motion.button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* STEP 2: UNIVERSITIES */}
                      {step === 2 && (
                        <div className="space-y-6 w-full">
                          {/* Admin & Doctor entry button visible in step 2 */}
                          <motion.div variants={cardVariants} className="flex justify-center gap-4 flex-wrap">
                            <button
                              onClick={() => { navigate('/login?tab=FACULTY'); }}
                              className="px-6 py-3 rounded-2xl bg-white/5 hover:bg-[var(--accent-dim)] border border-white/10 hover:border-[var(--accent)] text-white/80 hover:text-white font-black text-xs uppercase tracking-wider transition-all duration-300 flex items-center gap-2"
                            >
                              🏢 {isAr ? 'دخول الإدارة' : 'Admin Login'}
                            </button>
                            <button
                              onClick={() => { navigate('/login?tab=FACULTY'); }}
                              className="px-6 py-3 rounded-2xl bg-white/5 hover:bg-[var(--accent-dim)] border border-white/10 hover:border-[var(--accent)] text-white/80 hover:text-white font-black text-xs uppercase tracking-wider transition-all duration-300 flex items-center gap-2"
                            >
                              👨‍🏫 {isAr ? 'دخول الدكتور' : 'Lecturer Login'}
                            </button>
                          </motion.div>

                          {/* Separator */}
                          <div className="flex items-center gap-4">
                            <div className="flex-1 h-px bg-white/10" />
                            <span className="text-[10px] text-white/30 font-black uppercase tracking-widest">{isAr ? 'أو اختر جامعتك كطالب' : 'or select your university'}</span>
                            <div className="flex-1 h-px bg-white/10" />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                            {universities.map((uni) => {
                              const logoSrc = getLogoSrc(uni);
                              return (
                                <motion.button
                                  key={uni.id}
                                  variants={cardVariants}
                                  onClick={() => handleSelectUni(uni)}
                                  className="p-6 rounded-3xl border border-white/5 bg-white/2 hover:bg-white/5 hover:border-[var(--accent)] hover:shadow-[0_0_25px_var(--accent-glow)] transition-all flex flex-col items-center justify-center group relative overflow-hidden"
                                  whileHover={{ scale: 1.03 }}
                                  style={{ minHeight: '160px' }}
                                >
                                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--accent-dim)]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                  {/* Logo appears immediately */}
                                  {logoSrc ? (
                                    <img
                                      src={logoSrc}
                                      alt={uni.name}
                                      className="w-16 h-16 object-contain rounded-xl border border-white/10 bg-black/40 p-1.5 mb-3 group-hover:scale-110 transition-transform duration-300 shadow-lg"
                                    />
                                  ) : (
                                    <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl mb-3">🎓</div>
                                  )}
                                  <span className="text-sm font-black text-white/90 group-hover:text-white text-center leading-snug">{uni.name}</span>
                                  <span className="text-[10px] uppercase font-bold text-white/40 group-hover:text-[var(--accent)] mt-2">
                                    {isAr ? 'اختر الجامعة' : 'Select University'}
                                  </span>
                                </motion.button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* STEP 3: COLLEGES */}
                      {step === 3 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                          {colleges.map((col) => (
                            <motion.button
                              key={col.id}
                              variants={cardVariants}
                              onClick={() => handleSelectCollege(col)}
                              className="p-6 rounded-3xl border border-white/5 bg-white/2 hover:bg-white/5 hover:border-[var(--accent)] hover:shadow-[0_0_25px_var(--accent-glow)] transition-all flex flex-col items-center justify-center group relative overflow-hidden"
                              whileHover={{ scale: 1.03 }}
                              style={{ minHeight: '140px' }}
                            >
                              <div className="absolute inset-0 bg-gradient-to-t from-[var(--accent-dim)]/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                              <div className="w-12 h-12 rounded-xl bg-[var(--accent-dim)] border border-[var(--accent)]/20 flex items-center justify-center text-xl mb-3 group-hover:scale-110 transition-transform">🏫</div>
                              <span className="text-sm font-black text-white/90 group-hover:text-white text-center leading-snug">{col.name}</span>
                              <span className="text-[10px] uppercase font-bold text-white/40 group-hover:text-[var(--accent)] mt-2">{isAr ? 'اختر الكلية' : 'Select College'}</span>
                            </motion.button>
                          ))}
                        </div>
                      )}

                      {/* STEP 4: MAJORS */}
                      {step === 4 && (
                        <div className="w-full max-w-xl mx-auto space-y-3">
                          {/* College name badge */}
                          {selectedCollege && (
                            <motion.div variants={cardVariants} className="text-center mb-4">
                              <span className="px-4 py-2 rounded-full bg-[var(--accent-dim)] border border-[var(--accent)]/20 text-[var(--accent)] text-xs font-black">
                                🏫 {selectedCollege.name}
                              </span>
                            </motion.div>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {majors.map((major) => (
                              <motion.button
                                key={major.id}
                                variants={cardVariants}
                                onClick={() => handleSelectMajor(major)}
                                className="p-5 rounded-2xl border border-white/5 bg-white/2 hover:bg-white/5 hover:border-[var(--accent)] hover:shadow-[0_0_20px_var(--accent-glow)] transition-all flex items-center justify-between group px-6"
                                whileHover={{ x: isAr ? -5 : 5 }}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-[var(--accent-dim)] border border-[var(--accent)]/20 flex items-center justify-center text-sm">📖</div>
                                  <span className="text-sm font-bold text-white/80 group-hover:text-white">{major.name}</span>
                                </div>
                                <span className="text-[var(--accent)] font-black text-lg transition-transform group-hover:translate-x-1">
                                  {isAr ? '←' : '→'}
                                </span>
                              </motion.button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* STEP 5: ENTRY GATEWAY */}
                      {step === 5 && (
                        <div className="w-full space-y-8">
                          
                          {/* Inline Cascading Dropdowns selectors */}
                          <motion.div
                            variants={cardVariants}
                            className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white/5 border border-white/10 p-4 rounded-3xl backdrop-blur-md"
                          >
                            {/* Governorate */}
                            <div className="space-y-1">
                              <label className="text-[9px] font-black uppercase tracking-wider text-white/40 block">
                                {isAr ? 'المحافظة' : 'Governorate'}
                              </label>
                              <select
                                value={selectedGov?.id || ''}
                                onChange={(e) => handleDropdownGovChange(e.target.value)}
                                className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[var(--accent)] cursor-pointer"
                              >
                                <option value="" disabled>{isAr ? 'اختر محافظة' : 'Select Gov'}</option>
                                {governorates.map(g => (
                                  <option key={g.id} value={g.id}>{g.name}</option>
                                ))}
                              </select>
                            </div>

                            {/* University */}
                            <div className="space-y-1">
                              <label className="text-[9px] font-black uppercase tracking-wider text-white/40 block">
                                {isAr ? 'الجامعة' : 'University'}
                              </label>
                              <select
                                value={selectedUni?.id || ''}
                                onChange={(e) => handleDropdownUniChange(e.target.value)}
                                disabled={!selectedGov}
                                className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[var(--accent)] disabled:opacity-50 cursor-pointer"
                              >
                                <option value="" disabled>{isAr ? 'اختر جامعة' : 'Select Uni'}</option>
                                {universities.map(u => (
                                  <option key={u.id} value={u.id}>{u.name}</option>
                                ))}
                              </select>
                            </div>

                            {/* College */}
                            <div className="space-y-1">
                              <label className="text-[9px] font-black uppercase tracking-wider text-white/40 block">
                                {isAr ? 'الكلية' : 'College'}
                              </label>
                              <select
                                value={selectedCollege?.id || ''}
                                onChange={(e) => handleDropdownCollegeChange(e.target.value)}
                                disabled={!selectedUni}
                                className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[var(--accent)] disabled:opacity-50 cursor-pointer"
                              >
                                <option value="" disabled>{isAr ? 'اختر كلية' : 'Select College'}</option>
                                {colleges.map(c => (
                                  <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                              </select>
                            </div>

                            {/* Major */}
                            <div className="space-y-1">
                              <label className="text-[9px] font-black uppercase tracking-wider text-white/40 block">
                                {isAr ? 'التخصص الدراسي' : 'Specialization'}
                              </label>
                              <select
                                value={selectedMajor?.id || ''}
                                onChange={(e) => handleDropdownMajorChange(e.target.value)}
                                disabled={!selectedCollege}
                                className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[var(--accent)] disabled:opacity-50 cursor-pointer"
                              >
                                <option value="" disabled>{isAr ? 'اختر تخصص' : 'Select Major'}</option>
                                {majors.map(m => (
                                  <option key={m.id} value={m.id}>{m.name}</option>
                                ))}
                              </select>
                            </div>
                          </motion.div>

                          {/* Authentication Action Row */}
                          <motion.div
                            variants={cardVariants}
                            className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/5 border border-white/10 p-6 rounded-3xl max-w-2xl mx-auto backdrop-blur-md shadow-2xl"
                          >
                            <div className="text-center sm:text-right space-y-1 flex-1">
                              <h3 className="text-sm font-black text-white">
                                {isAr ? 'مسارك الأكاديمي جاهز للمتابعة' : 'Academic path ready to continue'}
                              </h3>
                              <p className="text-[10px] text-white/50 leading-relaxed font-semibold">
                                {isAr 
                                  ? 'سجل دخولك لعرض الجدول الدراسي، أو أنشئ حساباً جديداً للبدء.' 
                                  : 'Sign in to view your timetable, or register a new account to start.'}
                              </p>
                            </div>

                            <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-center">
                              <button
                                onClick={handleLogin}
                                className="flex-1 sm:flex-none px-6 py-3 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 text-xs text-white font-bold transition-all hover:bg-white/10"
                              >
                                🚪 {isAr ? 'تسجيل الدخول' : 'Login'}
                              </button>
                              <button
                                onClick={handleSignUp}
                                className="flex-1 sm:flex-none px-6 py-3 rounded-xl bg-gradient-to-r from-[var(--accent)] to-[var(--accent-dim)] hover:shadow-[0_0_20px_var(--accent-glow)] text-[var(--bg-primary)] font-black text-xs transition-all hover:opacity-95"
                              >
                                🚀 {isAr ? 'إنشاء حساب جديد' : 'Sign Up'}
                              </button>
                            </div>
                          </motion.div>

                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>

              {/* Back button */}
              {step > 1 && !loading && !(uniSlug && step === 3) && !(collegeSlug && step === 4) && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-10">
                  <button
                    onClick={handleBack}
                    className="px-6 py-2 rounded-full border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-xs text-[var(--text-secondary)] hover:text-white font-bold transition-all"
                  >
                    {isAr ? '← العودة للخلف' : '← Back'}
                  </button>
                </motion.div>
              )}

              </div> {/* Close card container wrapper */}

              {/* Footer */}
              <footer className="mt-12 w-full">
                {/* Info links */}
                <div className="text-center mb-6">
                  <div className="flex justify-center gap-6 text-xs text-white/30">
                    <button onClick={() => setModalType('about')} className="hover:text-white transition-colors font-bold flex items-center gap-1">
                      📱 {isAr ? 'عن النظام' : 'About'}
                    </button>
                    <span>•</span>
                    <button onClick={() => setModalType('terms')} className="hover:text-white transition-colors font-bold flex items-center gap-1">
                      📋 {isAr ? 'الشروط والأحكام' : 'Terms'}
                    </button>
                    <span>•</span>
                    <button onClick={() => setModalType('instructions')} className="hover:text-white transition-colors font-bold flex items-center gap-1">
                      📖 {isAr ? 'تعليمات الاستخدام' : 'Instructions'}
                    </button>
                  </div>
                </div>

                {/* Developer signature */}
                <div className="text-center border-t border-white/5 pt-6">
                  <p className="text-[10px] text-white/20 font-black tracking-[0.25em] uppercase mb-2">
                    {isAr ? 'برمجة وتطوير' : 'Developed by'}
                  </p>
                  <a
                    href="https://github.com/mghalaosimi-web"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-black tracking-[0.25em] uppercase text-[var(--accent)] hover:text-white transition-colors inline-block"
                    style={{ textShadow: '0 0 10px var(--accent-glow)' }}
                  >
                    M.GH.AL
                  </a>
                  <div className="flex justify-center gap-3 mt-3">
                    <a href="https://wa.me/967776778675" target="_blank" rel="noopener noreferrer"
                      className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all animate-fade-in"
                      title="WhatsApp"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.449 5.4 0 9.793-4.393 9.797-9.799.002-2.618-1.01-5.08-2.858-6.932C16.36 2.022 13.9 1.01 11.3 1.01 5.9 1.01 1.5 5.4 1.5 10.8c0 1.5.4 3 1.2 4.4l-.9 3.4 3.4-.9v.054z"/></svg>
                    </a>
                    <a href="https://github.com/mghalaosimi-web" target="_blank" rel="noopener noreferrer"
                      className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 hover:bg-purple-500 hover:text-white transition-all"
                      title="GitHub"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                    </a>
                    <a href="https://www.facebook.com/share/17qDmKy45x/" target="_blank" rel="noopener noreferrer"
                      className="w-8 h-8 rounded-full bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-400 hover:bg-blue-600 hover:text-white transition-all">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    </a>
                    <a href="https://www.instagram.com/m.gh.al.2006?igsh=MTR3b3Y4ODN4bWNpcw==" target="_blank" rel="noopener noreferrer"
                      className="w-8 h-8 rounded-full bg-pink-600/10 border border-pink-600/20 flex items-center justify-center text-pink-400 hover:bg-pink-600 hover:text-white transition-all">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051C.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
                    </a>
                    <a href="https://t.me/mghalaosimi" target="_blank" rel="noopener noreferrer"
                      className="w-8 h-8 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 hover:bg-sky-500 hover:text-white transition-all">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm5.562 8.161c-.18.717-.962 4.084-1.362 5.477-.168.587-.367.876-.566.906-.438.066-.772-.259-1.196-.537-.665-.436-1.041-.707-1.687-1.132-.747-.492-.263-.762.163-1.204.111-.116 2.049-1.879 2.087-2.041.005-.02.01-.097-.036-.136-.046-.04-.112-.027-.161-.016-.07.016-1.187.755-3.342 2.21-.316.217-.602.324-.858.318-.282-.006-.826-.16-1.229-.291-.496-.162-.889-.249-.855-.527.017-.145.218-.294.602-.446 2.366-.99 3.942-1.644 4.729-1.963 2.249-.913 2.716-1.071 3.021-1.076.067-.001.218.016.315.096.082.067.105.158.114.223.009.066.012.203.003.312z"/></svg>
                    </a>
                    <a href="https://tiktok.com/@mghalaosimi" target="_blank" rel="noopener noreferrer"
                      className="w-8 h-8 rounded-full bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 hover:bg-pink-500 hover:text-white transition-all">
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.06-2.89-.58-4.09-1.42-.76-.53-1.39-1.25-1.85-2.07v7.41c.01 2.32-.82 4.67-2.52 6.27-1.83 1.74-4.57 2.45-7.01 1.84-2.58-.65-4.83-2.62-5.65-5.15-.99-3.05.35-6.72 3.12-8.29 1.55-.88 3.4-.97 5.09-.43v4.22c-1.2-.56-2.73-.32-3.64.66-.96 1.03-1.12 2.75-.38 3.9.72 1.13 2.13 1.72 3.44 1.46 1.34-.28 2.36-1.47 2.38-2.86V.02z"/></svg>
                    </a>
                  </div>
                </div>
              </footer>
            </div>

            {/* Footer Modals */}
            <AnimatePresence>
              {modalType && <InfoModal type={modalType} onClose={() => setModalType(null)} />}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
