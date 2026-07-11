/**
 * @file AlertsTab.jsx
 * @description مركز الإشعارات والتنبيهات (Notification Center) في بوابة الطالب.
 * يعرض التعميمات الجامعية والتنبيهات الإدارية والعاجلة مع إمكانية التصفية الموضوعية.
 * @author أنتيجرافيتي (Antigravity)
 */

import React, { useState } from 'react';

/**
 * مكون مركز الإشعارات للطلاب.
 * 
 * الميزات:
 * 1. تصفية الإشعارات حسب الدرجة: الكل (All)، عاجل وهام (Urgent)، أكاديمي ودراسي (Academic).
 * 2. فرز تلقائي وتنسيق بصري متباين للبطاقات بناءً على الأولوية (خطوط حمراء للتعميمات العاجلة، خضراء للنجاح، زرقاء للمعلومات).
 * 3. تنسيق التوقيت والساعة والتواريخ بشكل مقروء.
 * 4. واجهة خفيفة ذات حركات انتقالية ناعمة.
 * 
 * @param {Object} props - خصائص المكون.
 * @param {boolean} props.isAr - لغة الواجهة (عربي/إنجليزي).
 * @param {Array<Object>} props.allAlerts - المصفوفة الكاملة لجميع الإشعارات المجلوبة من الشبكة.
 */
export default function AlertsTab({
  isAr,
  allAlerts
}) {
  // ── الحالات المحلية للتصفية ──
  const [alertFilter, setAlertFilter] = useState('All');

  // تصفية الإشعارات محلياً لتقليل العبء على لوحة التحكم الرئيسية
  const filteredAlerts = allAlerts.filter(alert => {
    if (alertFilter === 'Urgent') {
      return alert.type === 'Urgent';
    }
    if (alertFilter === 'Academic') {
      const msg = (alert.message || '').toLowerCase();
      return (
        alert.type === 'Academic' || 
        msg.includes('exam') || 
        msg.includes('lecture') || 
        msg.includes('reschedule') ||
        msg.includes('اختبار') || 
        msg.includes('محاضرة') || 
        msg.includes('تعديل')
      );
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* ── أزرار التصفية الموضوعية ── */}
      <div className="flex gap-2 border-b border-slate-850 pb-3">
        {['All', 'Urgent', 'Academic'].map(filter => {
          const active = alertFilter === filter;
          const labels = { 
            All: isAr ? 'الكل' : 'All', 
            Urgent: isAr ? 'هام وعاجل 🚨' : 'Urgent 🚨', 
            Academic: isAr ? 'أكاديمي ودراسي 📚' : 'Academic 📚' 
          };
          return (
            <button
              key={filter}
              onClick={() => setAlertFilter(filter)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 border ${
                active
                  ? 'bg-slate-800 text-white border-slate-700 shadow-md scale-105'
                  : 'bg-white/5 border-transparent text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {labels[filter]}
            </button>
          );
        })}
      </div>

      {/* ── قائمة بطاقات الإشعارات ── */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-10 text-center text-slate-600 text-xs font-bold">
            🔔 {isAr ? 'لا توجد تنبيهات نشطة حالياً في هذا القسم.' : 'No active alerts at the moment.'}
          </div>
        ) : (
          filteredAlerts.map(alert => {
            let borderStyle = "border-slate-850 bg-slate-900/20";
            let badge = isAr ? 'تحديث' : 'Update';
            let badgeColor = "bg-blue-500/10 border-blue-500/25 text-blue-400";
            let icon = "📢";

            if (alert.type === 'Urgent') {
              borderStyle = "border-red-500/20 bg-red-950/5 hover:border-red-500/30";
              badge = isAr ? 'عاجل' : 'Urgent';
              badgeColor = "bg-red-500/10 border-red-500/25 text-red-400";
              icon = "🚨";
            } else if (alert.type === 'Success') {
              borderStyle = "border-emerald-500/20 bg-emerald-950/5 hover:border-emerald-500/30";
              badge = isAr ? 'نجاح' : 'Success';
              badgeColor = "bg-emerald-500/10 border-emerald-500/25 text-emerald-400";
              icon = "✅";
            }

            return (
              <div
                key={alert.id}
                className={`p-4 rounded-2xl border flex flex-col gap-3 transition-all duration-200 hover:-translate-x-1 hover:border-slate-750 ${borderStyle}`}
              >
                <div className="flex justify-between items-center text-[9px] font-black uppercase">
                  <span className={`px-2.5 py-0.5 rounded border tracking-widest ${badgeColor}`}>
                    {icon} {badge}
                  </span>
                  <span className="text-slate-500 font-mono">
                    {new Date(alert.sentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <p className="text-xs leading-relaxed font-bold text-slate-200">
                  {alert.message}
                </p>

                <div className="text-right">
                  <span className="text-[8px] font-mono font-bold text-slate-500">
                    {new Date(alert.sentTime).toLocaleDateString()}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
