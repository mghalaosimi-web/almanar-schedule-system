import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

export default function SelfHealingPatcher({ API_URL, token, isAr }) {
  const [patches, setPatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggeringError, setTriggeringError] = useState(false);
  const [selectedPatch, setSelectedPatch] = useState(null);
  const [actioningPatch, setActioningPatch] = useState(null);

  const fetchPatches = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/admin/dev/patches`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setPatches(res.data.data || []);
      }
    } catch (_) {
      toast.error(isAr ? 'فشل تحميل رقوعات الإصلاح الذاتي' : 'Failed to fetch self-healing patches');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [API_URL, token, isAr]);

  useEffect(() => {
    fetchPatches();
    const interval = setInterval(() => fetchPatches(true), 10000);
    return () => clearInterval(interval);
  }, [fetchPatches]);

  const handleTriggerError = async () => {
    setTriggeringError(true);
    toast.loading(isAr ? 'جاري تحفيز خطأ 500 تجريبي...' : 'Triggering simulated 500 error...', { id: 'trigger_error' });
    try {
      await axios.post(
        `${API_URL}/api/admin/dev/patches/trigger-test-error`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
    } catch (err) {
      // The endpoint returns a 500 error as designed
      toast.success(
        isAr 
          ? '✅ تم إلقاء الخطأ بنجاح! جاري قيام Gemini بتحليل الكود وإنشاء رقعة إصلاح...' 
          : '✅ Error thrown successfully! Gemini is analyzing and constructing patch...',
        { id: 'trigger_error', duration: 6000 }
      );
      // Wait for a few seconds to let AI process before refreshing
      setTimeout(() => fetchPatches(true), 4000);
    } finally {
      setTriggeringError(false);
    }
  };

  const handleApprove = async (patchId) => {
    if (!window.confirm(isAr ? 'هل أنت متأكد من دمج وتطبيق رقعة الكود المقترحة؟ سيتم نسخ الملف احتياطياً.' : 'Are you sure you want to merge and apply the proposed patch? The file will be backed up.')) return;
    setActioningPatch(patchId);
    try {
      const res = await axios.post(
        `${API_URL}/api/admin/dev/patches/${patchId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        toast.success(isAr ? '🎉 تم دمج الرقعة بنجاح وتحديث الكود!' : '🎉 Patch merged successfully and code updated!');
        setSelectedPatch(null);
        fetchPatches(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل دمج وتحديث الكود' : 'Failed to merge and apply code update'));
    } finally {
      setActioningPatch(null);
    }
  };

  const handleDismiss = async (patchId) => {
    if (!window.confirm(isAr ? 'هل تريد استبعاد هذه الرقعة المقترحة؟' : 'Are you sure you want to dismiss this patch?')) return;
    setActioningPatch(patchId);
    try {
      const res = await axios.post(
        `${API_URL}/api/admin/dev/patches/${patchId}/dismiss`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        toast.success(isAr ? 'تم استبعاد الرقعة المقترحة' : 'Patch dismissed');
        setSelectedPatch(null);
        fetchPatches(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل استبعاد الرقعة' : 'Failed to dismiss patch'));
    } finally {
      setActioningPatch(null);
    }
  };

  const pendingPatches = patches.filter(p => p.status === 'PENDING');
  const resolvedPatches = patches.filter(p => p.status === 'APPROVED');
  const dismissedPatches = patches.filter(p => p.status === 'DISMISSED');

  return (
    <div className="space-y-6">
      {/* Overview stats & Simulated Trigger Control */}
      <div className="bg-[#0b0f19]/60 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-2xl">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="text-emerald-400">🩺</span>
            {isAr ? 'نظام الشفاء الذاتي المدمج بـ AI (Self-Healing Auto-Patcher)' : 'AI Self-Healing Auto-Patcher'}
            <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">ACTIVE</span>
          </h3>
          <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
            {isAr
              ? 'يقوم السيرفر باعتراض أخطاء 500، وتمرير الكود المكسور مع تفاصيل الخطأ لنموذج Gemini AI، ثم يقترح كود الإصلاح للتأكيد والدمج بنقرة واحدة.'
              : 'Automatically intercepts 500 errors, passes the broken code and logs to Gemini, and generates a one-click code merge patch.'}
          </p>
        </div>

        <button
          onClick={handleTriggerError}
          disabled={triggeringError}
          className={`px-5 py-3 rounded-xl text-xs font-black transition duration-200 shadow-xl flex items-center gap-2 border ${
            triggeringError
              ? 'bg-slate-850 border-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-red-650 to-rose-600 hover:from-red-500 hover:to-rose-500 border-red-500/30 text-white shadow-red-650/10'
          }`}
        >
          <span>🔥</span>
          <span>{isAr ? 'محاكاة خطأ 500 تجريبي' : 'Simulate 500 Error'}</span>
        </button>
      </div>

      {/* Counters Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: isAr ? 'إجمالي الأخطاء المرصودة' : 'Total Logged Errors', value: patches.length, color: 'text-sky-400', icon: '🚨' },
          { label: isAr ? 'بانتظار المراجعة والدمج' : 'Pending Review', value: pendingPatches.length, color: 'text-amber-400', icon: '⏳', pulse: pendingPatches.length > 0 },
          { label: isAr ? 'تم معالجتها تلقائياً' : 'Patches Applied', value: resolvedPatches.length, color: 'text-emerald-400', icon: '✅' },
          { label: isAr ? 'مستبعدة' : 'Dismissed', value: dismissedPatches.length, color: 'text-slate-400', icon: '🗑️' }
        ].map((s, i) => (
          <div key={i} className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-center justify-between shadow-lg">
            <div>
              <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-wider">{s.label}</span>
              <h3 className={`text-lg font-black font-mono mt-1 ${s.color}`}>{s.value}</h3>
            </div>
            <div className="flex items-center gap-2">
              {s.pulse && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping shrink-0" />}
              <span className="text-xl opacity-60">{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Main content split list vs detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Pending Patches List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-2xl">
            <h4 className="text-xs font-bold text-white mb-4 uppercase tracking-wider flex items-center gap-1.5">
              <span>⏳</span>
              {isAr ? 'الرقوعات قيد المراجعة' : 'Pending Patches'}
              <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-mono">{pendingPatches.length}</span>
            </h4>

            {loading ? (
              <div className="py-12 text-center text-slate-500 text-xs animate-pulse">
                {isAr ? 'جاري تحميل سجل الأخطاء...' : 'Loading patch queue...'}
              </div>
            ) : pendingPatches.length === 0 ? (
              <div className="py-12 text-center text-slate-650 text-xs italic">
                {isAr ? 'لا توجد أخطاء معلقة بانتظار الإصلاح حالياً 🎉' : 'No pending errors found! All systems stable 🎉'}
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {pendingPatches.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPatch(p)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer text-left ${
                      selectedPatch?.id === p.id
                        ? 'bg-amber-500/10 border-amber-500/40 shadow-amber-500/5'
                        : 'bg-slate-950/60 border-slate-900 hover:border-slate-850 hover:bg-slate-900/50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[10px] font-black text-rose-400 font-mono tracking-wide uppercase">
                        {p.reqMethod} {p.reqPath.split('?')[0]}
                      </span>
                      <span className="text-[8px] font-mono text-slate-500">
                        {new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <h5 className="text-[11px] font-bold text-white truncate">{p.fileBasename}</h5>
                    <p className="text-[10px] text-slate-450 mt-1 line-clamp-2 leading-relaxed font-mono">
                      {p.errorMessage}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Archive / Applied logs */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-2xl">
            <h4 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider flex items-center gap-1.5">
              <span>📜</span>
              {isAr ? 'الأرشيف والمعالجة السابقة' : 'Patched & Dismissed Logs'}
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1 text-[10px]">
              {[...resolvedPatches, ...dismissedPatches].length === 0 ? (
                <div className="text-center text-slate-650 py-4 italic">{isAr ? 'الأرشيف فارغ' : 'Archive empty'}</div>
              ) : (
                [...resolvedPatches, ...dismissedPatches].map(p => (
                  <div key={p.id} className="flex justify-between items-center py-2 border-b border-slate-800/40 font-sans">
                    <div className="truncate pr-2">
                      <span className="font-bold text-slate-350 block truncate">{p.fileBasename}</span>
                      <span className="text-slate-550 block font-mono text-[8px] truncate">{p.errorMessage}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider shrink-0 ${
                      p.status === 'APPROVED' 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-800 text-slate-450'
                    }`}>
                      {p.status === 'APPROVED' ? 'PATCHED' : 'DISMISSED'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Selected Patch Interactive Diff & Details */}
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence mode="wait">
            {!selectedPatch ? (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs italic flex flex-col justify-center items-center h-full min-h-[400px] shadow-2xl"
              >
                <span className="text-4xl mb-4">🩺</span>
                {isAr
                  ? 'اختر خطأً من القائمة اليسرى لعرض تقرير الخطأ، الاستماع لمقترح الذكاء الاصطناعي، ومقارنة الكود قبل الدمج.'
                  : 'Select an error from the pending queue to inspect logs, view the AI repair proposal, and approve changes.'}
              </motion.div>
            ) : (
              <motion.div
                key={selectedPatch.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6"
              >
                {/* Patch Header */}
                <div className="flex justify-between items-start gap-4 border-b border-slate-800/60 pb-4">
                  <div>
                    <span className="text-[9px] font-black text-rose-400 font-mono tracking-widest uppercase block mb-1">
                      {selectedPatch.reqMethod} {selectedPatch.reqPath}
                    </span>
                    <h3 className="text-sm font-black text-white">{selectedPatch.fileBasename}</h3>
                    <p className="text-[10px] text-slate-500 mt-1 font-mono">{selectedPatch.filePath}</p>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500">
                    {new Date(selectedPatch.timestamp).toLocaleString()}
                  </span>
                </div>

                {/* Error Box */}
                <div className="bg-red-500/10 border border-red-500/25 p-4 rounded-xl font-mono text-[10px] text-red-400 space-y-2 max-h-40 overflow-y-auto text-left">
                  <div className="font-bold text-[11px]">{selectedPatch.errorName}: {selectedPatch.errorMessage}</div>
                  <pre className="whitespace-pre-wrap leading-relaxed text-[9px] text-red-300/80">{selectedPatch.errorStack}</pre>
                </div>

                {/* AI Explanation Banner */}
                <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-2 text-left">
                  <div className="flex items-center gap-2 text-purple-400 text-xs font-bold">
                    <span>🤖</span>
                    <span>{isAr ? 'تفسير Gemini AI وإصلاح المقترح:' : 'Gemini AI Explanation & Repair:'}</span>
                  </div>
                  <p className="text-[11px] text-slate-350 leading-relaxed font-medium">
                    {isAr ? selectedPatch.explanationAr : selectedPatch.explanationEn}
                  </p>
                </div>

                {/* Split Code View / Diff Simulator */}
                <div className="space-y-2">
                  <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-left">
                    {isAr ? 'الكود المصلح المقترح (Proposed Repair):' : 'Proposed Code Repair:'}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Original Source */}
                    <div className="flex flex-col">
                      <div className="bg-slate-950 border border-slate-900 rounded-t-xl px-4 py-2 border-b-0 text-[9px] text-slate-500 font-mono flex justify-between items-center">
                        <span>❌ Original Code</span>
                      </div>
                      <textarea
                        readOnly
                        value={selectedPatch.originalCode}
                        className="bg-slate-950/80 border border-slate-900 focus:outline-none rounded-b-xl p-4 font-mono text-[9px] text-slate-500 h-60 w-full overflow-auto whitespace-pre leading-relaxed select-none text-left"
                      />
                    </div>

                    {/* Proposed Corrected Source */}
                    <div className="flex flex-col">
                      <div className="bg-emerald-950/30 border border-emerald-900/30 rounded-t-xl px-4 py-2 border-b-0 text-[9px] text-emerald-400 font-mono flex justify-between items-center">
                        <span>🟢 Proposed Fix</span>
                      </div>
                      <textarea
                        readOnly
                        value={selectedPatch.proposedCode}
                        className="bg-slate-950/80 border border-emerald-900/20 focus:outline-none rounded-b-xl p-4 font-mono text-[9px] text-emerald-450 h-60 w-full overflow-auto whitespace-pre leading-relaxed select-none text-left"
                      />
                    </div>
                  </div>
                </div>

                {/* Approval Action Panel */}
                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800/60">
                  <button
                    onClick={() => handleDismiss(selectedPatch.id)}
                    disabled={actioningPatch === selectedPatch.id}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-350 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    {isAr ? 'استبعاد 🗑️' : 'Dismiss 🗑️'}
                  </button>

                  <button
                    onClick={() => handleApprove(selectedPatch.id)}
                    disabled={actioningPatch === selectedPatch.id}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black rounded-xl transition shadow-lg shadow-emerald-600/20 flex items-center gap-1.5 border border-emerald-500/20 cursor-pointer"
                  >
                    {actioningPatch === selectedPatch.id ? (
                      <>
                        <span className="animate-spin text-sm">⏳</span>
                        <span>{isAr ? 'جاري دمج الكود...' : 'Merging Code...'}</span>
                      </>
                    ) : (
                      <>
                        <span>🩺</span>
                        <span>{isAr ? 'موافقة ودمج الكود (Approve & Merge)' : 'Approve & Merge Code'}</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
