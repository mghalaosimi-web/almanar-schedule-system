import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

export default function ApiRequestInspector({ API_URL, token, isAr }) {
  const [requests, setRequests] = useState([]);
  const [methodFilter, setMethodFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | 2XX | 4XX | 5XX
  const [isLive, setIsLive] = useState(true);
  const sseRef = useRef(null);

  const [blockedIps, setBlockedIps] = useState([]);
  const [newIp, setNewIp] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [firewallLoading, setFirewallLoading] = useState(false);

  const fetchBlockedIps = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/dev/firewall/blocked`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setBlockedIps(res.data.data || []);
      }
    } catch (_) {}
  }, [API_URL, token]);

  useEffect(() => {
    fetchBlockedIps();
  }, [fetchBlockedIps]);

  const handleBlockIp = async (e) => {
    e.preventDefault();
    if (!newIp) return;
    setFirewallLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/admin/dev/firewall/block`, {
        ip: newIp,
        reason: blockReason
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setNewIp('');
        setBlockReason('');
        fetchBlockedIps();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFirewallLoading(false);
    }
  };

  const handleUnblockIp = async (ip) => {
    if (!window.confirm(isAr ? `هل تريد إلغاء حظر IP ${ip}؟` : `Are you sure you want to unblock ${ip}?`)) return;
    try {
      const res = await axios.post(`${API_URL}/api/admin/dev/firewall/unblock`, { ip }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        fetchBlockedIps();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRecent = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/admin/dev/recent-requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setRequests(res.data.data || []);
      }
    } catch (_) {}
  }, [API_URL, token]);

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  // Connect to SSE
  useEffect(() => {
    if (!isLive) {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
      return;
    }

    const sseUrl = `${API_URL}/api/admin/dev/request-stream?token=${token}`;
    const sse = new EventSource(sseUrl);
    sseRef.current = sse;

    sse.onmessage = (event) => {
      try {
        const reqData = JSON.parse(event.data);
        setRequests(prev => [reqData, ...prev].slice(0, 100));
      } catch (_) {}
    };

    sse.onerror = () => {
      console.warn('[SSE] API Request stream disconnected. Retrying...');
    };

    return () => {
      sse.close();
      sseRef.current = null;
    };
  }, [isLive, API_URL, token]);

  const clearInspector = () => {
    setRequests([]);
  };

  // Stats calculation
  const totalCount = requests.length;
  const avgLatency = totalCount > 0
    ? Math.round(requests.reduce((sum, r) => sum + r.latency, 0) / totalCount)
    : 0;
  const errorRate = totalCount > 0
    ? Math.round((requests.filter(r => r.status >= 500).length / totalCount) * 100)
    : 0;
  const warningsCount = requests.filter(r => r.latency > 500 || r.status >= 500).length;

  const filteredRequests = requests.filter(r => {
    const matchMethod = methodFilter === 'ALL' || r.method === methodFilter;
    const matchStatus = statusFilter === 'ALL' ||
      (statusFilter === '2XX' && r.status >= 200 && r.status < 300) ||
      (statusFilter === '4XX' && r.status >= 400 && r.status < 500) ||
      (statusFilter === '5XX' && r.status >= 500);
    return matchMethod && matchStatus;
  });

  return (
    <div className="space-y-6">
      {/* Real-time stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: isAr ? 'رادار SSE متصل' : 'SSE Radar',
            value: isLive ? (isAr ? 'مباشر 🟢' : 'LIVE 🟢') : (isAr ? 'متوقف 🔴' : 'PAUSED 🔴'),
            color: isLive ? 'text-emerald-400' : 'text-red-400'
          },
          {
            label: isAr ? 'متوسط الاستجابة' : 'Avg Latency',
            value: `${avgLatency} ms`,
            color: avgLatency < 100 ? 'text-emerald-400' : avgLatency < 300 ? 'text-amber-400' : 'text-red-400'
          },
          {
            label: isAr ? 'معدل الأخطاء (5xx)' : 'Server Errors %',
            value: `${errorRate}%`,
            color: errorRate === 0 ? 'text-slate-400' : 'text-red-400'
          },
          {
            label: isAr ? 'تنبيهات الأداء البطئ' : 'Slow Requests',
            value: warningsCount,
            color: warningsCount === 0 ? 'text-slate-500' : 'text-amber-400'
          }
        ].map((c, i) => (
          <div key={i} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">{c.label}</span>
            <div className={`text-lg font-black font-mono ${c.color}`}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Main Panel */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-5 shadow-2xl">
        {/* Controls */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5 border-b border-slate-800/60 pb-4">
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-emerald-500 animate-ping' : 'bg-red-500'}`} />
              {isAr ? 'رادار شبكة الـ API المباشر' : 'Live API Network Inspector'}
            </h3>
            <p className="text-[9px] text-slate-500 mt-0.5">
              {isAr ? 'يراقب ويعرض كل طلب يصل للخادم لحظياً عبر SSE دون الحاجة لتحديث الصفحة.' : 'Monitor incoming API requests, payloads, status code and server response latency in real-time.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setIsLive(!isLive)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition ${
                isLive
                  ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25'
              }`}
            >
              {isLive ? (isAr ? 'إيقاف مؤقت ⏸️' : 'Pause SSE ⏸️') : (isAr ? 'تشغيل حي 🟢' : 'Resume LIVE 🟢')}
            </button>
            <button
              onClick={clearInspector}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg transition"
            >
              {isAr ? 'مسح الرادار 🧹' : 'Clear Log 🧹'}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-4">
          {/* Method Selector */}
          <div className="flex gap-1">
            {['ALL', 'GET', 'POST', 'DELETE'].map(m => (
              <button
                key={m}
                onClick={() => setMethodFilter(m)}
                className={`px-2.5 py-1 rounded-md text-[9px] font-bold border transition ${
                  methodFilter === m
                    ? 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                    : 'bg-slate-950 border-slate-850 text-slate-500 hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Status Selector */}
          <div className="flex gap-1">
            {['ALL', '2XX', '4XX', '5XX'].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-md text-[9px] font-bold border transition ${
                  statusFilter === s
                    ? 'bg-purple-500/15 border-purple-500/30 text-purple-400'
                    : 'bg-slate-950 border-slate-850 text-slate-500 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Request stream log */}
        <div className="max-h-96 overflow-y-auto border border-slate-850 rounded-xl bg-slate-950/45">
          {filteredRequests.length === 0 ? (
            <div className="py-12 text-center text-slate-650 text-xs italic">
              {isAr ? 'لا توجد طلبات في طابور الرادار حالياً' : 'No network activity captured yet.'}
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-[10px] font-mono">
              <thead className="bg-slate-900 sticky top-0 border-b border-slate-800 text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-2 px-3">{isAr ? 'الحدث' : 'Method'}</th>
                  <th className="py-2 px-3">{isAr ? 'مسار الـ API' : 'Endpoint Path'}</th>
                  <th className="py-2 px-3 text-center">{isAr ? 'الحالة' : 'Status'}</th>
                  <th className="py-2 px-3 text-center">{isAr ? 'زمن الاستجابة' : 'Latency'}</th>
                  <th className="py-2 px-3 text-center">{isAr ? 'المرسل' : 'Invoker'}</th>
                  <th className="py-2 px-3 text-center">{isAr ? 'عنوان IP' : 'IP'}</th>
                  <th className="py-2 px-3 text-right">{isAr ? 'التوقيت' : 'Time'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40">
                <AnimatePresence>
                  {filteredRequests.map((req) => {
                    const isSlow = req.latency > 500;
                    const isErr = req.status >= 500;

                    return (
                      <motion.tr
                        key={req.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0 }}
                        className={`hover:bg-slate-850/20 transition-colors ${
                          isErr ? 'bg-red-500/5' : isSlow ? 'bg-amber-500/5' : ''
                        }`}
                      >
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black ${
                            req.method === 'GET' ? 'bg-blue-500/10 text-blue-400' :
                            req.method === 'POST' ? 'bg-emerald-500/10 text-emerald-400' :
                            'bg-red-500/10 text-red-400'
                          }`}>
                            {req.method}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-350 select-all max-w-xs truncate" title={req.path}>
                          {req.path}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-1.5 py-0.5 rounded-full font-bold ${
                            req.status < 300 ? 'text-emerald-400 bg-emerald-500/10' :
                            req.status < 500 ? 'text-amber-400 bg-amber-500/10' :
                            'text-red-400 bg-red-500/10'
                          }`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center font-bold">
                          <span className={isSlow ? 'text-amber-400 animate-pulse' : 'text-slate-400'}>
                            {req.latency} ms
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center text-slate-400 truncate max-w-[100px]" title={req.user}>
                          {req.user.split('@')[0]}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-500 font-mono">
                          {req.ip}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-550">
                          {new Date(req.timestamp).toLocaleTimeString(isAr ? 'ar-EG' : 'en-US')}
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Firewall & IP Banning Panel ── */}
      <div className="bg-slate-900/60 backdrop-blur-xl border border-red-500/20 rounded-2xl p-5 shadow-2xl">
        <h3 className="text-xs font-bold text-white flex items-center gap-2 mb-1">
          <span className="text-red-400">🛡️</span>
          {isAr ? 'جدار الحماية والتحكم في حظر الـ IP' : 'Firewall & IP Access Control'}
        </h3>
        <p className="text-[9px] text-slate-500 mb-5">
          {isAr ? 'حظر عناوين IP المشبوهة أو الضارة فورياً لمنعها من الوصول لأي مستأجر في النظام.' : 'Immediately block malicious or abusive IP addresses from accessing any tenant endpoint.'}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Block Form */}
          <div className="lg:col-span-1 bg-slate-950/40 border border-slate-800 rounded-xl p-4">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-3">
              {isAr ? 'حظر عنوان جديد' : 'Block New IP'}
            </h4>
            <form onSubmit={handleBlockIp} className="space-y-3">
              <div>
                <label className="block text-[8px] font-bold text-slate-500 uppercase mb-1">{isAr ? 'عنوان IP' : 'IP Address'}</label>
                <input
                  type="text"
                  value={newIp}
                  onChange={e => setNewIp(e.target.value)}
                  placeholder="e.g. 192.168.1.50"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-[10px] text-slate-200 focus:outline-none focus:border-red-500/50 font-mono"
                />
              </div>
              <div>
                <label className="block text-[8px] font-bold text-slate-500 uppercase mb-1">{isAr ? 'سبب الحظر' : 'Reason'}</label>
                <input
                  type="text"
                  value={blockReason}
                  onChange={e => setBlockReason(e.target.value)}
                  placeholder={isAr ? 'السبب للتسجيل...' : 'e.g. Bruteforce attempt'}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-[10px] text-slate-200 focus:outline-none focus:border-red-500/50"
                />
              </div>
              <button
                type="submit"
                disabled={firewallLoading || !newIp}
                className="w-full py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold rounded-lg text-[10px] transition duration-200 shadow-md shadow-red-600/10 flex justify-center items-center gap-1"
              >
                <span>🚫</span>
                <span>{isAr ? 'حظر العنوان الآن' : 'Apply Block'}</span>
              </button>
            </form>
          </div>

          {/* Blocked List Table */}
          <div className="lg:col-span-2 bg-slate-950/40 border border-slate-800 rounded-xl p-4 overflow-hidden flex flex-col">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase mb-3 flex justify-between">
              <span>{isAr ? 'قائمة العناوين المحظورة' : 'Blocked IP Register'}</span>
              <span className="text-[9px] text-slate-600 font-mono font-normal">{blockedIps.length} {isAr ? 'عنوان' : 'IPs'}</span>
            </h4>
            <div className="flex-1 overflow-y-auto max-h-48 border border-slate-850 rounded-lg bg-slate-950/30">
              {blockedIps.length === 0 ? (
                <div className="py-10 text-center text-slate-600 text-[10px] italic">
                  {isAr ? 'لا توجد عناوين محظورة حالياً.' : 'No blocked IP addresses in the system.'}
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-[10px] font-mono">
                  <thead className="bg-slate-900 sticky top-0 border-b border-slate-800 text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-2 px-3">{isAr ? 'عنوان IP' : 'IP Address'}</th>
                      <th className="py-2 px-3">{isAr ? 'السبب' : 'Reason'}</th>
                      <th className="py-2 px-3">{isAr ? 'تاريخ الحظر' : 'Blocked At'}</th>
                      <th className="py-2 px-3 text-right">{isAr ? 'الإجراء' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/50">
                    {blockedIps.map((ipRow) => (
                      <tr key={ipRow.id} className="hover:bg-slate-850/10 transition-colors">
                        <td className="py-2 px-3 font-bold text-red-400 select-all">{ipRow.ip}</td>
                        <td className="py-2 px-3 text-slate-400 font-sans">{ipRow.reason || '—'}</td>
                        <td className="py-2 px-3 text-slate-500 text-[9px]">
                          {new Date(ipRow.blockedAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => handleUnblockIp(ipRow.ip)}
                            className="px-2 py-0.5 border border-emerald-500/30 hover:border-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 font-bold rounded text-[9px] transition"
                          >
                            {isAr ? 'إلغاء الحظر' : 'Unblock'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
