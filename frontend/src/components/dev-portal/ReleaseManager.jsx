import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';

export default function ReleaseManager({ API_URL, token, isAr }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [metadata, setMetadata] = useState({
    latestVersion: '2.1.0',
    latestBuild: 3,
    minimumSupportedVersion: '2.1.0',
    minimumSupportedBuild: 3,
    downloadUrl: '/Manar_Schedule.apk',
    fullDownloadUrl: 'https://almanar-schedule-system.onrender.com/Manar_Schedule.apk',
    apkSizeBytes: 62288630,
    apkHashSha256: '',
    releaseNotes: [],
    releaseDate: new Date().toISOString().split('T')[0]
  });

  const [notesText, setNotesText] = useState('');

  const fetchReleaseMetadata = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/admin/dev/release-metadata`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success && res.data.data) {
        const d = res.data.data;
        setMetadata({
          latestVersion: d.latestVersion || '2.1.0',
          latestBuild: d.latestBuild || 3,
          minimumSupportedVersion: d.minimumSupportedVersion || d.latestVersion || '2.1.0',
          minimumSupportedBuild: d.minimumSupportedBuild || d.latestBuild || 3,
          downloadUrl: d.downloadUrl || '/Manar_Schedule.apk',
          fullDownloadUrl: d.fullDownloadUrl || 'https://almanar-schedule-system.onrender.com/Manar_Schedule.apk',
          apkSizeBytes: d.apkSizeBytes || 62288630,
          apkHashSha256: d.apkHashSha256 || '',
          releaseNotes: Array.isArray(d.releaseNotes) ? d.releaseNotes : [],
          releaseDate: d.releaseDate || new Date().toISOString().split('T')[0]
        });
        setNotesText(Array.isArray(d.releaseNotes) ? d.releaseNotes.join('\n') : '');
      }
    } catch (err) {
      console.error('Fetch release metadata error:', err);
      toast.error(isAr ? 'فشل تحميل بيانات التحديث الحالية' : 'Failed to fetch current release metadata');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReleaseMetadata();
  }, []);

  const handlePublishRelease = async (e) => {
    e.preventDefault();
    setSaving(true);

    const notesList = notesText
      .split('\n')
      .map(n => n.trim())
      .filter(Boolean);

    const payload = {
      ...metadata,
      latestBuild: parseInt(metadata.latestBuild) || 1,
      minimumSupportedBuild: parseInt(metadata.minimumSupportedBuild) || 1,
      apkSizeBytes: parseInt(metadata.apkSizeBytes) || 0,
      releaseNotes: notesList
    };

    try {
      const res = await axios.post(`${API_URL}/api/admin/dev/release-metadata`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        toast.success(res.data.message || (isAr ? 'تم نشر وتعميم التحديث بنجاح' : 'Release published & broadcast successfully'));
        fetchReleaseMetadata();
      }
    } catch (err) {
      console.error('Publish release error:', err);
      toast.error(err.response?.data?.error || (isAr ? 'فشل نشر التحديث' : 'Failed to publish release'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-white/50">
        <div className="w-8 h-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <span>{isAr ? 'جاري جلب إعدادات التحديثات...' : 'Loading release metadata...'}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-900/40 via-purple-900/30 to-black/60 border border-white/10 rounded-2xl p-6 relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-[var(--accent)]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">🚀</span>
              <h2 className="text-base font-black text-white uppercase tracking-wider">
                {isAr ? 'مُدير التحديثات والإصدارات الحية' : 'Live In-App Release & Update Manager'}
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                ACTIVE PIPELINE
              </span>
            </div>
            <p className="text-xs text-white/60">
              {isAr
                ? 'إطلاق تحديث جديد يتيح لك بث إشعار فوري لجميع مستخدمي الويب والموبايل مع إمكانية التحديث المباشر من داخل التطبيق.'
                : 'Publishing a new release triggers immediate SSE broadcast to all active web & mobile apps for instant upgrading.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-center font-mono">
              <span className="text-[9px] text-white/40 block uppercase">{isAr ? 'الإصدار الحالي' : 'Current Release'}</span>
              <span className="text-sm font-bold text-[var(--accent)]">v{metadata.latestVersion} ({metadata.latestBuild})</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Release Form */}
      <form onSubmit={handlePublishRelease} className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Version & Files */}
        <div className="md:col-span-2 space-y-6">
          
          <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-xl space-y-4">
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-3">
              <span>🏷️</span>
              <span>{isAr ? 'تفاصيل الإصدار الجديد (Semantic Versioning)' : 'Release Version Info'}</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-white/50 uppercase mb-1">
                  {isAr ? 'رقم الإصدار الجديد (latestVersion)' : 'Latest Version Name'}
                </label>
                <input
                  type="text"
                  required
                  value={metadata.latestVersion}
                  onChange={e => setMetadata({ ...metadata, latestVersion: e.target.value })}
                  placeholder="2.2.0"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-sm focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-white/50 uppercase mb-1">
                  {isAr ? 'رقم البناء (latestBuild)' : 'Latest Build Number'}
                </label>
                <input
                  type="number"
                  required
                  value={metadata.latestBuild}
                  onChange={e => setMetadata({ ...metadata, latestBuild: e.target.value })}
                  placeholder="4"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-sm focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-white/50 uppercase mb-1">
                  {isAr ? 'أدنى إصدار مدعوم (minimumSupportedVersion)' : 'Min Supported Version'}
                </label>
                <input
                  type="text"
                  required
                  value={metadata.minimumSupportedVersion}
                  onChange={e => setMetadata({ ...metadata, minimumSupportedVersion: e.target.value })}
                  placeholder="2.1.0"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-sm focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-white/50 uppercase mb-1">
                  {isAr ? 'أدنى بناء مدعوم (minimumSupportedBuild)' : 'Min Supported Build'}
                </label>
                <input
                  type="number"
                  required
                  value={metadata.minimumSupportedBuild}
                  onChange={e => setMetadata({ ...metadata, minimumSupportedBuild: e.target.value })}
                  placeholder="3"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-sm focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-xl space-y-4">
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-3">
              <span>📦</span>
              <span>{isAr ? 'روابط التحقق والتحميل APK' : 'APK & Binary Assets Metadata'}</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-white/50 uppercase mb-1">
                  {isAr ? 'مسار التنزيل المحلي / APK Download Path' : 'Local Download Path'}
                </label>
                <input
                  type="text"
                  required
                  value={metadata.downloadUrl}
                  onChange={e => setMetadata({ ...metadata, downloadUrl: e.target.value })}
                  placeholder="/Manar_Schedule.apk"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-xs focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-white/50 uppercase mb-1">
                  {isAr ? 'الرابط الكامل المباشر / Full Remote URL' : 'Full Download URL'}
                </label>
                <input
                  type="url"
                  value={metadata.fullDownloadUrl}
                  onChange={e => setMetadata({ ...metadata, fullDownloadUrl: e.target.value })}
                  placeholder="https://almanar-schedule-system.onrender.com/Manar_Schedule.apk"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-xs focus:border-[var(--accent)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-white/50 uppercase mb-1">
                    {isAr ? 'حجم ملف الـ APK بالبايت (Bytes)' : 'APK Size (Bytes)'}
                  </label>
                  <input
                    type="number"
                    value={metadata.apkSizeBytes}
                    onChange={e => setMetadata({ ...metadata, apkSizeBytes: e.target.value })}
                    placeholder="62288630"
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-xs focus:border-[var(--accent)] focus:outline-none"
                  />
                  <span className="text-[9px] text-white/30 font-mono mt-1 block">
                    ~{(metadata.apkSizeBytes / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-white/50 uppercase mb-1">
                    {isAr ? 'بصمة SHA-256 لسلامة التثبيت' : 'APK SHA-256 Hash'}
                  </label>
                  <input
                    type="text"
                    value={metadata.apkHashSha256}
                    onChange={e => setMetadata({ ...metadata, apkHashSha256: e.target.value })}
                    placeholder="2FD3611E0CA467528FC921BA7BBFE2A..."
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-xs focus:border-[var(--accent)] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Notes & Action */}
        <div className="space-y-6">
          <div className="bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-xl space-y-4">
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-3">
              <span>📝</span>
              <span>{isAr ? 'ملاحظات وتفاصيل التحديث' : 'Release Notes & Changelog'}</span>
            </h3>

            <div>
              <label className="block text-[10px] font-bold text-white/50 uppercase mb-1">
                {isAr ? 'اكتب كل مميزة في سطر مستقل:' : 'Enter one feature line per row:'}
              </label>
              <textarea
                rows={8}
                value={notesText}
                onChange={e => setNotesText(e.target.value)}
                placeholder={isAr ? "تحسين سرعة مزامنة الجداول\nإضافة إشعار التحديث الفوري المباشر\nحل مشكلة تسجيل الدخول في وضع عدم الاتصال" : "Improved schedule sync speed\nAdded live update notification modal\nFixed offline authentication"}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-xs leading-relaxed focus:border-[var(--accent)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-white/50 uppercase mb-1">
                {isAr ? 'تاريخ الإصدار (releaseDate)' : 'Release Date'}
              </label>
              <input
                type="date"
                value={metadata.releaseDate}
                onChange={e => setMetadata({ ...metadata, releaseDate: e.target.value })}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white font-mono text-xs focus:border-[var(--accent)] focus:outline-none"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-blue-600 via-[var(--accent)] to-purple-600 text-white font-black hover:shadow-[0_0_25px_rgba(41,121,255,0.4)] transition-all text-xs uppercase tracking-widest disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {saving ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{isAr ? '🚀 نشر وتعميم التحديث الآن' : '🚀 Publish & Broadcast Release Now'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </form>
    </div>
  );
}
