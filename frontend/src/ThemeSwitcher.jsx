import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const THEMES = [
  {
    id: 'default',
    class: '',
    nameEn: 'Neon Lime',
    nameAr: 'الليموني النيون',
    color: '#deff9a'
  },
  {
    id: 'purple',
    class: 'theme-purple',
    nameEn: 'Royal Amethyst',
    nameAr: 'الجمشت الملكي',
    color: '#a855f7'
  },
  {
    id: 'blue',
    class: 'theme-blue',
    nameEn: 'Oceanic Sapphire',
    nameAr: 'الياقوت الأزرق',
    color: '#3b82f6'
  },
  {
    id: 'amber',
    class: 'theme-amber',
    nameEn: 'Amber Glow',
    nameAr: 'الوهج الكهرماني',
    color: '#f59e0b'
  },
  {
    id: 'custom',
    class: 'theme-custom',
    nameEn: 'Custom Accent',
    nameAr: 'لون مخصص 🎨',
    color: '#10b981' // This color is dynamically modified below
  }
];

function hexToRgb(hex) {
  hex = hex.replace(/^#/, '');
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  const num = parseInt(hex, 16);
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

export default function ThemeSwitcher() {
  const [isOpen, setIsOpen] = useState(false);
  
  // Theme Color selection state
  const [activeTheme, setActiveTheme] = useState(() => {
    const val = localStorage.getItem('manar_theme_color');
    if (val) return val;
    // Migration fallback
    const oldVal = localStorage.getItem('manar_theme');
    if (oldVal && ['default', 'purple', 'blue', 'amber', 'custom'].includes(oldVal)) {
      return oldVal;
    }
    return 'default';
  });
  
  // Theme modes: 'dark' | 'light' | 'system'
  const [themeMode, setThemeMode] = useState(() => {
    return localStorage.getItem('manar_theme_mode') || 'dark';
  });

  // Typography font state
  const [activeFont, setActiveFont] = useState(() => {
    return localStorage.getItem('manar_user_font') || 'Urbanist';
  });

  const isRtl = document.documentElement.dir === 'rtl';

  // Apply theme color class & custom Hex accent color
  useEffect(() => {
    const htmlEl = document.documentElement;
    THEMES.forEach(t => {
      if (t.class) {
        htmlEl.classList.remove(t.class);
      }
    });

    const selected = THEMES.find(t => t.id === activeTheme);
    if (selected && selected.class) {
      htmlEl.classList.add(selected.class);
    }
    localStorage.setItem('manar_theme_color', activeTheme);

    // Apply exact Hex custom color properties if 'custom' is active
    if (activeTheme === 'custom') {
      const customHex = localStorage.getItem('manar_custom_accent') || '#10b981';
      const rgb = hexToRgb(customHex);
      htmlEl.style.setProperty('--accent', customHex);
      htmlEl.style.setProperty('--accent-dim', `rgba(${rgb}, 0.12)`);
      htmlEl.style.setProperty('--accent-glow', `rgba(${rgb}, 0.25)`);
      htmlEl.style.setProperty('--primary-color-rgb', rgb);
      htmlEl.style.setProperty('--primary-hover-rgb', rgb);
      htmlEl.style.setProperty('--glow-lime', `rgba(${rgb}, 0.10)`);
    } else {
      // Clear custom properties to let static theme classes rule
      htmlEl.style.removeProperty('--accent');
      htmlEl.style.removeProperty('--accent-dim');
      htmlEl.style.removeProperty('--accent-glow');
      htmlEl.style.removeProperty('--primary-color-rgb');
      htmlEl.style.removeProperty('--primary-hover-rgb');
      htmlEl.style.removeProperty('--glow-lime');
    }

    // Trigger sync events
    window.dispatchEvent(new Event('themeColorChanged'));
  }, [activeTheme]);

  // Apply dark/light/system theme mode
  useEffect(() => {
    const htmlEl = document.documentElement;
    localStorage.setItem('manar_theme_mode', themeMode);

    const applyMode = (mode) => {
      if (mode === 'light') {
        htmlEl.classList.add('light');
        htmlEl.classList.remove('dark');
      } else if (mode === 'dark') {
        htmlEl.classList.remove('light');
        htmlEl.classList.add('dark');
      }
    };

    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemChange = (e) => {
        applyMode(e.matches ? 'dark' : 'light');
      };
      applyMode(mediaQuery.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', handleSystemChange);
      return () => mediaQuery.removeEventListener('change', handleSystemChange);
    } else {
      applyMode(themeMode);
    }

    window.dispatchEvent(new Event('themeModeChanged'));
  }, [themeMode]);

  // Apply font family properties globally
  useEffect(() => {
    const htmlEl = document.documentElement;
    localStorage.setItem('manar_user_font', activeFont);
    const fontMapping = {
      'Urbanist': "'Urbanist', sans-serif",
      'Cairo': "'Cairo', sans-serif",
      'Inter': "'Inter', sans-serif",
      'Outfit': "'Outfit', sans-serif"
    };
    htmlEl.style.setProperty('--font-family', fontMapping[activeFont] || "'Urbanist', sans-serif");
    window.dispatchEvent(new Event('themeFontChanged'));
  }, [activeFont]);

  // Listen to external changes (like Custom Color selection in UserSettings.jsx)
  useEffect(() => {
    const handleExternalColorChange = () => {
      const current = localStorage.getItem('manar_theme_color') || 'default';
      if (current !== activeTheme) setActiveTheme(current);
    };
    const handleExternalFontChange = () => {
      const current = localStorage.getItem('manar_user_font') || 'Urbanist';
      if (current !== activeFont) setActiveFont(current);
    };
    const handleExternalModeChange = () => {
      const current = localStorage.getItem('manar_theme_mode') || 'dark';
      if (current !== themeMode) setThemeMode(current);
    };

    window.addEventListener('themeColorChanged', handleExternalColorChange);
    window.addEventListener('themeFontChanged', handleExternalFontChange);
    window.addEventListener('themeModeChanged', handleExternalModeChange);

    return () => {
      window.removeEventListener('themeColorChanged', handleExternalColorChange);
      window.removeEventListener('themeFontChanged', handleExternalFontChange);
      window.removeEventListener('themeModeChanged', handleExternalModeChange);
    };
  }, [activeTheme, activeFont, themeMode]);

  const cycleMode = () => {
    setThemeMode(prev => {
      if (prev === 'dark') return 'light';
      if (prev === 'light') return 'system';
      return 'dark';
    });
  };

  const getModeLabel = () => {
    if (themeMode === 'light') return isRtl ? '☀️ النهار' : '☀️ Day';
    if (themeMode === 'dark') return isRtl ? '🌙 الليل' : '🌙 Night';
    return isRtl ? '💻 تلقائي' : '💻 System';
  };

  const currentTheme = THEMES.find(t => t.id === activeTheme) || THEMES[0];
  const customAccentColor = localStorage.getItem('manar_custom_accent') || '#10b981';
  const displayThemeColor = activeTheme === 'custom' ? customAccentColor : currentTheme.color;

  return (
    <div className="relative z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-bold text-gray-300 transition-all duration-200"
        title="Change Theme & Appearance"
      >
        <span className="w-3.5 h-3.5 rounded-full ring-2 ring-white/20" style={{ backgroundColor: displayThemeColor }} />
        <span>{themeMode === 'light' ? '☀️' : themeMode === 'dark' ? '🌙' : '💻'}</span>
        <span className="hidden sm:inline">
          {activeTheme === 'custom'
            ? (isRtl ? 'لون مخصص' : 'Custom Color')
            : (isRtl ? currentTheme.nameAr : currentTheme.nameEn)}
        </span>
        <span className="text-[10px] opacity-60">▼</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
            
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className={`absolute mt-2 w-56 bg-gray-950 border border-white/10 rounded-2xl p-2.5 shadow-2xl z-50 ${
                isRtl ? 'left-0' : 'right-0'
              }`}
            >
              <div className="px-3 py-1.5 border-b border-white/5 mb-1.5 text-[9px] font-black tracking-widest text-gray-500 uppercase text-right">
                {isRtl ? 'مظهر الألوان' : 'Color Theme'}
              </div>
              
              <div className="space-y-1">
                {THEMES.map(theme => {
                  const isSelected = theme.id === activeTheme;
                  const btnColor = theme.id === 'custom' ? customAccentColor : theme.color;
                  return (
                    <div key={theme.id} className="relative flex items-center w-full">
                      <button
                        onClick={() => {
                          setActiveTheme(theme.id);
                          if (theme.id !== 'custom') {
                            setIsOpen(false);
                          }
                        }}
                        style={isSelected ? {
                          backgroundColor: 'var(--accent-dim)',
                          color: 'var(--accent)',
                          borderColor: 'var(--accent-glow)',
                          flexGrow: 1
                        } : { flexGrow: 1 }}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all duration-200 border ${
                          isSelected 
                            ? '' 
                            : 'text-gray-400 hover:bg-white/5 hover:text-white border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-3.5 h-3.5 rounded-full ring-2 ring-white/10" style={{ backgroundColor: btnColor }} />
                          <span>{isRtl ? theme.nameAr : theme.nameEn}</span>
                        </div>
                        {isSelected && theme.id !== 'custom' && <span style={{ color: 'var(--accent)' }}>✓</span>}
                      </button>
                      
                      {theme.id === 'custom' && isSelected && (
                        <div className={`absolute ${isRtl ? 'left-3' : 'right-3'} flex items-center z-10`}>
                          <input
                            type="color"
                            value={customAccentColor}
                            onChange={(e) => {
                              const hex = e.target.value;
                              localStorage.setItem('manar_custom_accent', hex);
                              localStorage.setItem('manar_theme_color', 'custom');
                              setActiveTheme('custom');
                              
                              const htmlEl = document.documentElement;
                              const rgb = hexToRgb(hex);
                              htmlEl.style.setProperty('--accent', hex);
                              htmlEl.style.setProperty('--accent-dim', `rgba(${rgb}, 0.12)`);
                              htmlEl.style.setProperty('--accent-glow', `rgba(${rgb}, 0.25)`);
                              htmlEl.style.setProperty('--primary-color-rgb', rgb);
                              htmlEl.style.setProperty('--primary-hover-rgb', rgb);
                              htmlEl.style.setProperty('--glow-lime', `rgba(${rgb}, 0.10)`);
                              window.dispatchEvent(new Event('themeColorChanged'));
                            }}
                            className="w-5 h-5 p-0 border-0 bg-transparent rounded cursor-pointer shrink-0"
                            title={isRtl ? 'اختر لونك المفضل' : 'Choose custom color'}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Day/Night Mode Switcher section */}
              <div className="border-t border-white/5 mt-2.5 pt-2.5 flex items-center justify-between px-3 text-xs">
                <span className="text-[10px] font-bold text-gray-500 uppercase">
                  {isRtl ? 'وضع المظهر' : 'Appearance'}
                </span>
                <button
                  type="button"
                  onClick={cycleMode}
                  className="flex items-center gap-1.5 px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 font-bold text-[10px] text-gray-300 transition-all duration-200"
                >
                  {getModeLabel()}
                </button>
              </div>

              {/* Font Customization Selector section */}
              <div className="border-t border-white/5 mt-2.5 pt-2.5 flex items-center justify-between px-3 text-xs">
                <span className="text-[10px] font-bold text-gray-500 uppercase">
                  {isRtl ? 'خط الواجهة' : 'Interface Font'}
                </span>
                <select
                  value={activeFont}
                  onChange={(e) => setActiveFont(e.target.value)}
                  className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] font-bold text-[10px] p-1.5 focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="Urbanist" className="bg-[var(--bg-card)] text-[var(--text-primary)]">Urbanist</option>
                  <option value="Cairo" className="bg-[var(--bg-card)] text-[var(--text-primary)]">Cairo (عربي)</option>
                  <option value="Inter" className="bg-[var(--bg-card)] text-[var(--text-primary)]">Inter</option>
                  <option value="Outfit" className="bg-[var(--bg-card)] text-[var(--text-primary)]">Outfit</option>
                </select>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
