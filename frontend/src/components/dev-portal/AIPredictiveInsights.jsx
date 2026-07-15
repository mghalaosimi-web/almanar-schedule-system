import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function AIPredictiveInsights({ API_URL, token, isAr }) {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState(null);

  const fetchInsights = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/admin/dev/ai-insights`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setInsights(res.data.data || []);
      }
    } catch (_) {
      toast.error(isAr ? 'فشل تحميل التقارير الذكية' : 'Failed to fetch AI insights');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [API_URL, token, isAr]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await axios.post(
        `${API_URL}/api/admin/dev/ai-insights/generate`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        toast.success(isAr ? '✅ اكتمل تحليل Gemini وتوليد التقارير!' : '✅ Gemini analysis and generation complete!');
        fetchInsights(true);
      }
    } catch (err) {
      toast.error(isAr ? 'فشل تشغيل محرك التحليل' : 'Failed to trigger analyzer engine');
    } finally {
      setGenerating(false);
    }
  };

  const getSeverityColor = (sev) => {
    const s = String(sev).toUpperCase();
    if (s === 'CRITICAL') return 'bg-red-500/15 border-red-500/30 text-red-400';
    if (s === 'WARNING')  return 'bg-amber-500/15 border-amber-500/30 text-amber-400';
    return 'bg-blue-500/15 border-blue-500/30 text-blue-400';
  };

  const getCategoryEmoji = (cat) => {
    const c = String(cat).toUpperCase();
    if (c === 'SECURITY')    return '🔐';
    if (c === 'PERFORMANCE') return '⚡';
    if (c === 'MAINTENANCE') return '💾';
    return '📢';
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Control */}
      <div className="bg-[#0b0f19]/60 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-2xl">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="text-purple-400">🤖</span>
            {isAr ? 'مستشار العمليات التنبؤي — Gemini AI' : 'Predictive Operations Oracle — Gemini AI'}
          </h3>
          <p className="text-[10px] text-slate-500 mt-1">
            {isAr
              ? 'يقوم النموذج بتحليل مؤشرات قاعدة البيانات، سجلات الجلسات، محاولات الاختراق، وجداول الصيانة لاكتشاف المخاطر تلقائياً.'
              : 'Analyze database telemetry, session logs, rate limiters, and server resources to detect risks.'}
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className={`px-5 py-3 rounded-xl text-xs font-black transition duration-200 shadow-xl flex items-center gap-2 border ${
            generating
              ? 'bg-slate-850 border-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 border-purple-500/30 text-white shadow-purple-600/10'
          }`}
        >
          {generating ? (
            <>
              <span className="animate-spin text-sm">⚙️</span>
              <span>{isAr ? 'جاري تحليل البيانات...' : 'Analyzing telemetry...'}</span>
            </>
          ) : (
            <>
              <span>⚡</span>
              <span>{isAr ? 'تحديث التحليل الذكي فورا' : 'Trigger Fresh AI Analysis'}</span>
            </>
          )}
        </button>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-500 text-xs animate-pulse">
          {isAr ? 'جاري قراءة تقارير Gemini...' : 'Loading AI insights...'}
        </div>
      ) : insights.length === 0 ? (
        <div className="py-16 text-center text-slate-600 text-xs italic">
          {isAr ? 'لا توجد تقارير حالياً. اضغط على الزر أعلاه لتوليد أول تحليل.' : 'No insights generated yet. Click the button above to run the AI engine.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insights.map((ins) => {
            const sevColor = getSeverityColor(ins.severity);
            const categoryEmoji = getCategoryEmoji(ins.category);

            return (
              <motion.div
                key={ins.id}
                layout
                whileHover={{ y: -2 }}
                onClick={() => setSelectedInsight(ins)}
                className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/60 rounded-2xl p-5 shadow-xl transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                      <span>{categoryEmoji}</span>
                      <span>{ins.category}</span>
                    </span>
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full border ${sevColor}`}>
                      {ins.severity}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-white mb-2 leading-snug">{ins.title}</h4>
                  <p className="text-[10px] text-slate-400 line-clamp-3 leading-relaxed">{ins.body}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/60 flex justify-between items-center text-[8px] font-mono text-slate-600">
                  <span>{new Date(ins.generatedAt).toLocaleDateString(isAr ? 'ar' : 'en')}</span>
                  <span>{new Date(ins.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Insight details modal */}
      <AnimatePresence>
        {selectedInsight && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl"
            >
              <div className="flex justify-between items-center mb-4">
                <span className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <span>{getCategoryEmoji(selectedInsight.category)}</span>
                  <span>{selectedInsight.category} Analysis</span>
                </span>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${getSeverityColor(selectedInsight.severity)}`}>
                  {selectedInsight.severity}
                </span>
              </div>

              <h3 className="text-sm font-bold text-white mb-3">{selectedInsight.title}</h3>
              <p className="text-xs text-slate-350 leading-relaxed mb-6 whitespace-pre-wrap bg-slate-950/60 border border-slate-850 p-4 rounded-xl font-medium">
                {selectedInsight.body}
              </p>

              {/* Underlying Metrics */}
              {selectedInsight.data && (
                <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 mb-6">
                  <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3">
                    {isAr ? 'البيانات والمؤشرات المصاحبة للتحليل' : 'Underlying System Metrics'}
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-[10px] font-mono">
                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-500">{isAr ? 'إجمالي الطلاب:' : 'Total Students:'}</span>
                      <span className="text-white font-bold">{selectedInsight.data.studentCount}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-500">{isAr ? 'جلسات نشطة:' : 'Active Sessions:'}</span>
                      <span className="text-white font-bold">{selectedInsight.data.activeSessionsCount}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-500">{isAr ? 'دخول فاشل 24h:' : 'Failed Logins 24h:'}</span>
                      <span className="text-white font-bold">{selectedInsight.data.failedLogins24h}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-900 pb-1.5">
                      <span className="text-slate-500">{isAr ? 'آخر باك أب:' : 'Last Backup:'}</span>
                      <span className="text-white font-bold">{selectedInsight.data.daysSinceLastBackup} {isAr ? 'يوم' : 'days'}</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => setSelectedInsight(null)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition"
              >
                {isAr ? 'إغلاق نافذة التفاصيل' : 'Close Details'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
