/**
 * @file AlertsTab.jsx
 * @description مركز الإشعارات والتنبيهات — HCI Phase 2 Overhaul
 * @author أنتيجرافيتي (Antigravity)
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AlertsTab({ isAr, allAlerts }) {
  const [alertFilter, setAlertFilter] = useState('All');

  const filteredAlerts = allAlerts.filter(alert => {
    if (alertFilter === 'Urgent') return alert.type === 'Urgent';
    if (alertFilter === 'Academic') {
      const msg = (alert.message || '').toLowerCase();
      return (
        alert.type === 'Academic' ||
        msg.includes('exam') || msg.includes('lecture') || msg.includes('reschedule') ||
        msg.includes('اختبار') || msg.includes('محاضرة') || msg.includes('تعديل')
      );
    }
    return true;
  });

  const filters = [
    { id: 'All', ar: 'الكل', en: 'All', icon: '📋' },
    { id: 'Urgent', ar: 'عاجل', en: 'Urgent', icon: '🚨' },
    { id: 'Academic', ar: 'أكاديمي', en: 'Academic', icon: '📚' }
  ];

  const getAlertStyle = (alert) => {
    if (alert.type === 'Urgent') return {
      borderColor: 'rgba(239,68,68,0.25)',
      background: 'rgba(239,68,68,0.04)',
      accentColor: '#f87171',
      badge: isAr ? 'عاجل' : 'Urgent',
      icon: '🚨',
      badgeStyle: { background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }
    };
    if (alert.type === 'Success') return {
      borderColor: 'rgba(16,185,129,0.25)',
      background: 'rgba(16,185,129,0.04)',
      accentColor: '#34d399',
      badge: isAr ? 'نجاح' : 'Success',
      icon: '✅',
      badgeStyle: { background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', color: '#34d399' }
    };
    return {
      borderColor: 'rgba(255,255,255,0.06)',
      background: 'rgba(255,255,255,0.02)',
      accentColor: '#60a5fa',
      badge: isAr ? 'تحديث' : 'Update',
      icon: '📢',
      badgeStyle: { background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', color: '#60a5fa' }
    };
  };

  const formatTime = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleTimeString(isAr ? 'ar-SA' : 'en-US', { hour: '2-digit', minute: '2-digit' });
    } catch { return '--:--'; }
  };

  const formatDate = (dateStr) => {
    try {
      return new Date(dateStr).toLocaleDateString(isAr ? 'ar-SA' : 'en-US', { month: 'short', day: 'numeric' });
    } catch { return ''; }
  };

  return (
    <div className="space-y-4" dir={isAr ? 'rtl' : 'ltr'}>

      {/* ── عداد الإشعارات ── */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h3 className="section-title">{isAr ? 'مركز الإشعارات' : 'Notification Center'}</h3>
          <p className="section-subtitle mt-0.5">
            {filteredAlerts.length} {isAr ? 'إشعار' : 'alerts'}
            {allAlerts.filter(a => a.type === 'Urgent').length > 0 && (
              <span className="chip chip-red ms-2">
                {allAlerts.filter(a => a.type === 'Urgent').length} {isAr ? 'عاجل' : 'urgent'}
              </span>
            )}
          </p>
        </div>
        {allAlerts.filter(a => a.type === 'Urgent').length > 0 && (
          <div className="live-badge">
            <span className="live-dot" />
            {isAr ? 'تنبيه نشط' : 'Active'}
          </div>
        )}
      </div>

      {/* ── شريط الفلاتر (Pills) ── */}
      <div
        className="flex gap-1.5 p-1 rounded-[16px]"
        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
        role="tablist"
        aria-label={isAr ? 'تصفية الإشعارات' : 'Filter alerts'}
      >
        {filters.map(f => {
          const active = alertFilter === f.id;
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={active}
              onClick={() => setAlertFilter(f.id)}
              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-[12px] text-[10px] font-black transition-all"
              style={{
                background: active ? 'rgba(var(--primary-color-rgb,245,158,11),0.15)' : 'transparent',
                border: `1px solid ${active ? 'rgba(var(--primary-color-rgb,245,158,11),0.3)' : 'transparent'}`,
                color: active ? 'var(--accent)' : 'var(--text-muted)'
              }}
            >
              <span style={{ fontSize: '12px' }}>{f.icon}</span>
              <span>{isAr ? f.ar : f.en}</span>
            </button>
          );
        })}
      </div>

      {/* ── قائمة الإشعارات ── */}
      <AnimatePresence mode="popLayout">
        {filteredAlerts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="card-subtle p-10 text-center space-y-2"
          >
            <span style={{ fontSize: '32px' }}>🔔</span>
            <p className="text-[12px] font-black" style={{ color: 'var(--text-secondary)' }}>
              {isAr ? 'لا توجد إشعارات في هذا القسم' : 'No alerts in this section'}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-2.5">
            {filteredAlerts.map((alert, idx) => {
              const style = getAlertStyle(alert);
              return (
                <motion.div
                  key={alert.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ delay: idx * 0.04, duration: 0.2 }}
                  className="rounded-[18px] overflow-hidden"
                  style={{
                    background: style.background,
                    border: `1px solid ${style.borderColor}`,
                    borderInlineStart: `3px solid ${style.accentColor}`
                  }}
                >
                  <div className="p-4 space-y-2.5">
                    {/* رأس الإشعار */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: '16px' }}>{style.icon}</span>
                        <span
                          className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={style.badgeStyle}
                        >
                          {style.badge}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0" style={{ color: 'var(--text-muted)' }}>
                        <span className="text-[9px] font-mono font-bold">{formatDate(alert.sentTime)}</span>
                        <span className="text-[9px] font-mono font-bold">{formatTime(alert.sentTime)}</span>
                      </div>
                    </div>

                    {/* نص الإشعار */}
                    <p
                      className="text-[12px] leading-relaxed font-semibold"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {alert.message}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
