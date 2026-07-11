import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function DevSignature({ centered = true }) {
  const { i18n } = useTranslation();
  const isAr = i18n?.language === 'ar';
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Hidden developer login trigger
  const handleDevTrigger = () => {
    setIsOpen(false);
    navigate('/login?tab=FACULTY&dev=true');
  };

  const avatarClicks = useRef(0);
  const avatarTimer = useRef(null);

  const handleAvatarClick = () => {
    avatarClicks.current += 1;
    if (avatarTimer.current) clearTimeout(avatarTimer.current);
    avatarTimer.current = setTimeout(() => { avatarClicks.current = 0; }, 2000);
    if (avatarClicks.current >= 10) {
      avatarClicks.current = 0;
      handleDevTrigger();
    }
  };

  return (
    <>
      <motion.div
        className={`${centered ? 'text-center' : ''} py-1.5 flex items-center justify-center gap-1.5 flex-wrap cursor-pointer`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        onClick={() => setIsOpen(true)}
      >
        <span className="text-[10px] font-black tracking-[0.20em] uppercase text-gray-500">
          {isAr ? 'برمجة وتطوير ' : 'Developed by '}
        </span>
        <a
          href="https://github.com/mghalaosimi-web"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          <motion.span
            className={`relative inline-block text-[11px] md:text-[12px] font-black uppercase select-none text-[var(--accent)] font-extrabold cursor-pointer ${
              isHovered ? 'animate-text-glitch' : ''
            }`}
            style={{ 
              textShadow: '0 0 10px var(--accent-glow)',
              letterSpacing: '0.25em',
              transition: 'letter-spacing 0.25s ease-out'
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            whileHover={{ 
              scale: 1.08, 
              letterSpacing: '0.38em', 
              textShadow: '0 0 25px var(--accent)' 
            }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
          >
            M.GH.AL
          </motion.span>
        </a>
      </motion.div>

      {/* Premium Developer Details Modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 30 }}
              className="bg-white/5 border border-white/10 backdrop-blur-2xl p-8 rounded-3xl shadow-2xl w-full max-w-sm relative text-center"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 left-4 text-white/50 hover:text-white text-md font-bold bg-white/5 hover:bg-white/10 w-8 h-8 rounded-full flex items-center justify-center transition-all"
              >
                ✕
              </button>

              {/* Developer Avatar with Hidden Click Event */}
              <div 
                className="relative w-24 h-24 mx-auto mb-4 rounded-full border-2 border-[var(--accent)] p-1 cursor-pointer group"
                onClick={handleAvatarClick}
                title={isAr ? "انقر عشر مرات للدخول السري" : "Click ten times for developer mode"}
              >
                <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-dim)] opacity-25 blur-md group-hover:opacity-50 transition-opacity" />
                <img
                  src="https://github.com/mghalaosimi-web.png"
                  alt="Developer Avatar"
                  className="w-full h-full object-cover rounded-full bg-black relative z-10"
                  onError={(e) => {
                    e.target.src = "https://api.dicebear.com/7.x/bottts/svg?seed=mghalaosimi";
                  }}
                />
              </div>

              {/* Developer Info */}
              <h3 className="text-lg font-black text-white tracking-wide mb-1">
                م. محمد غالب العصيمي
              </h3>
              <p className="text-[10px] uppercase font-black tracking-widest text-[var(--accent)] mb-4">
                Full-Stack Software Engineer
              </p>

              {/* Short professional Arabic Bio */}
              <p className="text-xs text-white/80 leading-relaxed font-bold mb-6 text-justify px-2" dir="rtl">
                مهندس برمجيات ومطور كامل متميز (Full-Stack Engineer) متخصص في بناء الأنظمة السحابية وتطبيقات الويب المتقدمة والهندسة العكسية والأمن السيبراني. أسعى دائماً لتقديم حلول تقنية مبتكرة بجودة تليق بتطلعات المستخدمين.
              </p>

              {/* Social Media Links */}
              <div className="flex justify-center gap-4 items-center border-t border-white/10 pt-5 flex-wrap">
                {/* WhatsApp */}
                <a
                  href="https://wa.me/967776778675"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 transition-all duration-300"
                  title="WhatsApp"
                >
                  <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.449 5.4 0 9.793-4.393 9.797-9.799.002-2.618-1.01-5.08-2.858-6.932C16.36 2.022 13.9 1.01 11.3 1.01 5.9 1.01 1.5 5.4 1.5 10.8c0 1.5.4 3 1.2 4.4l-.9 3.4 3.4-.9v.054z"/>
                  </svg>
                </a>

                {/* GitHub */}
                <a
                  href="https://github.com/mghalaosimi-web"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 hover:bg-purple-500 hover:text-white transition-all duration-300"
                  title="GitHub"
                >
                  <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </a>

                {/* Facebook */}
                <a
                  href="https://www.facebook.com/share/17qDmKy45x/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-400 hover:bg-blue-600 hover:text-white transition-all duration-300"
                  title="Facebook"
                >
                  <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>

                {/* Instagram */}
                <a
                  href="https://www.instagram.com/m.gh.al.2006?igsh=MTR3b3Y4ODN4bWNpcw=="
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-pink-600/10 border border-pink-600/20 flex items-center justify-center text-pink-400 hover:bg-pink-600 hover:text-white transition-all duration-300"
                  title="Instagram"
                >
                  <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051C.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
                  </svg>
                </a>

                {/* Telegram */}
                <a
                  href="https://t.me/mghalaosimi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 hover:bg-sky-500 hover:text-slate-950 transition-all duration-300"
                  title="Telegram"
                >
                  <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 24 24">
                    <path d="M12 0c-6.627 0-12 5.373-12 12s5.373 12 12 12 12-5.373 12-12-5.373-12-12-12zm5.562 8.161c-.18.717-.962 4.084-1.362 5.477-.168.587-.367.876-.566.906-.438.066-.772-.259-1.196-.537-.665-.436-1.041-.707-1.687-1.132-.747-.492-.263-.762.163-1.204.111-.116 2.049-1.879 2.087-2.041.005-.02.01-.097-.036-.136-.046-.04-.112-.027-.161-.016-.07.016-1.187.755-3.342 2.21-.316.217-.602.324-.858.318-.282-.006-.826-.16-1.229-.291-.496-.162-.889-.249-.855-.527.017-.145.218-.294.602-.446 2.366-.99 3.942-1.644 4.729-1.963 2.249-.913 2.716-1.071 3.021-1.076.067-.001.218.016.315.096.082.067.105.158.114.223.009.066.012.203.003.312z"/>
                  </svg>
                </a>

                {/* TikTok */}
                <a
                  href="https://tiktok.com/@mghalaosimi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 hover:bg-pink-500 hover:text-slate-950 transition-all duration-300"
                  title="TikTok"
                >
                  <svg className="w-4.5 h-4.5 fill-current" viewBox="0 0 24 24">
                    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.06-2.89-.58-4.09-1.42-.76-.53-1.39-1.25-1.85-2.07v7.41c.01 2.32-.82 4.67-2.52 6.27-1.83 1.74-4.57 2.45-7.01 1.84-2.58-.65-4.83-2.62-5.65-5.15-.99-3.05.35-6.72 3.12-8.29 1.55-.88 3.4-.97 5.09-.43v4.22c-1.2-.56-2.73-.32-3.64.66-.96 1.03-1.12 2.75-.38 3.9.72 1.13 2.13 1.72 3.44 1.46 1.34-.28 2.36-1.47 2.38-2.86V.02z"/>
                  </svg>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
