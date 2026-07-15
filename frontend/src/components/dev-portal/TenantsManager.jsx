import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import ConfirmationModal from '../../ConfirmationModal';

export default function TenantsManager({ API_URL, token, onImpersonate, isAr }) {
  const [universities, setUniversities] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [editType, setEditType] = useState(null); // 'UNI' or 'COLLEGE'
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [logoBase64, setLogoBase64] = useState('');

  // DB Inputs State
  const [dbInputs, setDbInputs] = useState({});
  const [dbInputVisibility, setDbInputVisibility] = useState({});
  const [isTestingConnection, setIsTestingConnection] = useState({});

  // Kill-Switch Modal State
  const [killSwitchPending, setKillSwitchPending] = useState(null); // { tenantConfigId, currentStatus }

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/admin/dev/tenant-configs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setUniversities(res.data.data.universities || []);
        setColleges(res.data.data.colleges || []);
      }
    } catch (err) {
      toast.error(isAr ? 'فشل تحميل بيانات المستأجرين' : 'Failed to fetch tenants data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoBase64(reader.result);
      setFormData(prev => ({ ...prev, logoUrl: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleEditClick = (type, item) => {
    setEditType(type);
    setEditId(item.id);
    setLogoBase64(item.logoUrl || '');
    if (type === 'UNI') {
      setFormData({
        name: item.name,
        slug: item.slug,
        themeColor: item.themeColor,
        logoUrl: item.logoUrl,
        enforceSSL: item.tenantConfig?.enforceSSL ?? true,
        allowedDomains: item.tenantConfig?.allowedDomains?.join(', ') ?? ''
      });
    } else {
      setFormData({
        name: item.name,
        slug: item.slug,
        universityId: item.universityId,
        themeColor: item.themeColor,
        logoUrl: item.logoUrl,
        enforceSSL: item.tenantConfig?.enforceSSL ?? true,
        allowedDomains: item.tenantConfig?.allowedDomains?.join(', ') ?? ''
      });
    }
    setShowModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        slug: formData.slug,
        themeColor: formData.themeColor,
        logoUrl: formData.logoUrl,
        enforceSSL: !!formData.enforceSSL,
        allowedDomains: formData.allowedDomains ? formData.allowedDomains.split(',').map(d => d.trim()).filter(Boolean) : []
      };

      let endpoint = '';
      if (editType === 'UNI') {
        endpoint = `/api/admin/dev/tenant-configs/universities/${editId}`;
      } else {
        payload.universityId = formData.universityId;
        endpoint = `/api/admin/dev/tenant-configs/colleges/${editId}`;
      }

      const res = await axios.post(`${API_URL}${endpoint}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        toast.success(isAr ? 'تم تحديث إعدادات المستأجر بنجاح' : 'Tenant settings updated successfully');
        setShowModal(false);
        fetchTenants();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل التحديث' : 'Failed to update tenant'));
    }
  };

  // --- Dynamic Routing & DB Bridges Functions ---

  const handleGenerateKey = async (collegeId) => {
    try {
      const res = await axios.post(`${API_URL}/api/admin/dev/generate-tenant-key`, { collegeId }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        toast.success(isAr ? 'تم إنشاء مفتاح الترخيص بنجاح' : 'License Key generated successfully');
        fetchTenants();
      }
    } catch (err) {
      toast.error(isAr ? 'فشل إنشاء المفتاح' : 'Failed to generate key');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success(isAr ? 'تم نسخ المفتاح' : 'Key copied to clipboard');
  };

  const handleInjectDbString = async (tenantConfigId) => {
    const dbUrl = dbInputs[tenantConfigId];
    if (!dbUrl) {
      return toast.error(isAr ? 'الرجاء إدخال نص الاتصال' : 'Please enter a connection string');
    }
    setIsTestingConnection(prev => ({ ...prev, [tenantConfigId]: true }));
    try {
      const res = await axios.post(`${API_URL}/api/admin/dev/inject-db-string`, { 
        tenantConfigId, 
        databaseUrlOverride: dbUrl 
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        toast.success(isAr ? 'تم دمج الاتصال بقاعدة البيانات بنجاح' : 'Database connection validated & injected');
        setDbInputs(prev => ({ ...prev, [tenantConfigId]: '' }));
        fetchTenants();
      }
    } catch (err) {
      // 422 Unprocessable Entity - validation failed
      const msg = err.response?.data?.error || (isAr ? 'فشل دمج الاتصال' : 'Failed to inject DB string');
      toast.error(msg, { duration: 5000 });
    } finally {
      setIsTestingConnection(prev => ({ ...prev, [tenantConfigId]: false }));
    }
  };

  const executeLicenseToggle = async (tenantConfigId, currentStatus) => {
    try {
      const res = await axios.post(`${API_URL}/api/admin/dev/toggle-tenant-license`, {
        tenantConfigId,
        isLicenseActive: !currentStatus
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        toast.success(!currentStatus
          ? (isAr ? 'تم تفعيل الترخيص' : 'License activated')
          : (isAr ? 'تم إيقاف الترخيص' : 'License deactivated'));
        fetchTenants();
      }
    } catch (err) {
      toast.error(isAr ? 'فشل تغيير حالة الترخيص' : 'Failed to toggle license');
    }
  };

  const handleToggleLicense = (tenantConfigId, currentStatus) => {
    if (currentStatus) {
      // Revoking license — show fail-safe confirmation modal instead of window.confirm
      setKillSwitchPending({ tenantConfigId, currentStatus });
      return;
    }
    // Activating license — no confirmation needed
    executeLicenseToggle(tenantConfigId, currentStatus);
  };

  return (
    <div className="space-y-8 font-sans">
      {/* Universities Cyber Grid */}
      <div className="relative bg-[#050505]/90 backdrop-blur-3xl border border-teal-500/30 rounded-2xl p-6 shadow-[0_0_40px_rgba(20,184,166,0.15)] overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400 mb-2 flex items-center gap-2">
          <span>🏛️</span>
          {isAr ? 'إدارة الجامعات' : 'Universities Core'}
        </h3>
        <p className="text-xs text-slate-400 mb-6 font-mono tracking-widest uppercase">
          {isAr ? 'النطاقات الجذرية وإعدادات الأمان' : 'Root domains & Security settings'}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
          {universities.map(uni => (
            <div key={uni.id} className="p-4 bg-black/60 border border-teal-900/50 hover:border-teal-500/50 rounded-xl flex justify-between items-center transition-all group">
              <div className="flex items-center gap-3">
                {uni.logoUrl ? (
                  <img src={uni.logoUrl} alt="Logo" className="w-12 h-12 rounded-lg object-contain bg-black border border-slate-800 p-1" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 shadow-inner">🎓</div>
                )}
                <div>
                  <h4 className="text-sm font-bold text-slate-100 group-hover:text-teal-400 transition-colors">{uni.name}</h4>
                  <span className="text-[10px] text-teal-500/70 block font-mono mt-0.5 tracking-wider">{uni.slug}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleEditClick('UNI', uni)}
                  className="px-3 py-2 bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/30 rounded-lg text-xs font-bold transition-colors"
                >
                  {isAr ? '⚙️ تهيئة' : 'Config'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cyberpunk Colleges Grid */}
      <div className="relative bg-[#050505]/90 backdrop-blur-3xl border border-indigo-500/30 rounded-2xl p-6 shadow-[0_0_40px_rgba(99,102,241,0.15)] overflow-hidden">
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/10 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/2 pointer-events-none" />
        <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-2 flex items-center gap-2">
          <span>🏫</span>
          {isAr ? 'عُقد الكليات المستأجرة' : 'Tenant College Nodes'}
        </h3>
        <p className="text-xs text-slate-400 mb-6 font-mono tracking-widest uppercase">
          {isAr ? 'جسور قواعد البيانات ومفاتيح الترخيص' : 'Database Bridges & License Keys'}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          {colleges.map(col => (
            <div key={col.id} className="p-5 bg-black/60 border border-indigo-900/50 hover:border-indigo-500/30 rounded-xl flex flex-col gap-5 transition-all shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] relative overflow-hidden group">
              {/* Animated top border glow */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  {col.logoUrl ? (
                    <img src={col.logoUrl} alt="Logo" className="w-12 h-12 rounded-lg object-contain bg-black border border-slate-800 p-1" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 shadow-inner">🏢</div>
                  )}
                  <div>
                    <h4 className="text-sm font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">{col.name}</h4>
                    <span className="text-[10px] text-indigo-400/60 block mt-0.5 tracking-wider uppercase font-black">{col.university?.name}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleEditClick('COLLEGE', col)}
                  className="px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-bold transition-colors"
                >
                  {isAr ? '⚙️ تهيئة' : 'Config'}
                </button>
              </div>

              {/* Dynamic Routing & DB Bridges Panel (Cyberpunk style) */}
              <div className="bg-black/80 border border-slate-800 rounded-lg p-4 shadow-inner relative">
                <h5 className="text-[10px] font-black tracking-widest text-indigo-400 uppercase mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                  {isAr ? 'نظام التوجيه الديناميكي للبيانات' : 'Dynamic Routing & DB Bridges'}
                </h5>
                
                {/* Whitelabel Key */}
                <div className="flex items-center gap-2 mb-4">
                  {col.tenantConfig?.whitelabelKey ? (
                    <>
                      <div className="flex-1 bg-[#0a0a0a] border border-slate-700/50 rounded px-3 py-2 text-[10px] font-mono text-emerald-400/80 truncate flex items-center shadow-inner">
                        {col.tenantConfig.whitelabelKey}
                      </div>
                      <button 
                        onClick={() => copyToClipboard(col.tenantConfig.whitelabelKey)}
                        className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 rounded text-[10px] uppercase font-black transition-colors"
                      >
                        Copy
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => handleGenerateKey(col.id)}
                      className="px-4 py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/50 rounded text-[10px] uppercase font-black tracking-wider transition-all w-full flex justify-center shadow-[0_0_15px_rgba(79,70,229,0.15)]"
                    >
                      {isAr ? 'توليد مفتاح ترخيص مشفر' : 'Generate Secure License Key'}
                    </button>
                  )}
                </div>

                {/* Database Injector */}
                {col.tenantConfig?.id && (
                  <div className="flex flex-col gap-2 mb-4">
                    <div className="relative group/input">
                      <input 
                        type={dbInputVisibility[col.tenantConfig.id] ? "text" : "password"}
                        placeholder={isAr ? "رابط قاعدة البيانات (PostgreSQL URL)" : "Database URL Override"}
                        value={dbInputs[col.tenantConfig.id] ?? (col.tenantConfig.databaseUrlOverride || '')}
                        onChange={(e) => setDbInputs(prev => ({ ...prev, [col.tenantConfig.id]: e.target.value }))}
                        className="w-full bg-[#0a0a0a] border border-slate-700/50 rounded px-3 py-2 text-[10px] font-mono text-cyan-400 focus:outline-none focus:border-cyan-500/50 focus:shadow-[0_0_10px_rgba(6,182,212,0.2)] transition-all shadow-inner"
                      />
                      <button 
                        onClick={() => setDbInputVisibility(prev => ({ ...prev, [col.tenantConfig.id]: !prev[col.tenantConfig.id] }))}
                        className="absolute right-2 top-2 text-slate-600 hover:text-cyan-400 text-[10px] transition-colors"
                      >
                        {dbInputVisibility[col.tenantConfig.id] ? 'HIDE' : 'SHOW'}
                      </button>
                    </div>
                    
                    <button 
                      onClick={() => handleInjectDbString(col.tenantConfig.id)}
                      disabled={isTestingConnection[col.tenantConfig.id]}
                      className={`relative overflow-hidden px-4 py-2 rounded text-[10px] uppercase font-black tracking-widest transition-all w-full flex items-center justify-center gap-2 border ${
                        isTestingConnection[col.tenantConfig.id] 
                        ? 'bg-cyan-900/50 border-cyan-700 text-cyan-300/50 cursor-not-allowed'
                        : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:border-cyan-400/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer'
                      }`}
                    >
                      {isTestingConnection[col.tenantConfig.id] ? (
                        <>
                          <div className="h-3 w-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                          <span>{isAr ? 'جاري الفحص...' : 'Validating...'}</span>
                        </>
                      ) : (
                        <>
                          <span>⚡</span> {isAr ? 'حقن واختبار الاتصال' : 'Inject & Validate Connection'}
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* License Kill Switch */}
                {col.tenantConfig?.id && (
                  <div className="flex items-center justify-between bg-[#0a0a0a] p-3 rounded border border-slate-800 shadow-inner">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${col.tenantConfig.isLicenseActive ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`} />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        {isAr ? 'مفتاح الترخيص (Kill-Switch)' : 'Master Kill-Switch'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleToggleLicense(col.tenantConfig.id, col.tenantConfig.isLicenseActive)}
                      className={`relative inline-flex h-5 w-10 items-center rounded-full transition-all border ${
                        col.tenantConfig.isLicenseActive 
                        ? 'bg-emerald-500/20 border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]' 
                        : 'bg-red-500/20 border-red-500/50 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                      }`}
                    >
                      <span className={`inline-block h-3 w-3 transform rounded-full transition-all ${
                        col.tenantConfig.isLicenseActive 
                        ? 'translate-x-6 bg-emerald-400 shadow-[0_0_8px_#34d399]' 
                        : 'translate-x-1 bg-red-400 shadow-[0_0_8px_#f87171]'
                      }`} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal - Keeps consistent styling */}
      {showModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-[#050505] border border-indigo-500/30 rounded-2xl w-full max-w-md p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
            <h4 className="text-sm font-black text-white uppercase tracking-wider mb-6">
              {isAr ? 'تعديل هوية المستأجر' : 'Edit Tenant Branding'}
            </h4>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">{isAr ? 'الاسم' : 'Name'}</label>
                <input
                  type="text"
                  required
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-slate-800 focus:border-indigo-500/50 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">{isAr ? 'المعرف الفريد (Slug)' : 'Slug'}</label>
                <input
                  type="text"
                  required
                  value={formData.slug || ''}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-slate-800 focus:border-indigo-500/50 rounded-xl px-3 py-2.5 text-xs text-indigo-200 font-mono focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">{isAr ? 'اللون المميز للهوية (Hex Color)' : 'Theme HEX Color'}</label>
                <div className="flex gap-2">
                  <div className="w-10 h-10 rounded-lg border border-slate-800 shrink-0" style={{ backgroundColor: formData.themeColor || '#000' }} />
                  <input
                    type="text"
                    value={formData.themeColor || ''}
                    onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })}
                    className="w-full bg-[#0a0a0a] border border-slate-800 focus:border-indigo-500/50 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">{isAr ? 'تحميل الشعار الجديد' : 'Upload Branding Logo'}</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-indigo-500/10 file:text-indigo-400 hover:file:bg-indigo-500/20"
                />
                {logoBase64 && (
                  <img src={logoBase64} alt="Preview" className="w-16 h-16 rounded-xl mt-3 object-contain bg-black p-2 border border-slate-800 shadow-inner" />
                )}
              </div>

              <div className="flex items-center gap-3 py-3 border-y border-slate-800/50 mt-2">
                <input
                  type="checkbox"
                  id="enforceSSL"
                  checked={!!formData.enforceSSL}
                  onChange={(e) => setFormData({ ...formData, enforceSSL: e.target.checked })}
                  className="rounded border-slate-700 bg-black text-indigo-500 focus:ring-indigo-500 w-4 h-4"
                />
                <label htmlFor="enforceSSL" className="text-xs font-bold text-slate-300">
                  {isAr ? 'فرض حماية واتصال آمن (Enforce SSL/HTTPS)' : 'Enforce SSL / HTTPS Encryption'}
                </label>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 tracking-wider">
                  {isAr ? 'النطاقات المعتمدة (مفصولة بفواصل)' : 'Allowed Whitelisted Domains'}
                </label>
                <input
                  type="text"
                  placeholder="mghal.com, almanar.edu.ye"
                  value={formData.allowedDomains || ''}
                  onChange={(e) => setFormData({ ...formData, allowedDomains: e.target.value })}
                  className="w-full bg-[#0a0a0a] border border-slate-800 focus:border-indigo-500/50 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                />
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 bg-transparent border border-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all"
                >
                  {isAr ? 'حفظ التعديلات' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Kill-Switch Fail-Safe Confirmation Modal */}
      {killSwitchPending && (
        <ConfirmationModal
          isOpen={true}
          title={isAr ? '⚠️ تحذير: مفتاح إيقاف الترخيص' : '⚠️ License Kill-Switch Confirm'}
          message={
            isAr
              ? 'سيتم إيقاف الترخيص وإلغاء جميع الجلسات النشطة فوراً. لا يمكن التراجع عن هذا الإجراء. هل أنت متأكد؟'
              : 'This will immediately revoke the license and terminate all active sessions. This action cannot be undone. Proceed?'
          }
          confirmText={isAr ? 'نعم، إيقاف الترخيص' : 'Yes, Revoke License'}
          cancelText={isAr ? 'إلغاء' : 'Cancel'}
          onConfirm={() => {
            const { tenantConfigId, currentStatus } = killSwitchPending;
            setKillSwitchPending(null);
            executeLicenseToggle(tenantConfigId, currentStatus);
          }}
          onCancel={() => setKillSwitchPending(null)}
        />
      )}
    </div>
  );
}
