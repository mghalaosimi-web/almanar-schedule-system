import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// ── SQL Syntax Highlighter (no external libs) ─────────────────────────────────
function applySqlHighlight(sql) {
  if (!sql) return '';
  // Escape HTML first to prevent XSS from user input
  const escaped = sql
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped
    // Comments (must come first)
    .replace(/(--[^\n]*)/g, '<span class="text-slate-500 italic">$1</span>')
    // Single-quoted strings
    .replace(/('(?:[^'\\]|\\.)*')/g, '<span class="text-amber-400">$1</span>')
    // Numbers
    .replace(/\b(\d+)\b/g, '<span class="text-purple-400">$1</span>')
    // SQL keywords
    .replace(
      /\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|ON|GROUP\s+BY|ORDER\s+BY|HAVING|LIMIT|OFFSET|AND|OR|NOT|AS|WITH|DISTINCT|COUNT|SUM|AVG|MAX|MIN|IN|IS|NULL|LIKE|BETWEEN|UNION|ALL|EXISTS|CASE|WHEN|THEN|ELSE|END|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|DROP|ALTER|TABLE|INDEX|VIEW|FUNCTION|PROCEDURE|TRIGGER|RETURNS|RETURN|BEGIN|COMMIT|ROLLBACK|TRANSACTION|PRIMARY|KEY|FOREIGN|REFERENCES|UNIQUE|DEFAULT|CONSTRAINT|CASCADE|SERIAL|VARCHAR|INTEGER|TEXT|BOOLEAN|TIMESTAMP|DATE|FLOAT)\b/gi,
      '<span class="text-blue-400 font-semibold">$&</span>'
    );
}

const PRESETS = [
  {
    nameAr: 'أكثر 10 مستخدمين تسجيلاً للدخول',
    nameEn: 'Top 10 Logins by User',
    sql: `SELECT "userEmail", "role", COUNT(*) as logins \nFROM "SessionLog" \nGROUP BY "userEmail", "role" \nORDER BY logins DESC \nLIMIT 10;`
  },
  {
    nameAr: 'آخر 50 عملية تدقيق للنظام',
    nameEn: 'Last 50 System Actions',
    sql: `SELECT "timestamp", "userEmail", "action", "entityType", "ipAddress" \nFROM "AuditLog" \nORDER BY "timestamp" DESC \nLIMIT 50;`
  },
  {
    nameAr: 'إحصائيات الطلاب حسب الكلية',
    nameEn: 'Student Counts by College',
    sql: `SELECT c.name as college, COUNT(s.id) as students \nFROM "Student" s \nJOIN "College" c ON s."collegeId" = c.id \nGROUP BY c.name \nORDER BY students DESC;`
  },
  {
    nameAr: 'معدل الحضور اليومي للمحاضرات',
    nameEn: 'Daily Attendance Summary',
    sql: `SELECT date::date as day, status, COUNT(*) as count \nFROM "Attendance" \nGROUP BY day, status \nORDER BY day DESC \nLIMIT 20;`
  },
  {
    nameAr: 'أكثر القاعات استخداماً في الجداول',
    nameEn: 'Top Rooms in Schedules',
    sql: `SELECT r.name as room, COUNT(s.id) as classes \nFROM "Schedule" s \nJOIN "Room" r ON s."roomId" = r.id \nGROUP BY r.name \nORDER BY classes DESC \nLIMIT 10;`
  }
];

export default function SqlTerminal({ API_URL, token, isAr }) {
  const [query, setQuery] = useState(PRESETS[0].sql);
  const [history, setHistory] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Load local history
    const saved = localStorage.getItem('manar_sql_history');
    if (saved) {
      try { setHistory(JSON.parse(saved)); } catch (_) {}
    }
  }, []);

  const saveToHistory = (sql) => {
    const clean = sql.trim();
    if (!clean) return;
    const next = [clean, ...history.filter(h => h !== clean)].slice(0, 15);
    setHistory(next);
    localStorage.setItem('manar_sql_history', JSON.stringify(next));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('manar_sql_history');
    toast.success(isAr ? 'تم مسح السجل' : 'History cleared');
  };

  const handleExecute = async () => {
    if (!query.trim()) {
      toast.error(isAr ? 'اكتب استعلاماً أولاً' : 'Write a query first');
      return;
    }
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await axios.post(
        `${API_URL}/api/admin/dev/sql-query`,
        { query },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        setResults(res.data.data || []);
        saveToHistory(query);
        toast.success(isAr ? 'تم الاستعلام بنجاح' : 'Query executed successfully');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
      toast.error(isAr ? 'فشل تنفيذ الاستعلام' : 'Execution failed');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!results || results.length === 0) return;
    const headers = Object.keys(results[0]);
    const rows = results.map(row =>
      headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
        return `"${String(val).replace(/"/g, '""')}"`;
      })
    );

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sql_results_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Disclaimer Banner */}
      <div className="p-4 bg-amber-500/15 border border-amber-500/30 rounded-2xl flex items-start gap-3">
        <span className="text-xl">⚠️</span>
        <div className="text-xs">
          <span className="font-black text-amber-400 block mb-0.5">{isAr ? 'بيئة استعلامات آمنة للقراءة فقط' : 'Secure Read-Only Operational Environment'}</span>
          <span className="text-slate-400 leading-relaxed">
            {isAr
              ? 'تخضع شاشة الاستعلام لرقابة مشددة. يُسمح فقط باستعلامات SELECT أو WITH. يتم تسجيل كل جملة SQL في سجل التدقيق الإداري ولا يمكن إدخال أو تعديل أو حذف البيانات هنا.'
              : 'All database queries are audited. Only SELECT or WITH statements are allowed. Modifying, dropping, or inserting data is strictly blocked.'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Side: Presets & History */}
        <div className="lg:col-span-1 space-y-4">
          {/* Presets */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-3">
              {isAr ? 'استعلامات جاهزة' : 'Preset Queries'}
            </h4>
            <div className="space-y-2">
              {PRESETS.map((p) => (
                <button
                  key={p.nameEn}
                  onClick={() => setQuery(p.sql)}
                  className="w-full text-left px-3 py-2 bg-slate-950/60 hover:bg-slate-800/80 border border-slate-900 hover:border-slate-800 rounded-xl text-[10px] font-bold text-slate-350 block truncate transition-all"
                  title={isAr ? p.nameAr : p.nameEn}
                >
                  {isAr ? p.nameAr : p.nameEn}
                </button>
              ))}
            </div>
          </div>

          {/* History */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                {isAr ? 'سجل استعلاماتك' : 'Query History'}
              </h4>
              {history.length > 0 && (
                <button onClick={clearHistory} className="text-[8px] text-red-400 font-bold hover:underline">
                  {isAr ? 'مسح' : 'Clear'}
                </button>
              )}
            </div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto font-mono text-[9px]">
              {history.length === 0 ? (
                <div className="text-center text-slate-600 py-4">{isAr ? 'لا يوجد سجل' : 'No history'}</div>
              ) : (
                history.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => setQuery(h)}
                    className="w-full text-left p-2 bg-slate-950/45 hover:bg-slate-850/60 rounded-lg text-slate-400 hover:text-white truncate block transition border border-transparent hover:border-slate-800"
                    title={h}
                  >
                    {h.substring(0, 60)}...
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Terminal Editor & Results */}
        <div className="lg:col-span-3 space-y-6">
          {/* Editor Container */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-2xl">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-black font-mono text-white">manar_db_yp8w=#</span>
              </div>
              <span className="text-[9px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Read-Only Terminal
              </span>
            </div>

            <div className="relative">
              {/* Highlighted preview layer */}
              <div
                className="absolute inset-0 w-full h-40 bg-transparent rounded-xl p-4 font-mono text-xs leading-relaxed pointer-events-none overflow-hidden whitespace-pre-wrap break-words"
                dangerouslySetInnerHTML={{ __html: applySqlHighlight(query) }}
              />
              {/* Editable textarea on top (transparent text so highlight shows) */}
              <textarea
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="SELECT * FROM ... LIMIT 10;"
                spellCheck={false}
                className="relative w-full h-40 bg-slate-950 border border-slate-800 focus:border-slate-700 rounded-xl p-4 font-mono text-xs text-transparent caret-emerald-400 placeholder-emerald-900/60 focus:outline-none focus:ring-0 leading-relaxed resize-none"
              />
            </div>

            <div className="flex justify-end gap-2.5 mt-3">
              <button
                onClick={() => setQuery('')}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition"
              >
                {isAr ? 'تفريغ 🗑️' : 'Clear 🗑️'}
              </button>
              <button
                onClick={handleExecute}
                disabled={loading}
                className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black rounded-xl transition shadow-lg shadow-emerald-600/20 flex items-center gap-1.5"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⚙️</span>
                    <span>{isAr ? 'جاري التنفيذ...' : 'Running...'}</span>
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    <span>{isAr ? 'تنفيذ الاستعلام' : 'Execute Query'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results Block */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/25 p-4 rounded-2xl text-xs font-mono text-red-400 shadow-xl"
              >
                <div className="font-black mb-1">{isAr ? 'خطأ في التنفيذ:' : 'Execution Error:'}</div>
                <div className="whitespace-pre-wrap">{error}</div>
              </motion.div>
            )}

            {results && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-2xl"
              >
                <div className="flex justify-between items-center mb-4">
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>📋</span>
                    {isAr ? 'نتائج الاستعلام' : 'Query Results'}
                    <span className="text-[10px] text-slate-500 font-mono">({results.length} rows)</span>
                  </div>
                  {results.length > 0 && (
                    <button
                      onClick={exportCSV}
                      className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 text-xs font-bold rounded-lg transition"
                    >
                      📥 {isAr ? 'تصدير CSV' : 'Export CSV'}
                    </button>
                  )}
                </div>

                {results.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 text-xs italic">
                    {isAr ? 'الاستعلام نجح ولكن لم يعقد أي نتائج.' : 'Query succeeded but returned no rows.'}
                  </div>
                ) : (
                  <div className="max-h-96 overflow-auto border border-slate-850 rounded-xl bg-slate-950/40">
                    <table className="w-full text-left text-[10px] font-mono border-collapse">
                      <thead className="bg-slate-900/80 sticky top-0 border-b border-slate-800 text-slate-500 uppercase tracking-wider text-[8px] font-black">
                        <tr>
                          {Object.keys(results[0]).map((key) => (
                            <th key={key} className="py-2.5 px-3 whitespace-nowrap">{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {results.map((row, i) => (
                          <tr key={i} className="hover:bg-slate-850/30 transition-colors">
                            {Object.keys(results[0]).map((key) => {
                              const val = row[key];
                              return (
                                <td key={key} className="py-2.5 px-3 text-slate-300 max-w-xs truncate" title={String(val)}>
                                  {val === null || val === undefined ? (
                                    <span className="text-red-500/50 italic">null</span>
                                  ) : typeof val === 'object' ? (
                                    JSON.stringify(val)
                                  ) : (
                                    String(val)
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
