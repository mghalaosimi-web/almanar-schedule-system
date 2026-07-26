/**
 * @file BroadcastTab.jsx
 * @description تبويب مركز البث (Broadcast) في لوحة تحكم المشرف. يتيح صياغة ونشر التنبيهات الموجهة فورياً لهواتف الطلاب.
 * @author أنتيجرافيتي (Antigravity)
 *
 * Fix 5: Added audience preview panel — shows group name, major, and student count before
 * sending. Added confirmation checkbox to prevent accidental broadcasts.
 */

import React, { useState } from 'react';

/**
 * مكون إرسال الإعلانات والتعميمات الأكاديمية والطارئة.
 * 
 * الميزات:
 * 1. تحديد شريحة الطلاب المستهدفة (كل الشعب أو شعبة محددة).
 * 2. تعيين مستوى الأولوية للإشعار (عادي 📢 أو عاجل وطارئ 🚨).
 * 3. حقل إدخال الرسالة مع مؤشر لسرعة الإرسال.
 * 4. [Fix 5] معاينة الجمهور المستهدف قبل الإرسال مع عداد الطلاب ومربع تأكيد.
 * 5. تكامل كامل مع قنوات الـ Push Notifications والـ SSE في الخلفية.
 * 
 * @param {Object} props - خصائص المكون.
 * @param {boolean} props.isAr - لغة واجهة المكون.
 * @param {Array<Object>} props.groups - قائمة الشُعب المتوفرة لتحديد المستهدفين.
 * @param {Array<Object>} props.students - قائمة الطلاب لحساب أعداد المجموعات (اختياري).
 * @param {string} props.broadcastTarget - المجموعة المستهدفة المحددة حالياً (ALL أو معرف الشعبة).
 * @param {Function} props.setBroadcastTarget - دالة تغيير المجموعة المستهدفة.
 * @param {string} props.broadcastMessage - نص رسالة التعميم المكتوبة.
 * @param {Function} props.setBroadcastMessage - دالة تحديث نص الرسالة.
 * @param {string} props.broadcastPriority - أولوية البث ('normal' أو 'urgent').
 * @param {Function} props.setBroadcastPriority - دالة تغيير الأولوية.
 * @param {boolean} props.broadcastLoading - حالة إرسال وبث الإعلان الحالية.
 * @param {Function} props.handleSendBroadcast - دالة معالجة ونشر البث الفعلي.
 * @param {number} props.totalStudents - إجمالي عدد الطلاب في الكلية (لعرض عند اختيار ALL).
 */
export default function BroadcastTab({
  isAr,
  groups,
  students,
  broadcastTarget,
  setBroadcastTarget,
  broadcastMessage,
  setBroadcastMessage,
  broadcastPriority,
  setBroadcastPriority,
  broadcastLoading,
  handleSendBroadcast,
  totalStudents,
}) {
  // Fix 5: Confirmation checkbox state — must be checked before send is allowed
  const [confirmed, setConfirmed] = useState(false);

  // Reset confirmation whenever target or message changes (prevents stale approvals)
  const handleTargetChange = (e) => {
    setBroadcastTarget(e.target.value);
    setConfirmed(false);
  };

  const handleMessageChange = (e) => {
    setBroadcastMessage(e.target.value);
    setConfirmed(false);
  };

  // Derive audience preview from groups data (no extra API call)
  const getAudiencePreview = () => {
    if (broadcastTarget === 'ALL') {
      const count = totalStudents ?? students?.length ?? '—';
      return {
        icon: '📢',
        label: isAr ? 'جميع طلاب الكلية' : 'All College Students',
        sub: isAr ? `${count} طالب مستهدف` : `${count} students targeted`,
        color: 'cyan',
      };
    }
    const group = groups.find(g => String(g.id) === String(broadcastTarget));
    if (!group) return null;

    // Count students in this group if student list is available
    const groupStudentCount = students
      ? students.filter(s => String(s.groupId ?? s.group?.id) === String(group.id)).length
      : null;

    return {
      icon: '👥',
      label: `${isAr ? 'شعبة' : 'Group'} ${group.name}`,
      sub: [
        group.major?.name ? `${isAr ? 'تخصص:' : 'Major:'} ${group.major.name}` : null,
        groupStudentCount !== null
          ? `${groupStudentCount} ${isAr ? 'طالب' : 'students'}`
          : null,
      ].filter(Boolean).join(' · '),
      color: 'violet',
    };
  };

  const audience = getAudiencePreview();
  const canSend = !broadcastLoading && broadcastMessage.trim() && confirmed;

  return (
    <div className="max-w-2xl mx-auto bg-slate-955 border border-slate-800 rounded-3xl p-6 shadow-xl text-start relative overflow-hidden">
      {/* Glow ambient background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="border-b border-slate-800/85 pb-4 mb-6">
        <h3 className="text-sm font-black text-white">{isAr ? 'مركز البث والتعميمات الأكاديمية' : 'Academic Broadcast & Notification Center'}</h3>
        <p className="text-[10px] text-slate-500 font-bold mt-1">
          {isAr
            ? 'أرسل تعميماً موحداً فورياً عبر الإشعارات وهواتف الطلاب في الوقت الحقيقي.'
            : 'Deploy real-time push and SSE announcements to specific student groups.'}
        </p>
      </div>

      <form onSubmit={handleSendBroadcast} className="space-y-5 relative z-10">
        {/* اختيار المستهدفين بالبث */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
            🎯 {isAr ? 'شريحة الطلاب المستهدفة' : 'Target Student Audience'}
          </label>
          <select
            value={broadcastTarget}
            onChange={handleTargetChange}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors"
          >
            <option value="ALL">{isAr ? '📢 إرسال لجميع طلاب الكلية (عام)' : '📢 Broadcast to All Students'}</option>
            {groups.map(g => (
              <option key={g.id} value={String(g.id)}>👥 {isAr ? `شعبة ${g.name} - ${g.major?.name || ''}` : `Group ${g.name} - ${g.major?.name || ''}`}</option>
            ))}
          </select>
        </div>

        {/* Fix 5: Audience Preview Panel */}
        {audience && (
          <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
            audience.color === 'cyan'
              ? 'bg-cyan-500/5 border-cyan-500/20'
              : 'bg-violet-500/5 border-violet-500/20'
          }`}>
            <span className="text-xl shrink-0">{audience.icon}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-black truncate ${
                audience.color === 'cyan' ? 'text-cyan-300' : 'text-violet-300'
              }`}>
                {audience.label}
              </p>
              {audience.sub && (
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">{audience.sub}</p>
              )}
            </div>
            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${
              audience.color === 'cyan'
                ? 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
                : 'text-violet-400 border-violet-500/30 bg-violet-500/10'
            }`}>
              {isAr ? 'مستهدف' : 'Targeted'}
            </span>
          </div>
        )}

        {/* تحديد درجة الأولوية */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
            ⚡ {isAr ? 'مستوى الأهمية والأولوية' : 'Priority Level'}
          </label>
          <div className="flex gap-4">
            {[
              { id: 'normal', label: isAr ? 'إعلان عادي (📢)' : 'Normal Announcement', desc: isAr ? 'يظهر في مركز الإشعارات كحدث أكاديمي.' : 'Standard academic alert.' },
              { id: 'urgent', label: isAr ? 'تنبيه طارئ وعاجل (🚨)' : 'Urgent Alert', desc: isAr ? 'يسبق النص بـ [عاجل] وينبه بأهمية قصوى.' : 'Prepends [Urgent] with high importance.' }
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => setBroadcastPriority(p.id)}
                className={`flex-1 p-3.5 rounded-xl border text-start transition-all ${
                  broadcastPriority === p.id
                    ? p.id === 'urgent'
                      ? 'bg-red-500/5 border-red-500/40 text-red-400 shadow-md'
                      : 'bg-cyan-500/5 border-cyan-500/40 text-cyan-400 shadow-md'
                    : 'bg-slate-900 border-slate-850 text-slate-400 hover:bg-slate-850'
                }`}
              >
                <span className="block text-xs font-black">{p.label}</span>
                <span className="block text-[9px] text-slate-500 mt-1 font-bold">{p.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* محتوى الرسالة */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
            ✍️ {isAr ? 'نص التعميم الأكاديمي' : 'Announcement Message'}
          </label>
          <textarea
            required
            rows={4}
            maxLength={250}
            value={broadcastMessage}
            onChange={handleMessageChange}
            placeholder={isAr
              ? 'اكتب نص التعميم هنا بشكل واضح ومحدد (مثال: تنويه، تم نقل محاضرة الغد إلى القاعة ٢)...'
              : 'Compose your announcement clearly and concisely...'}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-cyan-500 transition-colors leading-relaxed resize-none"
          />
          <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold px-1">
            <span>{isAr ? 'الحد الأقصى: ٢٥٠ حرفاً' : 'Max capacity: 250 characters'}</span>
            <span className={broadcastMessage.length > 230 ? 'text-amber-400' : ''}>{broadcastMessage.length}/250</span>
          </div>
        </div>

        {/* Fix 5: Confirmation Checkbox — must be checked before send is allowed */}
        {broadcastMessage.trim() && (
          <label className={`flex items-start gap-3 cursor-pointer rounded-xl border p-3.5 transition-all ${
            confirmed
              ? 'bg-green-500/5 border-green-500/30'
              : 'bg-white/2 border-white/10 hover:border-white/20'
          }`}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={e => setConfirmed(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded accent-green-500 cursor-pointer shrink-0"
            />
            <span className={`text-[10px] font-bold leading-relaxed ${confirmed ? 'text-green-400' : 'text-slate-400'}`}>
              {isAr
                ? `✅ أؤكد أن هذا التعميم جاهز للنشر وموجه لـ "${audience?.label || ''}". لا يمكن التراجع بعد الإرسال.`
                : `✅ I confirm this announcement is ready to broadcast to "${audience?.label || ''}". This action cannot be undone.`}
            </span>
          </label>
        )}

        {/* زر النشر والإرسال */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={!canSend}
            title={!confirmed && broadcastMessage.trim() ? (isAr ? 'يرجى تأكيد الإرسال أولاً' : 'Please confirm before sending') : ''}
            className={`w-full py-4 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 ${
              broadcastPriority === 'urgent'
                ? 'bg-red-500 text-white hover:shadow-[0_0_20px_rgba(239,68,68,0.35)]'
                : 'bg-cyan-500 text-slate-950 hover:shadow-[0_0_20px_var(--accent-glow)]'
            } disabled:opacity-45 disabled:cursor-not-allowed`}
          >
            {broadcastLoading ? (
              <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>{isAr ? 'نشر وإرسال التعميم الفوري' : 'Dispatch Live Broadcast Announcement'}</span>
                <span>⚡</span>
              </>
            )}
          </button>
          {/* Helper text when not confirmed */}
          {broadcastMessage.trim() && !confirmed && (
            <p className="text-center text-[9px] text-amber-400/70 font-bold mt-2">
              {isAr ? '⚠️ يرجى تأكيد الإرسال بمربع الاختيار أعلاه أولاً' : '⚠️ Check the confirmation box above to enable sending'}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
