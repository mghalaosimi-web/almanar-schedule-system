import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { API_URL } from './config';
import { SessionService } from './utils/sessionService';
import { PERMISSIONS, hasPermission } from './utils/permissionRegistry';
import { AUDIENCE_TYPES, resolveAudience } from './utils/audienceRegistry';

export default function BroadcastCenter() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const [broadcastType, setBroadcastType] = useState('GROUP'); // 'GROUP' or 'MAJOR'
  const [target, setTarget] = useState('ALL');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sentStatus, setSentStatus] = useState(null);
  const [groups, setGroups] = useState([]);
  const [majors, setMajors] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedMajorId, setSelectedMajorId] = useState('');

  const fetchGroups = async () => {
    try {
      const token = SessionService.getToken();
      const userObj = SessionService.getUser();

      let url = `${API_URL}/api/groups`;
      if (userObj?.role === 'SUPER_ADMIN') {
        const selCollegeId = localStorage.getItem('superadmin_selectedCollegeId');
        if (selCollegeId) {
          url += `?collegeId=${selCollegeId}`;
        }
      }

      const res = await axios.get(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data && res.data.success) {
        setGroups(res.data.data);
      } else {
        throw new Error('API failed');
      }
    } catch (err) {
      console.error('Error fetching groups for broadcast target:', err);
      toast.error(isAr ? 'فشل في تحميل المجموعات الأكاديمية المستهدفة.' : 'Failed to load target academic groups.');
    }
  };

  const fetchMajors = async () => {
    try {
      const token = SessionService.getToken();
      const userObj = SessionService.getUser();

      let url = `${API_URL}/api/majors`;
      if (userObj?.role === 'SUPER_ADMIN') {
        const selCollegeId = localStorage.getItem('superadmin_selectedCollegeId');
        if (selCollegeId) {
          url += `?collegeId=${selCollegeId}`;
        }
      } else if (userObj?.collegeId) {
        url += `?collegeId=${userObj.collegeId}`;
      }

      const res = await axios.get(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data && res.data.success) {
        setMajors(res.data.data);
        if (res.data.data.length > 0) {
          setSelectedMajorId(res.data.data[0].id.toString());
        }
      }
    } catch (err) {
      console.error('Error fetching majors:', err);
    }
  };

  const fetchStudents = async () => {
    try {
      const token = SessionService.getToken();
      const user = SessionService.getUser();
      if (!hasPermission(user, PERMISSIONS.SEND_BROADCASTS)) return;
      const collegeId = user?.role === 'SUPER_ADMIN' ? localStorage.getItem('superadmin_selectedCollegeId') : null;
      const suffix = collegeId ? `?collegeId=${collegeId}` : '';
      const res = await axios.get(`${API_URL}/api/students${suffix}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (res.data?.success) setStudents(res.data.data ?? []);
    } catch (err) {
      // Preview data is non-blocking: sending continues through the server policy.
      console.warn('[Audience Registry] Could not load recipient index:', err.message);
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchMajors();
    fetchStudents();

    const handleCollegeSwitch = () => {
      console.log('[BroadcastCenter] College switch event detected, reloading groups & majors.');
      fetchGroups();
      fetchMajors();
      fetchStudents();
    };

    window.addEventListener('MANAR_COLLEGE_SWITCH', handleCollegeSwitch);
    return () => {
      window.removeEventListener('MANAR_COLLEGE_SWITCH', handleCollegeSwitch);
    };
  }, [isAr]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setSentStatus(null);

    const token = SessionService.getToken();
    const userObj = SessionService.getUser();

    if (!hasPermission(userObj, PERMISSIONS.SEND_BROADCASTS)) {
      toast.error(isAr ? 'لا تملك صلاحية إرسال التعميمات.' : 'You do not have permission to send broadcasts.');
      return;
    }

    try {
      let res;
      if (broadcastType === 'GROUP') {
        const payload = {
          groupId: target,
          message: message
        };

        if (userObj?.role === 'SUPER_ADMIN') {
          const selCollegeId = localStorage.getItem('superadmin_selectedCollegeId');
          if (selCollegeId) {
            payload.collegeId = parseInt(selCollegeId);
          }
        }

        res = await axios.post(`${API_URL}/api/broadcasts`, payload, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
      } else {
        const payload = {
          majorId: parseInt(selectedMajorId),
          message: message
        };

        res = await axios.post(`${API_URL}/api/broadcasts/major`, payload, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
      }

      if (res.data && res.data.success) {
        setMessage('');
        let targetLabel = '';
        if (broadcastType === 'GROUP') {
          targetLabel = target === 'ALL' 
            ? (isAr ? 'جميع الطلاب' : 'All Students') 
            : (groups.find(g => g.id.toString() === target.toString())?.name || 'Selected Group');
        } else {
          targetLabel = majors.find(m => m.id.toString() === selectedMajorId.toString())?.name || 'Selected Major';
        }
        
        const successMsg = isAr 
          ? `تم بث التنبيه بنجاح إلى: ${targetLabel}`
          : `Announcement successfully broadcasted to: ${targetLabel}`;

        setSentStatus({ success: true, message: successMsg });
        toast.success(successMsg);
        setTimeout(() => setSentStatus(null), 5000);
      } else {
        throw new Error('API failed');
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.error || (isAr ? 'فشل إرسال التعميم.' : 'Failed to send broadcast.');
      setSentStatus({ success: false, message: errMsg });
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const audience = broadcastType === 'GROUP'
    ? resolveAudience({
        type: target === 'ALL' ? AUDIENCE_TYPES.ALL_COLLEGE : AUDIENCE_TYPES.GROUP,
        id: target === 'ALL' ? SessionService.getUser()?.collegeId : target,
        students, groups, majors,
      })
    : resolveAudience({ type: AUDIENCE_TYPES.MAJOR, id: selectedMajorId, students, groups, majors });

  const audienceName = target === 'ALL'
    ? (isAr ? 'جميع طلاب الكلية' : 'All college students')
    : (audience.entity?.name || (broadcastType === 'MAJOR' ? (isAr ? 'التخصص المحدد' : 'Selected major') : (isAr ? 'المجموعة المحددة' : 'Selected group')));

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      dir={isAr ? 'rtl' : 'ltr'}
      className="flex-1 bg-transparent p-4 md:p-8 space-y-6 text-[var(--text-primary)]"
    >
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(to right, var(--accent), var(--accent-2, var(--accent)))' }}>
          {t('broadcast.title')}
        </h2>
        <p className="text-sm text-gray-400 mt-1">{t('broadcast.subtitle')}</p>
      </div>

      {/* Broadcast Form */}
      <div className="max-w-2xl frosted-panel rounded-2xl p-6 space-y-5">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--accent)] border-b border-white/5 pb-3">
          📢 {t('broadcast.composeTitle')}
        </h3>

        {sentStatus && (
          <div className={`p-4 rounded-xl text-xs font-semibold border ${
            sentStatus.success ? 'bg-green-950/40 border-green-600/50 text-green-200' : 'bg-red-950/40 border-red-650/50 text-red-200'
          }`}>
            {sentStatus.message}
          </div>
        )}

        <form onSubmit={handleSend} className="space-y-4 text-xs">
          {/* Selector Type */}
          <div className="space-y-1">
            <label className="text-gray-400 block font-medium">{isAr ? 'طريقة البث المستهدف' : 'Broadcast Targeting Type'}</label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 text-white font-bold cursor-pointer">
                <input
                  type="radio"
                  name="broadcastType"
                  value="GROUP"
                  checked={broadcastType === 'GROUP'}
                  onChange={() => setBroadcastType('GROUP')}
                  className="accent-[var(--accent)]"
                />
                <span>{isAr ? 'حسب الشعبة الدراسية' : 'By Academic Group'}</span>
              </label>
              <label className="flex items-center gap-2 text-white font-bold cursor-pointer">
                <input
                  type="radio"
                  name="broadcastType"
                  value="MAJOR"
                  checked={broadcastType === 'MAJOR'}
                  onChange={() => setBroadcastType('MAJOR')}
                  className="accent-[var(--accent)]"
                />
                <span>{isAr ? 'حسب التخصص الأكاديمي' : 'By Specialty / Major'}</span>
              </label>
            </div>
          </div>

          {/* Target Group Selector */}
          {broadcastType === 'GROUP' ? (
            <div className="space-y-1">
              <label className="text-gray-400 block font-medium">{t('broadcast.targetLabel')}</label>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full cmd-input p-3 font-bold cursor-pointer"
              >
                <option value="ALL" className="bg-[#0c0c0c] text-white">
                  {t('broadcast.targetAll')}
                </option>
                {groups.map(g => (
                  <option key={g.id} value={g.id} className="bg-[#0c0c0c] text-white">
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-1">
              <label className="text-gray-400 block font-medium">{isAr ? 'اختر التخصص المستهدف' : 'Target Specialty'}</label>
              <select
                value={selectedMajorId}
                onChange={(e) => setSelectedMajorId(e.target.value)}
                className="w-full cmd-input p-3 font-bold cursor-pointer"
              >
                {majors.map(m => (
                  <option key={m.id} value={m.id} className="bg-[#0c0c0c] text-white">
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 space-y-2">
            <div className="flex items-center justify-between gap-3 border-b border-cyan-500/20 pb-2">
              <span className="font-black text-cyan-300 text-xs flex items-center gap-1.5">
                🎯 {isAr ? 'معاينة الجمهور المستهدف' : 'Target Audience Preview'}
              </span>
              <span className="shrink-0 rounded-full bg-cyan-500/20 px-3 py-1 text-[11px] font-black text-cyan-200 border border-cyan-400/30">
                👥 {isAr ? `عدد المستلمين: ${audience.count}` : `Recipients: ${audience.count}`}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-gray-400">{isAr ? 'الهدف:' : 'Target:'}</span>{' '}
                <span className="font-bold text-white">{audience.humanReadable?.title || audienceName}</span>
              </div>
              {audience.humanReadable?.departmentName && (
                <div>
                  <span className="text-gray-400">{isAr ? 'القسم:' : 'Dept:'}</span>{' '}
                  <span className="font-bold text-cyan-100">{audience.humanReadable.departmentName}</span>
                </div>
              )}
              {audience.humanReadable?.majorName && (
                <div>
                  <span className="text-gray-400">{isAr ? 'التخصص:' : 'Major:'}</span>{' '}
                  <span className="font-bold text-cyan-100">{audience.humanReadable.majorName}</span>
                </div>
              )}
              {audience.humanReadable?.levelName && (
                <div>
                  <span className="text-gray-400">{isAr ? 'المستوى:' : 'Level:'}</span>{' '}
                  <span className="font-bold text-cyan-100">{audience.humanReadable.levelName}</span>
                </div>
              )}
              {audience.humanReadable?.groupName && (
                <div>
                  <span className="text-gray-400">{isAr ? 'المجموعة:' : 'Group:'}</span>{' '}
                  <span className="font-bold text-cyan-100">{audience.humanReadable.groupName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Alert Message Box */}
          <div className="space-y-1">
            <label className="text-gray-400 block font-medium">{t('broadcast.messageLabel')}</label>
            <textarea
              required
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('broadcast.messagePlaceholder')}
              className="w-full cmd-input p-3 leading-relaxed text-xs"
            />
            <p className="text-[10px] text-gray-500 mt-1">{t('broadcast.messageDesc')}</p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-6 py-3 btn-neon text-xs font-extrabold flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>🚀 {t('broadcast.sendBtn')}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </motion.div>
  );
}
