import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// ── Backup Entity Section ────────────────────────────────────────────────────
const BACKUP_ENTITIES = [
  { key: 'students',      icon: '👨‍🎓', labelAr: 'الطلاب',          labelEn: 'Students'          },
  { key: 'lecturers',     icon: '👨‍🏫', labelAr: 'المحاضرين',       labelEn: 'Lecturers'         },
  { key: 'schedules',     icon: '📅', labelAr: 'الجداول الدراسية', labelEn: 'Schedules'         },
  { key: 'groups',        icon: '👥', labelAr: 'الشعب الدراسية',   labelEn: 'Groups'            },
  { key: 'rooms',         icon: '🏛️', labelAr: 'القاعات',           labelEn: 'Rooms'             },
  { key: 'subjects',      icon: '📚', labelAr: 'المواد',            labelEn: 'Subjects'          },
  { key: 'notifications', icon: '📬', labelAr: 'الإشعارات',         labelEn: 'Notifications'     },
  { key: 'auditLogs',     icon: '📋', labelAr: 'سجل التدقيق',      labelEn: 'Audit Logs'        },
  { key: 'sessionLogs',   icon: '🔐', labelAr: 'سجل الجلسات',      labelEn: 'Session Logs'      },
  { key: 'universities',  icon: '🌐', labelAr: 'الجامعات والكليات', labelEn: 'Universities'      },
  { key: 'tenantConfigs', icon: '⚙️', labelAr: 'إعدادات المستأجرين', labelEn: 'Tenant Configs'  },
  { key: 'examSchedules', icon: '📝', labelAr: 'جداول الاختبارات', labelEn: 'Exam Schedules'    },
];

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Progress Animation ─────────────────────────────────────────────────────────
function ProgressBar({ progress, label }) {
  return (
    <div className="mb-4">
      <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1.5">
        <span>{label}</span>
        <span>{progress}%</span>
      </div>
      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );
}

// ── Main BackupManager ─────────────────────────────────────────────────────────
export default function BackupManager({ API_URL, token, isAr }) {
  const [selected,    setSelected]    = useState(new Set(BACKUP_ENTITIES.map(e => e.key)));
  const [backing,     setBacking]     = useState(false);
  const [progress,    setProgress]    = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [backupLog,   setBackupLog]   = useState([]);

  const toggleEntity = (key) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const selectAll   = () => setSelected(new Set(BACKUP_ENTITIES.map(e => e.key)));
  const selectNone  = () => setSelected(new Set());

  const runBackup = useCallback(async () => {
    if (selected.size === 0) {
      toast.error(isAr ? 'اختر كياناً واحداً على الأقل' : 'Select at least one entity');
      return;
    }
    setBacking(true);
    setProgress(0);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fullBackup = { meta: { timestamp, entities: [...selected], version: '1.0' }, data: {} };
    const log = [];

    const entitiesToBackup = BACKUP_ENTITIES.filter(e => selected.has(e.key));
    for (let i = 0; i < entitiesToBackup.length; i++) {
      const entity = entitiesToBackup[i];
      setProgressMsg(`${isAr ? 'جاري نسخ:' : 'Backing up:'} ${isAr ? entity.labelAr : entity.labelEn}...`);
      setProgress(Math.round((i / entitiesToBackup.length) * 90));
      try {
        const res = await axios.get(
          `${API_URL}/api/admin/dev/backup/${entity.key}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data?.success) {
          fullBackup.data[entity.key] = res.data.data;
          log.push({ entity: entity.key, status: 'ok', count: res.data.data?.length ?? '?' });
        } else {
          log.push({ entity: entity.key, status: 'error', msg: 'No data returned' });
        }
      } catch (err) {
        log.push({ entity: entity.key, status: 'error', msg: err.response?.data?.error || err.message });
      }
    }

    setProgress(95);
    setProgressMsg(isAr ? 'إنشاء ملف JSON...' : 'Generating JSON file...');
    await new Promise(r => setTimeout(r, 300));

    downloadJSON(fullBackup, `manar_backup_${timestamp}.json`);
    setProgress(100);
    setProgressMsg(isAr ? '✅ اكتمل التصدير!' : '✅ Backup complete!');
    setBackupLog(log);
    toast.success(isAr ? `تم تصدير ${entitiesToBackup.length} كيانات بنجاح` : `Exported ${entitiesToBackup.length} entities successfully`);
    setBacking(false);
  }, [selected, API_URL, token, isAr]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-blue-500/20 rounded-2xl p-6 shadow-2xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-blue-400">💾</span>
              {isAr ? 'مركز النسخ الاحتياطي الشامل' : 'Full System Backup Manager'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">
              {isAr
                ? 'تصدير كافة بيانات المنظومة كملف JSON واحد مشفر قابل للاستيراد.'
                : 'Export all system data as a single structured JSON file for safekeeping.'}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={selectAll}  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 rounded-lg transition">
              {isAr ? 'تحديد الكل' : 'Select All'}
            </button>
            <button onClick={selectNone} className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-400 rounded-lg transition">
              {isAr ? 'إلغاء الكل' : 'Deselect All'}
            </button>
          </div>
        </div>

        {/* Entity grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mb-6">
          {BACKUP_ENTITIES.map(entity => {
            const isOn = selected.has(entity.key);
            return (
              <button
                key={entity.key}
                onClick={() => toggleEntity(entity.key)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all duration-200 ${
                  isOn
                    ? 'bg-blue-500/15 border-blue-500/40 text-white'
                    : 'bg-slate-950/40 border-slate-800/60 text-slate-500 hover:border-slate-700'
                }`}
              >
                <span className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border text-[10px] font-black transition ${
                  isOn ? 'bg-blue-600 border-blue-500 text-white' : 'border-slate-700 text-transparent'
                }`}>✓</span>
                <span className="text-sm shrink-0">{entity.icon}</span>
                <span className="text-left leading-tight">{isAr ? entity.labelAr : entity.labelEn}</span>
              </button>
            );
          })}
        </div>

        {/* Progress display */}
        <AnimatePresence>
          {(backing || progress > 0) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4"
            >
              <ProgressBar progress={progress} label={progressMsg} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Launch button */}
        <button
          onClick={runBackup}
          disabled={backing || selected.size === 0}
          className={`w-full py-4 rounded-2xl text-sm font-black transition duration-200 shadow-2xl flex items-center justify-center gap-3 border ${
            backing
              ? 'bg-slate-800 border-slate-700 text-slate-400 cursor-wait'
              : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 border-blue-500/30 text-white shadow-blue-600/20'
          }`}
        >
          {backing ? (
            <>
              <span className="animate-spin">⚙️</span>
              <span>{progressMsg || (isAr ? 'جاري النسخ الاحتياطي...' : 'Backup in progress...')}</span>
            </>
          ) : (
            <>
              <span>💾</span>
              <span>{isAr ? `تصدير ${selected.size} كيان كـ JSON` : `Export ${selected.size} entities as JSON`}</span>
            </>
          )}
        </button>
      </div>

      {/* Backup Log */}
      <AnimatePresence>
        {backupLog.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/60 backdrop-blur-xl border border-emerald-500/20 rounded-2xl p-6 shadow-2xl"
          >
            <h4 className="text-xs font-bold text-white mb-4 flex items-center gap-2">
              <span className="text-emerald-400">📋</span>
              {isAr ? 'سجل عملية النسخ الاحتياطي' : 'Backup Operation Log'}
            </h4>
            <div className="space-y-1.5 font-mono text-[10px]">
              {backupLog.map((entry, i) => {
                const entityMeta = BACKUP_ENTITIES.find(e => e.key === entry.entity);
                return (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-950/50 rounded-lg">
                    <span className={entry.status === 'ok' ? 'text-emerald-400' : 'text-red-400'}>
                      {entry.status === 'ok' ? '✓' : '✗'}
                    </span>
                    <span className="text-slate-300">{entityMeta?.icon} {isAr ? entityMeta?.labelAr : entityMeta?.labelEn}</span>
                    <span className="ml-auto">
                      {entry.status === 'ok'
                        ? <span className="text-emerald-400">{entry.count} {isAr ? 'سجل' : 'records'}</span>
                        : <span className="text-red-400">{entry.msg}</span>
                      }
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/60 text-[10px] text-slate-500 font-mono">
              {isAr
                ? `✅ اكتمل — ${backupLog.filter(e => e.status === 'ok').length} نجاح · ${backupLog.filter(e => e.status === 'error').length} خطأ`
                : `✅ Done — ${backupLog.filter(e => e.status === 'ok').length} succeeded · ${backupLog.filter(e => e.status === 'error').length} failed`}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
