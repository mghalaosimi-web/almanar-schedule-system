import React, { useState } from 'react';
import { motion } from 'framer-motion';
import logoImg from './assets/logo.png';

export default function Logo({ size = 'md', customLogoUrl = null }) {
  const [loaded, setLoaded] = useState(false);
  const logoSrc = customLogoUrl || logoImg;
  
  // Determine width and height classes based on size prop
  const dimensions = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-28 h-28',
    xl: 'w-36 h-36'
  }[size] || 'w-14 h-14';

  return (
    <motion.div 
      className={`relative shrink-0 ${dimensions} overflow-hidden rounded-[2rem] border border-white/20 bg-gradient-to-br from-white/10 to-black/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] flex items-center justify-center p-1.5`}
      initial={{ scale: 0.85, opacity: 0, rotateY: 12 }}
      animate={{ 
        scale: [0.85, 1.03, 1], 
        opacity: 1, 
        rotateY: 0,
        boxShadow: [
          "0 4px 10px rgba(0,0,0,0.4)",
          "0 8px 30px var(--accent-glow)",
          "0 8px 32px rgba(0,0,0,0.6)"
        ]
      }}
      whileHover={{ 
        scale: 1.06, 
        boxShadow: "0 12px 48px var(--accent-glow), inset 0 0 24px var(--accent-dim)",
        borderColor: "var(--accent)",
        rotateY: 5
      }}
      transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Deep glowing backdrop behind the logo */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--accent-dim)_0%,transparent_75%)] opacity-70 mix-blend-screen" />
      
      {/* Progressive loading shimmer */}
      {!loaded && (
        <div className="absolute inset-0 animate-shimmer bg-white/5" />
      )}
      
      <motion.div className="relative w-full h-full rounded-[1.5rem] overflow-hidden bg-black/50 border border-white/5 shadow-inner">
        <motion.img
          src={logoSrc}
          alt="Al-Manar University College Logo"
          onLoad={() => setLoaded(true)}
          className={`w-full h-full object-cover select-none ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-700`}
          whileHover={{ scale: 1.12 }}
          transition={{ duration: 0.4 }}
        />

        {/* Premium sweeping light ray overlay */}
        {loaded && (
          <motion.div
            className="absolute inset-0 pointer-events-none bg-gradient-to-r from-transparent via-white/50 to-transparent -skew-x-12"
            initial={{ left: '-150%' }}
            animate={{ left: '150%' }}
            transition={{
              duration: 2.2,
              ease: "easeInOut",
              repeat: Infinity,
              repeatDelay: 4.5
            }}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
