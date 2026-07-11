import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from './config';
import { toast } from 'react-hot-toast';
import ErrorModal from './ErrorModal';

/* ── Circular Telemetry Dial ────────────────────────────────────── */
function TelemetryDial({ percentage, value, label, sublabel, color = 'var(--accent)', icon }) {
  const radius = 50;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(Math.max(percentage, 0), 100) / 100) * circumference;

  return (
    <motion.div
      whileHover={{ y: -4, border: `1px solid ${color}30`, boxShadow: `0 12px 30px ${color}0c` }}
      className="frosted-panel rounded-3xl p-6 border border-white/5 bg-white/2 flex items-center justify-between gap-6 relative overflow-hidden transition-all duration-300"
    >
      <div className="absolute top-[-10px] right-[-10px] text-7xl opacity-5 select-none pointer-events-none" style={{ color }}>
        {icon}
      </div>
      
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-white/50 text-[10px] font-black tracking-wider uppercase">
          <span>{icon}</span>
          <span>{label}</span>
        </div>
        <h3 className="text-2xl font-black text-white font-mono">{value}</h3>
        {sublabel && <p className="text-[10px] text-white/40 font-mono">{sublabel}</p>}
      </div>

      <div className="relative flex items-center justify-center shrink-0 w-24 h-24">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <motion.circle
            cx="48"
            cy="48"
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: 'easeOut' }}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-xs font-mono font-black text-white">{Math.round(percentage)}%</span>
      </div>
    </motion.div>
  );
}

/* ── Interactive Switch Toggle ─────────────────────────────────── */
function Toggle({ label, sublabel, value, onChange, accentColor = 'var(--accent)', disabled = false }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-white/5 last:border-b-0">
      <div>
        <p className="text-sm font-bold text-white">{label}</p>
        {sublabel && <p className="text-[11px] mt-0.5 font-mono text-[var(--text-secondary)]">{sublabel}</p>}
      </div>
      <motion.button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!value)}
        whileTap={{ scale: disabled ? 1 : 0.93 }}
        className="relative shrink-0 w-12 h-6 rounded-full transition-colors duration-300 disabled:opacity-40"
        style={{
          background: value ? accentColor : 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <motion.div
          animate={{ x: value ? 24 : 2 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="absolute top-0.5 w-5 h-5 rounded-full"
          style={{ background: value ? '#000' : '#888' }}
        />
      </motion.button>
    </div>
  );
}

const formatDateSafe = (dateVal, includeTime = true) => {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '—';
    return includeTime ? d.toLocaleString() : d.toLocaleDateString();
  } catch (e) {
    return '—';
  }
};

const formatTimeSafe = (dateVal) => {
  if (!dateVal) return '—';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString();
  } catch (e) {
    return '—';
  }
};

export default function DevPortal() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();

  /* ── Core State variables ───────────────────────────────────── */
  const [telemetry, setTelemetry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'tenants', 'institutions', 'admins', 'directory', 'logs'
  const [executingAction, setExecutingAction] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Tenant customization configs state
  const [tenants, setTenants] = useState({ universities: [], colleges: [] });
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [editTenantModal, setEditTenantModal] = useState({
    open: false,
    configId: null,
    universityId: null,
    collegeId: null,
    name: '',
    type: 'university', // or 'college'
    themeColor: '',
    logoUrl: '',
    customDomain: '',
    features: {
      qrAttendance: false,
      pushNotifications: false,
      examsScheduler: false,
      emailDailySummary: false,
      analyticsDashboard: false
    }
  });

  // Institution Hierarchy Tree state
  const [treeData, setTreeData] = useState([]);
  const [treeLoading, setTreeLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState({});
  const [editModal, setEditModal] = useState({
    open: false,
    type: 'governorate', // governorate, university, college, department, major
    item: null,
    parentId: null,
    name: '',
    slug: '',
    themeColor: '',
    logoUrl: '',
    location: ''
  });

  // Sub-Admins state
  const [subAdmins, setSubAdmins] = useState([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'UNI_ADMIN', // LECTURER or COLLEGE_ADMIN etc.
    universityId: '',
    collegeId: ''
  });

  // God Mode User Directory state
  const [users, setUsers] = useState({ students: [], lecturers: [], admins: [] });
  const [usersLoading, setUsersLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL'); // ALL, STUDENT, LECTURER, ADMIN
  const [deletingUser, setDeletingUser] = useState({ open: false, type: '', id: null, name: '' });

  // Database Console states
  const [dbTables, setDbTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [tableData, setTableData] = useState(null);
  const [dbSearch, setDbSearch] = useState('');
  const [dbPage, setDbPage] = useState(1);
  const [dbLimit] = useState(15);
  const [dbLoading, setDbLoading] = useState(false);
  const [diagnostics, setDiagnostics] = useState(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState({ open: false, type: 'alert', title: '', message: '', onConfirm: null });

  /* ── Telemetry Fetcher ────────────────────────────────────────── */
  const fetchTelemetry = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.get(`${API_URL}/api/admin/dev/dashboard-telemetry`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setTelemetry(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch telemetry:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  /* ── Tenant Configs Fetcher ───────────────────────────────────── */
  const fetchTenantConfigs = async () => {
    setTenantsLoading(true);
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.get(`${API_URL}/api/admin/dev/tenant-configs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setTenants(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch tenant configs:', err);
    } finally {
      setTenantsLoading(false);
    }
  };

  /* ── Sub-Admins Fetcher ───────────────────────────────────────── */
  const fetchSubAdmins = async () => {
    setAdminsLoading(true);
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.get(`${API_URL}/api/admin/sub-admins`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setSubAdmins(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch sub admins:', err);
    } finally {
      setAdminsLoading(false);
    }
  };

  /* ── God Mode Users Fetcher ───────────────────────────────────── */
  const fetchGodModeUsers = async () => {
    setUsersLoading(true);
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.get(`${API_URL}/api/admin/god-mode/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setUsers(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setUsersLoading(false);
    }
  };

  /* ── Hierarchy Tree Fetcher ──────────────────────────────────── */
  const fetchHierarchyTree = async () => {
    setTreeLoading(true);
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.get(`${API_URL}/api/admin/dev/tree`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setTreeData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch tree data:', err);
    } finally {
      setTreeLoading(false);
    }
  };

  /* ── Database Console Fetchers ───────────────────────────────── */
  const fetchDbTables = async () => {
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.get(`${API_URL}/api/admin/dev/db/tables`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setDbTables(res.data.tables);
        if (res.data.tables.length > 0 && !selectedTable) {
          setSelectedTable(res.data.tables[0].name);
        }
      }
    } catch (err) {
      console.error('Failed to fetch DB tables:', err);
      toast.error(isAr ? 'فشل جلب جداول قاعدة البيانات' : 'Failed to fetch database tables');
    }
  };

  const fetchTableData = async (tableName = selectedTable, pageNum = dbPage, searchQuery = dbSearch) => {
    if (!tableName) return;
    setDbLoading(true);
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.get(`${API_URL}/api/admin/dev/db/query`, {
        params: { table: tableName, page: pageNum, limit: dbLimit, search: searchQuery },
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setTableData(res.data);
      }
    } catch (err) {
      console.error('Failed to query DB table:', err);
      toast.error(isAr ? 'فشل الاستعلام عن الجدول' : 'Failed to query table');
    } finally {
      setDbLoading(false);
    }
  };

  const fetchDbDiagnostics = async (silent = false) => {
    if (!silent) setDiagnosticsLoading(true);
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.get(`${API_URL}/api/admin/dev/db/diagnostics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setDiagnostics(res.data.diagnostics);
        if (!silent) toast.success(isAr ? 'اكتمل الفحص التشخيصي بنجاح!' : 'Diagnostic scan completed successfully!');
      }
    } catch (err) {
      console.error('Failed to fetch DB diagnostics:', err);
      if (!silent) toast.error(isAr ? 'فشل تشغيل الفحص التشخيصي' : 'Failed to run database diagnostics');
    } finally {
      if (!silent) setDiagnosticsLoading(false);
    }
  };

  const handleTableChange = (newTable) => {
    setSelectedTable(newTable);
    setDbPage(1);
    setDbSearch('');
  };

  /* ── Effects ────────────────────────────────────────────────── */
  useEffect(() => {
    fetchTelemetry();
    const interval = setInterval(() => fetchTelemetry(true), 12000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeTab === 'tenants' || activeTab === 'licenses') fetchTenantConfigs();
    if (activeTab === 'institutions') fetchHierarchyTree();
    if (activeTab === 'admins') {
      fetchSubAdmins();
      fetchTenantConfigs(); // to populate university/college dropdowns
    }
    if (activeTab === 'directory') fetchGodModeUsers();
    if (activeTab === 'database') {
      fetchDbTables();
      fetchDbDiagnostics(true);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'database' && selectedTable) {
      fetchTableData(selectedTable, dbPage, dbSearch);
    }
  }, [selectedTable, dbPage, dbSearch, activeTab]);

  /* ── Settings Switches Handler ────────────────────────────────── */
  const handleToggleSetting = async (key, value) => {
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.post(`${API_URL}/api/admin/dev/toggle-setting`,
        { key, value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        setTelemetry(prev => ({ ...prev, settings: res.data.settings }));
        showSuccessBanner(isAr ? 'تم تعديل الخيارات وحفظها على الخادم.' : 'Setting updated on server successfully.');
      }
    } catch (err) {
      toast.error(isAr ? 'فشل تعديل الخيار' : 'Failed to update setting');
    }
  };

  /* ── Developer Actions Handlers ──────────────────────────────── */
  const handleTriggerSeed = () => {
    setConfirmModal({
      open: true,
      type: 'confirm',
      title: isAr ? 'إعادة تهيئة البيانات الأساسية' : 'Run Database Seeding',
      message: isAr
        ? 'هل أنت متأكد من رغبتك في تشغيل بذور قاعدة البيانات الأساسية لتثبيت البيانات الأولية؟'
        : 'Are you sure you want to trigger backend database seeding? This will write default datasets.',
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, open: false }));
        setExecutingAction('seeding');
        try {
          const token = localStorage.getItem('manar_token');
          const res = await axios.post(`${API_URL}/api/admin/dev/actions/trigger-seed`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.data?.success) {
            showSuccessBanner(isAr ? 'تم تشغيل عملية Seeding بالخلفية!' : 'Seeding script successfully triggered!');
            fetchTelemetry(true);
          }
        } catch (err) {
          toast.error(isAr ? 'فشل بدء Seeding' : 'Failed to run seed script');
        } finally {
          setExecutingAction(null);
        }
      }
    });
  };

  const handleClearTestData = () => {
    setConfirmModal({
      open: true,
      type: 'confirm',
      title: isAr ? 'حذف وتطهير بيانات الطلاب التجريبية' : 'Purge All Student Data',
      message: isAr
        ? 'تحذير حاسم: سيقوم هذا الإجراء بحذف جميع حسابات الطلاب المسجلين وخططهم الدراسية وسجلات حضورهم بشكل كامل ونهائي. لا يمكن التراجع!'
        : 'CRITICAL WARNING: This will permanently delete all student accounts, attendance logs, and verifications. This action is irreversible!',
      onConfirm: async () => {
        setConfirmModal(m => ({ ...m, open: false }));
        setExecutingAction('clearing');
        try {
          const token = localStorage.getItem('manar_token');
          const res = await axios.post(`${API_URL}/api/admin/dev/actions/clear-test-data`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.data?.success) {
            showSuccessBanner(isAr ? 'تم تطهير وحذف كافة بيانات الطلاب بنجاح!' : 'All test student data purged successfully!');
            fetchTelemetry();
          }
        } catch (err) {
          toast.error(isAr ? 'فشل تطهير البيانات' : 'Failed to clear database');
        } finally {
          setExecutingAction(null);
        }
      }
    });
  };

  const handleTriggerAutomatedNotif = async (type) => {
    setExecutingAction(`notif-${type}`);
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.post(`${API_URL}/api/admin/trigger-automated-notif`, { type }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        showSuccessBanner(isAr ? 'تم تشغيل وإرسال التنبيهات التلقائية المستهدفة!' : 'Targeted automated notifications triggered successfully!');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل تشغيل التنبيهات' : 'Failed to trigger notifications'));
    } finally {
      setExecutingAction(null);
    }
  };

  /* ── Impersonation Preview Flow ────────────────────────────────── */
  const handleImpersonateUser = async (userType, id, name, role) => {
    try {
      const token = localStorage.getItem('manar_token');
      const currentUser = localStorage.getItem('manar_user');
      
      // Store original SUPER_ADMIN credentials
      localStorage.setItem('manar_super_admin_token', token);
      localStorage.setItem('manar_super_admin_user', currentUser);

      let payload = {};
      if (userType === 'student') payload.studentId = id;
      else if (userType === 'lecturer') payload.lecturerId = id;
      else if (userType === 'admin') payload.adminId = id;

      const res = await axios.post(`${API_URL}/api/auth/impersonate`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        localStorage.setItem('manar_token', res.data.token);
        localStorage.setItem('manar_user', JSON.stringify(res.data.user));

        if (userType === 'student') {
          localStorage.setItem('student_profile', JSON.stringify({
            name: res.data.user.name,
            email: res.data.user.email,
            department: res.data.user.groupName || '',
            level: '',
            groupId: res.data.user.groupId
          }));
          toast.success(isAr ? `بدأت محاكاة الطالب: ${name}` : `Student impersonation started: ${name}`);
          window.location.href = '/student/home';
        } else if (userType === 'lecturer') {
          toast.success(isAr ? `بدأت محاكاة المحاضر: ${name}` : `Lecturer impersonation started: ${name}`);
          window.location.href = '/lecturer/home';
        } else {
          toast.success(isAr ? `بدأت محاكاة المشرف: ${name}` : `Admin impersonation started: ${name}`);
          window.location.href = '/admin/overview';
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Impersonation failed');
    }
  };

  /* ── User Purge Handlers ───────────────────────────────────────── */
  const handlePurgeUser = (type, id, name) => {
    setDeletingUser({ open: true, type, id, name });
  };

  const confirmPurgeUser = async () => {
    const { type, id } = deletingUser;
    setDeletingUser({ open: false, type: '', id: null, name: '' });
    
    try {
      const token = localStorage.getItem('manar_token');
      let url = '';
      if (type === 'student') url = `${API_URL}/api/admin/god-mode/students/${id}`;
      else if (type === 'lecturer') url = `${API_URL}/api/admin/god-mode/lecturers/${id}`;
      else if (type === 'admin') url = `${API_URL}/api/admin/sub-admins/${id}`;

      await axios.delete(url, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(isAr ? 'تم الحذف والتطهير بنجاح.' : 'User permanently purged.');
      fetchGodModeUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Purge action failed.');
    }
  };

  /* ── Tenant Configuration Editing Handlers ────────────────────── */
  const openTenantEditor = (type, item) => {
    const config = item.tenantConfig || {};
    const features = config.enabledFeatures || {};

    setEditTenantModal({
      open: true,
      configId: config.id || null,
      universityId: type === 'university' ? item.id : null,
      collegeId: type === 'college' ? item.id : null,
      name: item.name,
      type,
      themeColor: config.themeColor || '#60c4ff',
      logoUrl: config.logoUrl || '',
      customDomain: config.customDomain || '',
      features: {
        qrAttendance: features.qrAttendance ?? true,
        pushNotifications: features.pushNotifications ?? true,
        examsScheduler: features.examsScheduler ?? false,
        emailDailySummary: features.emailDailySummary ?? false,
        analyticsDashboard: features.analyticsDashboard ?? false
      }
    });
  };

  const saveTenantConfig = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('manar_token');
      const payload = {
        id: editTenantModal.configId,
        universityId: editTenantModal.universityId,
        collegeId: editTenantModal.collegeId,
        themeColor: editTenantModal.themeColor,
        logoUrl: editTenantModal.logoUrl,
        customDomain: editTenantModal.customDomain,
        enabledFeatures: editTenantModal.features
      };

      const res = await axios.post(`${API_URL}/api/admin/dev/tenant-configs`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        toast.success(isAr ? 'تم حفظ إعدادات الهوية بنجاح!' : 'Branding updated successfully!');
        setEditTenantModal(prev => ({ ...prev, open: false }));
        fetchTenantConfigs();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update tenant branding');
    }
  };

  /* ── Sub-Admin Creation Form Handlers ────────────────────────── */
  const createSubAdmin = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('manar_token');
      const payload = {
        name: adminForm.name,
        email: adminForm.email,
        password: adminForm.password,
        role: adminForm.role,
        universityId: adminForm.universityId ? parseInt(adminForm.universityId) : null,
        collegeId: adminForm.role === 'COLLEGE_ADMIN' && adminForm.collegeId ? parseInt(adminForm.collegeId) : null
      };

      const res = await axios.post(`${API_URL}/api/admin/sub-admins`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        toast.success(isAr ? 'تم إنشاء المشرف بنجاح!' : 'Sub-Admin created successfully!');
        setAdminForm({ name: '', email: '', password: '', role: 'UNI_ADMIN', universityId: '', collegeId: '' });
        fetchSubAdmins();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create sub-admin');
    }
  };

  /* ── Tree hierarchy entity forms ────────────────────────────── */
  const handleSaveTreeEntity = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('manar_token');
    let url = `${API_URL}/api/admin/dev/${editModal.type}`;
    let payload = {
      id: editModal.item?.id,
      name: editModal.name
    };

    if (editModal.type === 'university') {
      payload.slug = editModal.slug;
      payload.themeColor = editModal.themeColor;
      payload.logoUrl = editModal.logoUrl;
      payload.governorateId = editModal.parentId || editModal.item?.governorateId;
    } else if (editModal.type === 'college') {
      payload.slug = editModal.slug;
      payload.location = editModal.location;
      payload.universityId = editModal.parentId || editModal.item?.universityId;
    } else if (editModal.type === 'department') {
      payload.collegeId = editModal.parentId || editModal.item?.collegeId;
    } else if (editModal.type === 'major') {
      payload.departmentId = editModal.parentId || editModal.item?.departmentId;
    }

    try {
      const res = await axios.post(url, payload, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) {
        toast.success(isAr ? 'تم الحفظ والتحديث.' : 'Saved successfully.');
        setEditModal(prev => ({ ...prev, open: false }));
        fetchHierarchyTree();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save entity.');
    }
  };

  const handleDeleteTreeEntity = async (type, id, name) => {
    if (!window.confirm(isAr ? `هل أنت متأكد من حذف ${name}؟` : `Are you sure you want to delete ${name}?`)) return;
    const token = localStorage.getItem('manar_token');
    try {
      const res = await axios.delete(`${API_URL}/api/admin/dev/${type}/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        toast.success(isAr ? 'تم حذف العنصر بنجاح.' : 'Entity deleted successfully.');
        fetchHierarchyTree();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || `Failed to delete ${type}`);
    }
  };

  /* ── Helper utilities ────────────────────────────────────────── */
  const showSuccessBanner = (msg) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const toggleExpand = (key) => {
    setExpandedItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const formatUptime = (seconds) => {
    if (!seconds) return '—';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs}h ${mins}m ${secs}s`;
  };

  const formatMemoryMB = (memBytes) => {
    return (memBytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  if (loading && !telemetry) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-black gap-4 text-white">
        <span className="h-10 w-10 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-mono font-bold tracking-widest text-white/50 uppercase">
          {isAr ? 'جاري الاتصال والتحقق من النظام...' : 'CONNECTING TO SYSTEM TELEMETRY...'}
        </p>
      </div>
    );
  }

  const { counts, server, settings, recentLogs, recentRequests, onlineUsers = [], activityLogs = [] } = telemetry || {
    counts: {}, server: {}, settings: {}, recentLogs: [], recentRequests: [], onlineUsers: [], activityLogs: []
  };

  // Memory utilization calculations
  const totalMem = server.memory?.heapTotal || 1;
  const usedMem = server.memory?.heapUsed || 0;
  const memoryPercent = (usedMem / totalMem) * 100;

  // DB Latency scale
  const dbLatencyPercent = Math.min((server.dbLatency / 300) * 100, 100);
  const latencyColor = server.dbLatency < 50 ? '#10b981' : server.dbLatency < 150 ? '#f59e0b' : '#ef4444';

  // Sub-Admins list
  const selectedUni = tenants.universities.find(u => u.id === parseInt(adminForm.universityId));
  const collegesForSelectedUni = selectedUni ? selectedUni.colleges || [] : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] p-4 md:p-8 space-y-8 animate-fade-in"
      style={{ fontFamily: "'Urbanist', 'Inter', sans-serif" }}
    >
      {/* ── Banner Notification ──────────────────────────────────── */}
      <AnimatePresence>
        {actionSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-12 left-6 right-6 z-50 p-4 rounded-xl border border-emerald-500/25 bg-emerald-950/70 backdrop-blur-md text-emerald-300 text-xs font-bold flex items-center justify-between shadow-2xl"
          >
            <span>✓ {actionSuccess}</span>
            <button onClick={() => setActionSuccess(null)} className="text-emerald-400 hover:text-white ml-4">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hero header & Navigation Tabs ────────────────────────── */}
      <div className="flex items-start justify-between gap-6 flex-wrap pb-4 border-b border-white/5">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full border border-orange-500/20 bg-orange-950/30 text-orange-400">
              🛡️ DEVELOPER ROOT PORTAL & GOD MODE
            </span>
            <motion.span
              animate={{ opacity: [1, 0.6, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="text-[10px] font-black tracking-wider uppercase px-3 py-1 rounded-full font-mono border"
              style={{ borderColor: `${latencyColor}30`, backgroundColor: `${latencyColor}10`, color: latencyColor }}
            >
              ● DB LATENCY: {server.dbLatency}ms
            </motion.span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white">
            MANAR SYSTEM CONTROL
          </h1>
          <p className="text-xs font-mono text-white/50 mt-1">
            {isAr ? 'لوحة التحكم والتشخيص الحي وإدارة ميزات المستأجرين والتخصيص' : 'Live telemetry, white-label configurations, and student/staff impersonations'}
          </p>
        </div>

        {/* Dynamic Tab Switcher */}
        <div className="flex gap-1.5 flex-wrap bg-white/5 p-1 rounded-2xl border border-white/5">
          {[
            { id: 'dashboard', label: isAr ? '🖥️ التشخيص والعدادات' : '🖥️ Telemetry' },
            { id: 'sessions', label: isAr ? '👥 جلسات المتصلين' : '👥 Active Sessions' },
            { id: 'tenants', label: isAr ? '🏢 تخصيص المستأجرين' : '🏢 Tenant Manager' },
            { id: 'licenses', label: isAr ? '🔌 تراخيص الكليات' : '🔌 License Control' },
            { id: 'institutions', label: isAr ? '🏫 الهيكل الأكاديمي' : '🏫 Institutions' },
            { id: 'admins', label: isAr ? '🔑 المشرفين والصلاحيات' : '🔑 Sub-Admins' },
            { id: 'directory', label: isAr ? '🎓 دليل المحاكاة (God)' : '🎓 God Mode' },
            { id: 'database', label: isAr ? '🗄️ قاعدة البيانات' : '🗄️ Database Console' },
            { id: 'logs', label: isAr ? '📝 التنبيهات والطلبات' : '📝 Logs & Requests' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-[var(--accent)] text-black font-extrabold shadow-lg shadow-[var(--accent)]/10'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main View Content Swapper ────────────────────────────── */}
      <AnimatePresence mode="wait">
        {/* Tab 1: Telemetry Dashboard */}
        {activeTab === 'dashboard' && (
          <motion.div
            key="dashboard-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            {/* Visual Dials Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <TelemetryDial
                percentage={memoryPercent}
                value={`${formatMemoryMB(usedMem)} / ${formatMemoryMB(totalMem)}`}
                label={isAr ? 'استهلاك الذاكرة (Heap)' : 'Node Memory Usage'}
                sublabel="Garbage collector buffer"
                color="#a855f7"
                icon="⚡"
              />
              <TelemetryDial
                percentage={dbLatencyPercent}
                value={`${server.dbLatency} ms`}
                label={isAr ? 'زمن استجابة قاعدة البيانات' : 'Database Latency'}
                sublabel="Query response delay"
                color={latencyColor}
                icon="📊"
              />
              <TelemetryDial
                percentage={100}
                value={formatUptime(server.uptime)}
                label={isAr ? 'وقت تشغيل الخادم المتواصل' : 'Node Uptime'}
                sublabel="System runtime duration"
                color="#60c4ff"
                icon="⏱️"
              />
            </div>

            {/* Counts Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { title: isAr ? 'الطلاب المسجلين' : 'Total Students', value: counts.students, color: '#3b82f6', subtitle: 'Registered Students' },
                { title: isAr ? 'أعضاء التدريس' : 'Total Lecturers', value: counts.lecturers, color: '#10b981', subtitle: 'Faculty Members' },
                { title: isAr ? 'المحاضرات (سجل)' : 'Active Classes', value: counts.schedules, color: '#ec4899', subtitle: 'Base Schedules' },
                { title: isAr ? 'القاعات الدراسية' : 'Total Rooms', value: counts.rooms, color: '#f59e0b', subtitle: 'Configured Rooms' },
                { title: isAr ? 'المجموعات والشعب' : 'Academic Groups', value: counts.groups, color: '#a855f7', subtitle: 'Groups count' }
              ].map((c, i) => (
                <div key={i} className="frosted-panel rounded-2xl p-5 border border-white/5 bg-white/1">
                  <span className="text-[9px] font-black text-white/40 tracking-wider uppercase">{c.title}</span>
                  <h3 className="text-3xl font-black text-white font-mono mt-1" style={{ color: c.color }}>{c.value}</h3>
                  <p className="text-[9px] text-white/30 font-mono mt-0.5">{c.subtitle}</p>
                </div>
              ))}
            </div>

            {/* Diagnostics Controls & Utility Tools */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {/* Persistent Switch settings */}
              <div className="frosted-panel rounded-2xl p-6 border border-white/5 bg-white/2 space-y-6">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">{isAr ? '⚙️ مفاتيح التحكم والتهيئة الحية' : '⚙️ System Feature Toggles'}</h3>
                  <p className="text-[10px] text-white/50 mt-1">{isAr ? 'هذه الخيارات تغير تكوين الخادم بشكل فوري' : 'Dynamic values affecting server-side controllers'}</p>
                </div>
                <div className="space-y-2">
                  <Toggle
                    label={isAr ? 'وضع صيانة المنصة' : 'Maintenance Mode'}
                    sublabel="Prevents student profile changes"
                    value={settings.maintenanceMode}
                    onChange={v => handleToggleSetting('maintenanceMode', v)}
                    accentColor="#ef4444"
                  />
                  <Toggle
                    label={isAr ? 'وضع تتبع الأخطاء البرمجية' : 'System Debug Mode'}
                    sublabel="Includes detailed error stack traces"
                    value={settings.debugMode}
                    onChange={v => handleToggleSetting('debugMode', v)}
                    accentColor="#f59e0b"
                  />
                  <Toggle
                    label={isAr ? 'السجل التفصيلي للـ API' : 'Verbose API Logger'}
                    sublabel="Logs raw request payloads in console"
                    value={settings.verboseLogging}
                    onChange={v => handleToggleSetting('verboseLogging', v)}
                    accentColor="#3b82f6"
                  />
                  <Toggle
                    label={isAr ? 'تعطيل تسجيل الحضور الذكي' : 'Disable Smart Attendance'}
                    sublabel="Disables QR check-in capabilities"
                    value={settings.disableAttendance}
                    onChange={v => handleToggleSetting('disableAttendance', v)}
                    accentColor="#ec4899"
                  />
                  <Toggle
                    label={isAr ? 'تعطيل عرض جداول المحاضرات' : 'Disable Lecture Schedules'}
                    sublabel="Hides student timetables/weekly views"
                    value={settings.disableSchedules}
                    onChange={v => handleToggleSetting('disableSchedules', v)}
                    accentColor="#3b82f6"
                  />
                  <Toggle
                    label={isAr ? 'تعطيل جداول الامتحانات' : 'Disable Exams Timetable'}
                    sublabel="Hides mid/final exam layouts"
                    value={settings.disableExams}
                    onChange={v => handleToggleSetting('disableExams', v)}
                    accentColor="#f59e0b"
                  />
                  <Toggle
                    label={isAr ? 'تعطيل المكتبة الإلكترونية' : 'Disable Digital Library'}
                    sublabel="Blocks digital textbook repository"
                    value={settings.disableLibrary}
                    onChange={v => handleToggleSetting('disableLibrary', v)}
                    accentColor="#a855f7"
                  />
                  <Toggle
                    label={isAr ? 'تعطيل خريطة الحرم الجامعي' : 'Disable Campus Map'}
                    sublabel="Hides indoor campus directions"
                    value={settings.disableMap}
                    onChange={v => handleToggleSetting('disableMap', v)}
                    accentColor="#10b981"
                  />
                </div>
              </div>

              {/* Hardware diagnostics info */}
              <div className="frosted-panel rounded-2xl p-6 border border-white/5 bg-white/2 space-y-6">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">{isAr ? '⚡ معلومات البيئة والتشغيل' : '⚡ Runtime Environment'}</h3>
                  <p className="text-[10px] text-white/50 mt-1">{isAr ? 'معلومات تفصيلية عن نظام التشغيل والمحرك' : 'OS architecture & environment parameters'}</p>
                </div>
                <div className="space-y-3 font-mono text-xs text-white/80">
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-white/40">OS Platform</span>
                    <span className="text-white font-bold uppercase">{server.platform} ({server.arch})</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-white/40">Node version</span>
                    <span className="text-white font-bold">{server.nodeVersion}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-white/40">Active DB Engine</span>
                    <span className="text-emerald-400 font-bold">PostgreSQL (Prisma)</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-white/40">Environment</span>
                    <span className="px-2 py-0.5 rounded bg-white/10 text-[9px] font-bold">PRODUCTION MODE</span>
                  </div>
                </div>
              </div>

              {/* Quick seeding actions */}
              <div className="frosted-panel rounded-2xl p-6 border border-white/5 bg-white/2 space-y-6">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">{isAr ? '🛠️ أوامر الصيانة السريعة' : '🛠️ Database & Operations'}</h3>
                  <p className="text-[10px] text-white/50 mt-1">{isAr ? 'أوامر مباشرة لتطهير وتهيئة جداول النظام' : 'Database seeds and purging operations'}</p>
                </div>
                <div className="flex flex-col gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleTriggerSeed}
                    disabled={executingAction !== null}
                    className="w-full py-3 px-4 bg-white/5 border border-white/10 text-white rounded-xl text-xs font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                  >
                    🌱 {executingAction === 'seeding' ? (isAr ? 'جاري التهيئة...' : 'Seeding...') : (isAr ? 'إطلاق بذور قاعدة البيانات (Seed)' : 'Trigger DB Seed Script')}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02, backgroundColor: 'rgba(239,68,68,0.1)' }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleClearTestData}
                    disabled={executingAction !== null}
                    className="w-full py-3 px-4 bg-red-950/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-bold hover:bg-red-950/30 transition-all flex items-center justify-center gap-2"
                  >
                    🗑️ {executingAction === 'clearing' ? (isAr ? 'جاري التطهير...' : 'Purging...') : (isAr ? 'تطهير وإزالة بيانات الطلاب' : 'Purge All Student Records')}
                  </motion.button>
                </div>
              </div>

              {/* Automated Notifications Testing Card */}
              <div className="frosted-panel rounded-2xl p-6 border border-white/5 bg-white/2 space-y-6">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">{isAr ? '📢 إرسال التنبيهات الدورية' : '📢 Automated Notifications'}</h3>
                  <p className="text-[10px] text-white/50 mt-1">{isAr ? 'اختبار وإرسال التنبيهات الدورية والملخص اليومي يدوياً' : 'Test periodic notifications and summary campaigns manually'}</p>
                </div>
                <div className="flex flex-col gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleTriggerAutomatedNotif('morning')}
                    disabled={executingAction !== null}
                    className="w-full py-3 px-4 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl text-xs font-bold hover:bg-amber-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    ☀️ {executingAction === 'notif-morning' ? (isAr ? 'جاري الإرسال...' : 'Sending...') : (isAr ? 'إرسال تحية الصباح' : 'Send Morning Greeting')}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleTriggerAutomatedNotif('afternoon')}
                    disabled={executingAction !== null}
                    className="w-full py-3 px-4 bg-sky-500/10 border border-sky-500/20 text-sky-300 rounded-xl text-xs font-bold hover:bg-sky-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    💬 {executingAction === 'notif-afternoon' ? (isAr ? 'جاري الإرسال...' : 'Sending...') : (isAr ? 'إرسال سؤال بعد الظهر' : 'Send Afternoon Check-in')}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleTriggerAutomatedNotif('summary')}
                    disabled={executingAction !== null}
                    className="w-full py-3 px-4 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-xl text-xs font-bold hover:bg-purple-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    📋 {executingAction === 'notif-summary' ? (isAr ? 'جاري الإرسال...' : 'Sending...') : (isAr ? 'إرسال ملخص جدول الغد' : 'Send Tomorrow Summary')}
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleTriggerAutomatedNotif('upcoming')}
                    disabled={executingAction !== null}
                    className="w-full py-3 px-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl text-xs font-bold hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    ⏰ {executingAction === 'notif-upcoming' ? (isAr ? 'جاري الفحص...' : 'Checking...') : (isAr ? 'تنبيه المحاضرات المقتربة (30 د)' : 'Trigger 30m Pre-Lecture Alerts')}
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tab: Sessions & Active Connections */}
        {activeTab === 'sessions' && (
          <motion.div
            key="sessions-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 xl:grid-cols-2 gap-6 animate-fade-in"
          >
            {/* Connected Users List Panel */}
            <div className="frosted-panel rounded-2xl overflow-hidden border border-white/5 bg-white/2 flex flex-col">
              <div className="p-5 border-b border-white/5 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="text-sm font-black uppercase text-white tracking-widest">
                    {isAr ? '👥 المتصلون بالمنصة حالياً' : 'Connected Users Online'}
                  </h3>
                  <p className="text-[10px] text-white/40 mt-1">
                    {isAr ? 'الأجهزة النشطة المتصلة ببث الإشعارات وتفاعلات الـ API' : 'Active SSE connection streams and API sessions'}
                  </p>
                </div>
                <span className="px-3 py-1 text-xs font-black rounded-full font-mono bg-[var(--accent)] text-black shadow-md">
                  {onlineUsers.length} {isAr ? 'متصل' : 'Active'}
                </span>
              </div>

              <div className="overflow-x-auto flex-1">
                <table className="w-full text-xs text-left" dir={isAr ? 'rtl' : 'ltr'}>
                  <thead>
                    <tr className="bg-white/5 text-white/40 border-b border-white/5 text-[9px] font-black uppercase tracking-wider">
                      <th className="p-4">{isAr ? 'المستخدم' : 'User'}</th>
                      <th className="p-4">{isAr ? 'الدور' : 'Role'}</th>
                      <th className="p-4">{isAr ? 'حالة الاتصال' : 'Connection Status'}</th>
                      <th className="p-4">{isAr ? 'آخر نشاط' : 'Last Active'}</th>
                      <th className="p-4 text-center">{isAr ? 'المحاكاة' : 'Impersonate'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {onlineUsers.map(u => {
                      const isSse = u.source === 'SSE_STREAM';
                      let roleBadge = 'bg-slate-500/10 text-slate-400';
                      if (u.role === 'STUDENT') roleBadge = 'bg-blue-500/10 text-blue-400';
                      else if (u.role === 'LECTURER') roleBadge = 'bg-emerald-500/10 text-emerald-400';
                      else if (u.role?.includes('ADMIN')) roleBadge = 'bg-purple-500/10 text-purple-400';

                      return (
                        <tr key={`${u.id}-${u.role}`} className="hover:bg-white/5 transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-white">{u.name}</div>
                            <div className="text-[10px] text-white/40 font-mono mt-0.5">{u.email}</div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-wide ${roleBadge}`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              {isSse ? (
                                <>
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                  </span>
                                  <span className="text-[10px] text-emerald-400 font-semibold">
                                    {isAr ? 'بث حي (SSE)' : 'Live SSE Stream'}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                                  <span className="text-[10px] text-blue-400 font-semibold">
                                    {isAr ? 'نشاط واجهة (API)' : 'API Activity'}
                                  </span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="p-4 font-mono text-[10px] text-white/50">
                            {formatTimeSafe(u.lastActive)}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => {
                                const type = u.role === 'STUDENT' ? 'student' : u.role === 'LECTURER' ? 'lecturer' : 'admin';
                                handleImpersonateUser(type, u.id, u.name, u.role);
                              }}
                              className="px-2.5 py-1 rounded bg-[var(--accent-dim)] border border-[var(--accent)]/20 text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black transition-all text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1"
                            >
                              <span>impersonate 🔑</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {onlineUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-white/30 font-bold">
                          {isAr ? 'لا يوجد أجهزة متصلة بالمنصة حالياً.' : 'No users currently online.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Session Activity Logs Timeline Panel */}
            <div className="frosted-panel rounded-2xl overflow-hidden border border-white/5 bg-white/2 flex flex-col">
              <div className="p-5 border-b border-white/5">
                <h3 className="text-sm font-black uppercase text-white tracking-widest">
                  {isAr ? '📝 سجل عمليات الجلسات' : 'Session Activity Logs'}
                </h3>
                <p className="text-[10px] text-white/40 mt-1">
                  {isAr ? 'سجل حركات تسجيل الدخول والخروج والمحاكاة الأخيرة (من دخل ومن خرج)' : 'Chronological login, logout, and impersonation log feed'}
                </p>
              </div>

              <div className="p-5 flex-1 max-h-[500px] overflow-y-auto space-y-4">
                {activityLogs.map((log) => {
                  const isLogin = log.action === 'LOGIN';
                  const isLogout = log.action === 'LOGOUT';
                  const isImpersonate = log.action === 'IMPERSONATE';

                  let actionTextAr = '';
                  let actionTextEn = '';
                  let actionBadge = '';
                  let icon = '📝';

                  if (isLogin) {
                    actionTextAr = 'تسجيل دخول';
                    actionTextEn = 'User Logged In';
                    actionBadge = 'bg-emerald-500/10 text-emerald-400';
                    icon = '📥';
                  } else if (isLogout) {
                    actionTextAr = 'تسجيل خروج';
                    actionTextEn = 'User Logged Out';
                    actionBadge = 'bg-red-500/10 text-red-400';
                    icon = '📤';
                  } else if (isImpersonate) {
                    actionTextAr = 'محاكاة مستخدم';
                    actionTextEn = 'User Impersonation';
                    actionBadge = 'bg-amber-500/10 text-amber-400';
                    icon = '🎭';
                  }

                  let roleBadge = 'bg-slate-500/10 text-slate-400';
                  if (log.role === 'STUDENT') roleBadge = 'bg-blue-500/10 text-blue-400';
                  else if (log.role === 'LECTURER') roleBadge = 'bg-emerald-500/10 text-emerald-400';
                  else if (log.role?.includes('ADMIN')) roleBadge = 'bg-purple-500/10 text-purple-400';

                  return (
                    <div key={log.id} className="flex items-start gap-4 p-3 bg-white/1 rounded-xl border border-white/5 hover:bg-white/2 transition-colors">
                      <span className="text-xl p-2 bg-black/40 rounded-lg border border-white/5 shrink-0">
                        {icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${actionBadge}`}>
                            {isAr ? actionTextAr : actionTextEn}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black ${roleBadge}`}>
                            {log.role}
                          </span>
                          <span className="text-[10px] text-white/30 font-mono ml-auto">
                            {formatTimeSafe(log.timestamp)}
                          </span>
                        </div>
                        <h4 className="font-extrabold text-sm text-white mt-1.5">
                          {log.name} <span className="text-xs font-normal text-white/50">({log.email})</span>
                        </h4>
                        {log.details && (
                          <div className="mt-1.5 p-2 bg-black/40 border border-white/5 rounded-lg text-[10px] text-amber-200/90 font-mono break-all">
                            {log.details}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {activityLogs.length === 0 && (
                  <p className="text-center py-12 text-white/30 font-bold">
                    {isAr ? 'لا يوجد عمليات مسجلة حالياً.' : 'Activity log feed is empty.'}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Tab 2: Tenant Config Manager (White-Labeling & Feature Flags) */}
        {activeTab === 'tenants' && (
          <motion.div
            key="tenants-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div>
              <h2 className="text-xl font-black text-white">{isAr ? 'تخصيص المستأجرين وإعدادات الهوية' : 'Tenant branding & feature switchboard'}</h2>
              <p className="text-xs text-white/50 mt-1">{isAr ? 'تخصيص شعارات وألوان الكليات والجامعات، وإمكانية تفعيل الميزات والخيارات الفرعية' : 'White-label custom themes, logo URLs, and individual feature toggles per institution'}</p>
            </div>

            {tenantsLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <span className="h-8 w-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] font-bold text-white/40 uppercase">{isAr ? 'جاري تحميل إعدادات المستأجرين...' : 'Fetching tenant profiles...'}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Universities Config Card Grid */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black tracking-widest text-[#60c4ff] uppercase">🏫 {isAr ? 'الجامعات المتاحة' : 'Universities Configurations'}</h3>
                  <div className="space-y-3">
                    {tenants.universities.map(uni => (
                      <div key={uni.id} className="frosted-panel rounded-2xl p-5 border border-white/5 bg-white/2 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          {uni.logoUrl ? (
                            <img src={uni.logoUrl} alt="Logo" className="w-10 h-10 object-contain rounded-lg bg-white/5 p-1" />
                          ) : (
                            <span className="text-2xl">🏫</span>
                          )}
                          <div className="min-w-0">
                            <h4 className="font-bold text-white truncate text-sm">{uni.name}</h4>
                            <p className="text-[10px] font-mono text-white/40 truncate">Slug: {uni.slug} {uni.tenantConfig?.customDomain && `| Domain: ${uni.tenantConfig.customDomain}`}</p>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className="w-3.5 h-3.5 rounded-full border border-white/10 shrink-0" style={{ backgroundColor: uni.tenantConfig?.themeColor || '#60c4ff' }} />
                              <span className="text-[9px] font-mono text-white/60">{uni.tenantConfig?.themeColor || '#60c4ff'}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => openTenantEditor('university', uni)}
                          className="px-3.5 py-2 bg-white/5 hover:bg-[var(--accent)] hover:text-black rounded-xl text-xs font-bold transition-all"
                        >
                          ⚙️ {isAr ? 'تخصيص' : 'Configure'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Colleges Config Card Grid */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black tracking-widest text-[#a855f7] uppercase">🏢 {isAr ? 'الكليات المتاحة' : 'Colleges Configurations'}</h3>
                  <div className="space-y-3">
                    {tenants.colleges.map(col => (
                      <div key={col.id} className="frosted-panel rounded-2xl p-5 border border-white/5 bg-white/2 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="min-w-0">
                            <h4 className="font-bold text-white truncate text-sm">{col.name}</h4>
                            <p className="text-[10px] text-white/50 truncate">{col.university?.name}</p>
                            <p className="text-[10px] font-mono text-white/40 truncate">Slug: {col.slug}</p>
                            <div className="flex items-center gap-1.5 mt-1.5">
                              <span className="w-3.5 h-3.5 rounded-full border border-white/10 shrink-0" style={{ backgroundColor: col.tenantConfig?.themeColor || '#60c4ff' }} />
                              <span className="text-[9px] font-mono text-white/60">{col.tenantConfig?.themeColor || '#60c4ff'}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => openTenantEditor('college', col)}
                          className="px-3.5 py-2 bg-white/5 hover:bg-[var(--accent)] hover:text-black rounded-xl text-xs font-bold transition-all"
                        >
                          ⚙️ {isAr ? 'تخصيص' : 'Configure'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Tab: License Control & Kill-Switch */}
        {activeTab === 'licenses' && (
          <motion.div
            key="licenses-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div>
              <h2 className="text-xl font-black text-white">{isAr ? '🔌 إدارة تراخيص كليات النظام' : '🔌 College License Management'}</h2>
              <p className="text-xs text-white/50 mt-1">
                {isAr 
                  ? 'تعطيل أو تفعيل صلاحية الوصول لكليات بأكملها في حالة انتهاء الاشتراك أو الترخيص المالي.' 
                  : 'Revoke or restore system access for entire colleges in case of license expiration.'}
              </p>
            </div>

            {tenantsLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <span className="h-8 w-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] font-bold text-white/40 uppercase">{isAr ? 'جاري تحميل الكليات...' : 'Loading colleges...'}</p>
              </div>
            ) : (
              <div className="frosted-panel rounded-2xl overflow-hidden border border-white/5 bg-white/2">
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                  <h3 className="text-sm font-black uppercase text-white tracking-widest">
                    {isAr ? 'المؤسسات والكليات النشطة' : 'Registered Colleges & License Status'}
                  </h3>
                  <span className="px-3 py-1 text-xs font-black rounded-full font-mono bg-red-500/20 text-red-400 border border-red-500/30">
                    {isAr ? 'المعطلة:' : 'Deactivated:'} {(settings.deactivatedColleges || []).length}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left" dir={isAr ? 'rtl' : 'ltr'}>
                    <thead>
                      <tr className="bg-white/5 text-white/40 border-b border-white/5 text-[9px] font-black uppercase tracking-wider">
                        <th className="p-4">{isAr ? 'الكلية' : 'College Name'}</th>
                        <th className="p-4">{isAr ? 'الجامعة التابعة' : 'Parent University'}</th>
                        <th className="p-4">{isAr ? 'حالة الترخيص' : 'License Status'}</th>
                        <th className="p-4 text-center">{isAr ? 'تعطيل الوصول (Kill-Switch)' : 'Action (Kill-Switch)'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {tenants.colleges.map(col => {
                        const isDeactivated = (settings.deactivatedColleges || []).includes(col.id);
                        return (
                          <tr key={col.id} className="hover:bg-white/5 transition-colors">
                            <td className="p-4">
                              <div className="font-bold text-white text-sm">{col.name}</div>
                              <div className="text-[10px] text-white/40 font-mono mt-0.5">ID: {col.id} · Slug: {col.slug}</div>
                            </td>
                            <td className="p-4 text-white/70">
                              {col.university?.name || '—'}
                            </td>
                            <td className="p-4">
                              <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${
                                isDeactivated 
                                  ? 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse' 
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {isDeactivated ? (isAr ? '🔴 معطل' : 'REVOKED') : (isAr ? '🟢 نشط' : 'ACTIVE')}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex justify-center">
                                <Toggle
                                  label=""
                                  value={!isDeactivated}
                                  onChange={async () => {
                                    if (window.confirm(isAr 
                                      ? `هل أنت متأكد من تغيير حالة ترخيص كلية: ${col.name}؟` 
                                      : `Are you sure you want to toggle the license status for: ${col.name}?`
                                    )) {
                                      try {
                                        const token = localStorage.getItem('manar_token');
                                        const res = await axios.post(`${API_URL}/api/admin/dev/toggle-license`, 
                                          { collegeId: col.id },
                                          { headers: { Authorization: `Bearer ${token}` } }
                                        );
                                        if (res.data?.success) {
                                          toast.success(isAr ? 'تم تحديث حالة الترخيص بنجاح' : 'License status updated');
                                          fetchTelemetry(true);
                                        }
                                      } catch (err) {
                                        toast.error(isAr ? 'فشل تعديل حالة الترخيص' : 'Failed to update license');
                                      }
                                    }
                                  }}
                                  accentColor="#10b981"
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {tenants.colleges.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-12 text-center text-white/30 font-bold">
                            {isAr ? 'لا يوجد كليات مسجلة حالياً.' : 'No colleges found.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Tab 3: Institutional Tree hierarchy */}
        {activeTab === 'institutions' && (
          <motion.div
            key="institutions-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="flex justify-between items-center gap-4 flex-wrap">
              <div>
                <h2 className="text-xl font-black text-white">{isAr ? 'إدارة الهيكل الأكاديمي والمدن' : 'Academic Hierarchy Structure'}</h2>
                <p className="text-xs text-white/50 mt-1">{isAr ? 'إضافة وتعديل وحذف المحافظات، الجامعات، الكليات، الأقسام، والتخصصات' : 'Control governorates, universities, colleges, departments, and majors'}</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setEditModal({ open: true, type: 'governorate', item: null, name: '' })}
                className="btn-neon px-4 py-2.5 text-xs font-extrabold flex items-center gap-2"
              >
                <span>➕</span>
                <span>{isAr ? 'إضافة محافظة جديدة' : 'Add Governorate'}</span>
              </motion.button>
            </div>

            {treeLoading && treeData.length === 0 ? (
              <div className="py-12 flex justify-center items-center">
                <span className="h-8 w-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {treeData.map((gov) => {
                  const isGovExpanded = expandedItems[`gov-${gov.id}`];
                  return (
                    <div key={gov.id} className="frosted-panel rounded-2xl p-6 border border-white/10 bg-white/3 flex flex-col space-y-4">
                      {/* Governorate Title bar */}
                      <div className="flex justify-between items-center pb-3 border-b border-white/10 gap-4">
                        <div className="flex items-center gap-2.5 cursor-pointer select-none" onClick={() => toggleExpand(`gov-${gov.id}`)}>
                          <span className="text-white/40 text-xs">{isGovExpanded ? '▼' : '▶'}</span>
                          <span className="text-xs uppercase font-black text-white/40 tracking-wider">🗺️ {isAr ? 'محافظة' : 'Gov'}</span>
                          <h3 className="text-base font-black text-white">{gov.name}</h3>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => setEditModal({ open: true, type: 'governorate', item: gov, name: gov.name })}
                            className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-[10px] text-white/80 rounded-lg transition-all"
                          >
                            ✏️ {isAr ? 'تعديل' : 'Edit'}
                          </button>
                          {gov.universities.length === 0 && (
                            <button
                              onClick={() => handleDeleteTreeEntity('governorate', gov.id, gov.name)}
                              className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-[10px] text-red-400 rounded-lg transition-all"
                            >
                              🗑️ {isAr ? 'حذف' : 'Delete'}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanding Universities */}
                      {isGovExpanded && (
                        <div className="space-y-4 pt-2">
                          {gov.universities.map((uni) => {
                            const isUniExpanded = expandedItems[`uni-${uni.id}`];
                            return (
                              <div key={uni.id} className="p-4 rounded-xl border border-white/5 bg-black/45 space-y-3">
                                <div className="flex justify-between items-start gap-4 flex-wrap">
                                  <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => toggleExpand(`uni-${uni.id}`)}>
                                    <span className="text-white/40 text-[10px]">{isUniExpanded ? '▼' : '▶'}</span>
                                    {uni.logoUrl ? (
                                      <img src={uni.logoUrl} alt="Logo" className="w-5 h-5 object-contain rounded bg-white/10 p-0.5" />
                                    ) : (
                                      <span className="text-xs">🏫</span>
                                    )}
                                    <div>
                                      <h4 className="text-sm font-black text-white leading-none">{uni.name}</h4>
                                      <span className="text-[10px] text-white/30 font-mono mt-1 block">{uni.slug}</span>
                                    </div>
                                  </div>

                                  <div className="flex gap-1.5">
                                    <button
                                      onClick={() => setEditModal({ open: true, type: 'university', item: uni, parentId: gov.id, name: uni.name, slug: uni.slug, themeColor: uni.themeColor || '', logoUrl: uni.logoUrl || '' })}
                                      className="p-1.5 hover:bg-white/5 rounded text-[10px] text-[#60c4ff]"
                                    >
                                      ✏️
                                    </button>
                                    {uni.colleges.length === 0 && (
                                      <button
                                        onClick={() => handleDeleteTreeEntity('university', uni.id, uni.name)}
                                        className="p-1.5 hover:bg-white/5 rounded text-[10px] text-red-400"
                                      >
                                        🗑️
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Expanded College view */}
                                {isUniExpanded && (
                                  <div className="pl-4 pr-1 border-l border-white/5 mt-2 space-y-3">
                                    {uni.colleges.map((col) => {
                                      const isColExpanded = expandedItems[`col-${col.id}`];
                                      return (
                                        <div key={col.id} className="p-3 rounded-lg border border-white/5 bg-black/60 space-y-2">
                                          <div className="flex justify-between items-center gap-3">
                                            <div className="flex items-center gap-1.5 cursor-pointer select-none" onClick={() => toggleExpand(`col-${col.id}`)}>
                                              <span className="text-white/30 text-[9px]">{isColExpanded ? '▼' : '▶'}</span>
                                              <span className="text-xs font-extrabold text-white/90">{col.name}</span>
                                            </div>
                                            <div className="flex gap-1.5">
                                              <button
                                                onClick={() => setEditModal({ open: true, type: 'college', item: col, parentId: uni.id, name: col.name, slug: col.slug, location: col.location || '' })}
                                                className="text-[10px] text-[#60c4ff] hover:underline"
                                              >
                                                ✏️
                                              </button>
                                              {(!col.departments || col.departments.length === 0) && (
                                                <button
                                                  onClick={() => handleDeleteTreeEntity('college', col.id, col.name)}
                                                  className="text-[10px] text-red-400 hover:underline"
                                                >
                                                  🗑️
                                                </button>
                                              )}
                                            </div>
                                          </div>

                                          {/* Collapsible Departments & Majors */}
                                          {isColExpanded && (
                                            <div className="pl-4 space-y-2 border-l border-white/5 mt-1">
                                              {col.departments?.map((dept) => {
                                                const isDeptExpanded = expandedItems[`dept-${dept.id}`];
                                                return (
                                                  <div key={dept.id} className="space-y-1">
                                                    <div className="flex justify-between items-center text-[11px] py-0.5">
                                                      <div className="flex items-center gap-1.5 cursor-pointer select-none" onClick={() => toggleExpand(`dept-${dept.id}`)}>
                                                        <span className="text-white/30 text-[8px]">{isDeptExpanded ? '▼' : '▶'}</span>
                                                        <span className="text-white/70 font-mono">Department: {dept.name}</span>
                                                      </div>
                                                      <div className="flex items-center gap-2">
                                                        <button
                                                          onClick={() => setEditModal({ open: true, type: 'department', item: dept, parentId: col.id, name: dept.name })}
                                                          className="text-[8px] text-white/40 hover:text-white"
                                                        >
                                                          ✏️
                                                        </button>
                                                        <button
                                                          onClick={() => setEditModal({ open: true, type: 'major', item: null, parentId: dept.id, name: '' })}
                                                          className="text-[8px] text-[#4ade80]"
                                                        >
                                                          ➕ {isAr ? 'تخصص' : 'Major'}
                                                        </button>
                                                        {(!dept.majors || dept.majors.length === 0) && (
                                                          <button
                                                            onClick={() => handleDeleteTreeEntity('department', dept.id, dept.name)}
                                                            className="text-[8px] text-red-400 hover:text-red-300"
                                                          >
                                                            🗑️
                                                          </button>
                                                        )}
                                                      </div>
                                                    </div>

                                                    {/* Majors List */}
                                                    {isDeptExpanded && (
                                                      <div className="pl-4 space-y-1 text-[10px]">
                                                        {dept.majors?.map((major) => (
                                                          <div key={major.id} className="flex justify-between items-center py-0.5 text-white/50 font-mono">
                                                            <span>• {major.name}</span>
                                                            <div className="flex gap-1.5">
                                                              <button
                                                                onClick={() => setEditModal({ open: true, type: 'major', item: major, parentId: dept.id, name: major.name })}
                                                                className="text-[8px] text-white/40 hover:text-white"
                                                              >
                                                                ✏️
                                                              </button>
                                                              <button
                                                                onClick={() => handleDeleteTreeEntity('major', major.id, major.name)}
                                                                className="text-[8px] text-red-400/70 hover:text-red-400"
                                                              >
                                                                🗑️
                                                              </button>
                                                            </div>
                                                          </div>
                                                        ))}
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}

                                              <button
                                                onClick={() => setEditModal({ open: true, type: 'department', item: null, parentId: col.id, name: '' })}
                                                className="text-[9px] text-[#60c4ff] block hover:underline pt-1"
                                              >
                                                ➕ {isAr ? 'إضافة قسم للكلية' : 'Add Department'}
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}

                                    <button
                                      onClick={() => setEditModal({ open: true, type: 'college', item: null, parentId: uni.id, name: '', slug: '', location: '' })}
                                      className="w-full py-2 border border-dashed border-white/5 hover:border-white/10 text-white/50 hover:text-white rounded-lg text-[10px] flex items-center justify-center gap-1 transition-all"
                                    >
                                      <span>➕</span>
                                      <span>{isAr ? 'إضافة كلية للجامعة' : 'Add College'}</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          <button
                            onClick={() => setEditModal({ open: true, type: 'university', item: null, parentId: gov.id, name: '', slug: '', themeColor: '', logoUrl: '' })}
                            className="w-full py-2 border border-dashed border-white/15 hover:border-white/30 text-white/60 hover:text-white rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
                          >
                            <span>➕</span>
                            <span>{isAr ? 'إضافة جامعة جديدة بالمحافظة' : 'Add University'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* Tab 4: Sub-Admins Credentials and Roles console */}
        {activeTab === 'admins' && (
          <motion.div
            key="admins-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 xl:grid-cols-3 gap-6"
          >
            {/* Create Admin Form */}
            <div className="frosted-panel rounded-2xl p-6 border border-white/5 bg-white/2 space-y-5 h-fit">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">{isAr ? '🔑 إنشاء حساب مشرف فرعي' : '🔑 Register Sub-Admin'}</h3>
                <p className="text-[10px] text-white/50 mt-1">{isAr ? 'إنشاء حسابات إشرافية وتفويضها بالتحكم بجامعة أو كلية' : 'Delegate admin privileges to university or college slates'}</p>
              </div>

              <form onSubmit={createSubAdmin} className="space-y-4">
                <div>
                  <label className="text-[9px] uppercase font-black text-white/40 block mb-1">{isAr ? 'اسم المشرف' : 'Full Name'}</label>
                  <input
                    type="text"
                    required
                    value={adminForm.name}
                    onChange={e => setAdminForm(m => ({ ...m, name: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[var(--accent)] font-bold"
                  />
                </div>

                <div>
                  <label className="text-[9px] uppercase font-black text-white/40 block mb-1">{isAr ? 'البريد الإلكتروني' : 'Email Address'}</label>
                  <input
                    type="email"
                    required
                    value={adminForm.email}
                    onChange={e => setAdminForm(m => ({ ...m, email: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="text-[9px] uppercase font-black text-white/40 block mb-1">{isAr ? 'كلمة المرور' : 'Password'}</label>
                  <input
                    type="password"
                    required
                    value={adminForm.password}
                    onChange={e => setAdminForm(m => ({ ...m, password: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[var(--accent)] font-mono"
                  />
                </div>

                <div>
                  <label className="text-[9px] uppercase font-black text-white/40 block mb-1">{isAr ? 'الدور الإداري (Role)' : 'Role Scope'}</label>
                  <select
                    value={adminForm.role}
                    onChange={e => setAdminForm(m => ({ ...m, role: e.target.value, collegeId: '' }))}
                    className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="UNI_ADMIN">{isAr ? 'مدير جامعة (University Admin)' : 'University Admin'}</option>
                    <option value="COLLEGE_ADMIN">{isAr ? 'مدير كلية (College Admin)' : 'College Admin'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-[9px] uppercase font-black text-white/40 block mb-1">{isAr ? 'الجامعة المستهدفة' : 'Target University'}</label>
                  <select
                    required
                    value={adminForm.universityId}
                    onChange={e => setAdminForm(m => ({ ...m, universityId: e.target.value, collegeId: '' }))}
                    className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[var(--accent)]"
                  >
                    <option value="">{isAr ? '-- اختر الجامعة --' : '-- Choose University --'}</option>
                    {tenants.universities.map(u => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                {adminForm.role === 'COLLEGE_ADMIN' && (
                  <div>
                    <label className="text-[9px] uppercase font-black text-white/40 block mb-1">{isAr ? 'الكلية المستهدفة' : 'Target College'}</label>
                    <select
                      required
                      value={adminForm.collegeId}
                      onChange={e => setAdminForm(m => ({ ...m, collegeId: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[var(--accent)]"
                    >
                      <option value="">{isAr ? '-- اختر الكلية --' : '-- Choose College --'}</option>
                      {collegesForSelectedUni.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-3 bg-[var(--accent)] text-black rounded-xl text-xs font-black hover:opacity-95 transition-all"
                >
                  ➕ {isAr ? 'إنشاء حساب المشرف' : 'Create Admin Account'}
                </button>
              </form>
            </div>

            {/* Admins List Table */}
            <div className="xl:col-span-2 frosted-panel rounded-2xl overflow-hidden border border-white/5 bg-white/2">
              <div className="p-5 border-b border-white/5">
                <h3 className="text-xs font-black uppercase text-white tracking-widest">{isAr ? 'المشرفون الفرعيون النشطون' : 'Active Sub-Admins list'}</h3>
              </div>

              {adminsLoading ? (
                <div className="py-16 flex items-center justify-center gap-2">
                  <span className="h-6 w-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left" dir={isAr ? 'rtl' : 'ltr'}>
                    <thead>
                      <tr className="bg-white/5 text-white/40 border-b border-white/5 text-[9px] font-black uppercase tracking-wider">
                        <th className="p-4">Name</th>
                        <th className="p-4">Email</th>
                        <th className="p-4">Role</th>
                        <th className="p-4">Affiliation</th>
                        <th className="p-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {subAdmins.map(admin => (
                        <tr key={admin.id} className="hover:bg-white/5 transition-colors">
                          <td className="p-4 font-bold text-white">{admin.name}</td>
                          <td className="p-4 text-white/60">{admin.email}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black ${
                              admin.role === 'UNI_ADMIN' ? 'bg-cyan-500/10 text-cyan-400' : 'bg-purple-500/10 text-purple-400'
                            }`}>
                              {admin.role}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="font-semibold text-white/70">{admin.university?.name || '—'}</div>
                            {admin.college && <div className="text-[10px] text-white/40 mt-0.5">{admin.college.name}</div>}
                          </td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => {
                                if (window.confirm(isAr ? `هل أنت متأكد من حذف المشرف ${admin.name}؟` : `Are you sure you want to delete sub-admin ${admin.name}?`)) {
                                  axios.delete(`${API_URL}/api/admin/sub-admins/${admin.id}`, {
                                    headers: { Authorization: `Bearer ${localStorage.getItem('manar_token')}` }
                                  }).then(() => {
                                    toast.success('Admin deleted');
                                    fetchSubAdmins();
                                  }).catch(e => toast.error('Failed to delete admin'));
                                }
                              }}
                              className="px-2.5 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-[9px] font-bold"
                            >
                              ✕ {isAr ? 'حذف' : 'Delete'}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {subAdmins.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-12 text-center text-white/30 font-bold">{isAr ? 'لا يوجد حسابات مشرفين فرعيين حالياً.' : 'No sub-admins configured yet.'}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Tab 5: God Mode Universal Directory (Students, Lecturers, Sub-Admins) */}
        {activeTab === 'directory' && (
          <motion.div
            key="directory-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Search and Filters Bar */}
            <div className="frosted-panel rounded-2xl p-5 border border-white/5 bg-white/2 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <h3 className="text-sm font-black uppercase text-white tracking-widest">{isAr ? 'دليل محاكاة المستخدمين (God Mode)' : 'Universal God Mode Directory'}</h3>
                  <p className="text-[10px] text-white/40 mt-0.5">{isAr ? 'البث المباشر والدخول الفوري والمحاكاة لجميع مستخدمي النظام' : 'Inspect user slates and perform one-click impersonations'}</p>
                </div>

                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                  {[
                    { id: 'ALL', label: isAr ? 'الكل' : 'All Users' },
                    { id: 'STUDENT', label: isAr ? 'الطلاب' : 'Students' },
                    { id: 'LECTURER', label: isAr ? 'المحاضرين' : 'Lecturers' },
                    { id: 'ADMIN', label: isAr ? 'المشرفين' : 'Sub-Admins' }
                  ].map(filter => (
                    <button
                      key={filter.id}
                      onClick={() => setRoleFilter(filter.id)}
                      className={`px-3 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                        roleFilter === filter.id ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={isAr ? 'بحث بالاسم، البريد الإلكتروني...' : 'Search name or email...'}
                className="px-4 py-2.5 bg-black border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[var(--accent)] w-full md:w-72 font-semibold"
              />
            </div>

            {/* Combined Users Table */}
            <div className="frosted-panel rounded-2xl overflow-hidden border border-white/5 bg-white/2">
              {usersLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <span className="h-8 w-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                  <p className="text-[10px] font-bold text-white/40 tracking-wider uppercase">{isAr ? 'جاري تحميل سجلات المستخدمين...' : 'Reading user directories...'}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left" dir={isAr ? 'rtl' : 'ltr'}>
                    <thead>
                      <tr className="bg-white/5 text-white/40 border-b border-white/5 text-[9px] font-black uppercase tracking-wider">
                        <th className="p-4">Name</th>
                        <th className="p-4">Email</th>
                        <th className="p-4">Role Badge</th>
                        <th className="p-4">Affiliation / Scope</th>
                        <th className="p-4 text-center">Actions / Preview</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {/* Compiling search and filtering list */}
                      {[
                        ...users.students.map(s => ({ ...s, type: 'student', roleLabel: 'STUDENT' })),
                        ...users.lecturers.map(l => ({ ...l, type: 'lecturer', roleLabel: 'LECTURER' })),
                        ...users.admins.map(a => ({ ...a, type: 'admin', roleLabel: a.role }))
                      ].filter(u => {
                        const q = search.toLowerCase();
                        const matchesSearch = u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
                        
                        if (roleFilter === 'ALL') return matchesSearch;
                        if (roleFilter === 'STUDENT') return u.type === 'student' && matchesSearch;
                        if (roleFilter === 'LECTURER') return u.type === 'lecturer' && matchesSearch;
                        if (roleFilter === 'ADMIN') return u.type === 'admin' && matchesSearch;
                        return matchesSearch;
                      }).map((u, i) => (
                        <tr key={`${u.type}-${u.id}`} className="hover:bg-white/5 transition-colors">
                          <td className="p-4">
                            <div className="font-bold text-white">{u.name}</div>
                            {u.idNumber && <div className="text-[9px] font-mono text-white/40 mt-0.5">ID: {u.idNumber}</div>}
                          </td>
                          <td className="p-4 text-white/60 font-mono">{u.email}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-wide ${
                              u.type === 'student' ? 'bg-blue-500/10 text-blue-400' :
                              u.type === 'lecturer' ? 'bg-emerald-500/10 text-emerald-400' :
                              'bg-purple-500/10 text-purple-400'
                            }`}>
                              {u.roleLabel}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="font-semibold text-white/70">
                              {u.type === 'student' && (u.college?.name || '—')}
                              {u.type === 'lecturer' && (u.college?.name || '—')}
                              {u.type === 'admin' && (u.university?.name || '—')}
                            </div>
                            <div className="text-[10px] text-white/40 mt-0.5">
                              {u.type === 'student' && `${u.major?.name || ''}`}
                              {u.type === 'admin' && u.college && `${u.college.name}`}
                              {u.type === 'lecturer' && 'Lecturer Faculty'}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleImpersonateUser(u.type, u.id, u.name, u.roleLabel)}
                                className="px-3 py-1.5 rounded-lg text-[10px] font-extrabold flex items-center gap-1 border border-[var(--accent)]/20 bg-[var(--accent-dim)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black transition-all cursor-pointer"
                              >
                                impersonate 🔑
                              </button>
                              <button
                                onClick={() => handlePurgeUser(u.type, u.id, u.name)}
                                className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/15 hover:border-red-500/40 transition-all cursor-pointer"
                              >
                                Purge 🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Tab: Database Console & Inspector */}
        {activeTab === 'database' && (
          <motion.div
            key="database-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 xl:grid-cols-4 gap-6"
          >
            {/* Left: Diagnostics & Health Telemetry */}
            <div className="xl:col-span-1 space-y-6">
              {/* Database Health Score */}
              <div className="frosted-panel rounded-2xl p-6 border border-white/5 bg-white/2 space-y-4">
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  🗄️ {isAr ? 'نزاهة قاعدة البيانات' : 'Database Health'}
                </h3>
                <div className="flex flex-col items-center justify-center py-4">
                  <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle
                        cx="72"
                        cy="72"
                        r="60"
                        stroke="rgba(255,255,255,0.04)"
                        strokeWidth="10"
                        fill="transparent"
                      />
                      <motion.circle
                        cx="72"
                        cy="72"
                        r="60"
                        stroke={(diagnostics?.healthScore ?? 100) > 90 ? '#10b981' : (diagnostics?.healthScore ?? 100) > 70 ? '#f59e0b' : '#ef4444'}
                        strokeWidth="10"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 60}
                        initial={{ strokeDashoffset: 2 * Math.PI * 60 }}
                        animate={{ strokeDashoffset: (2 * Math.PI * 60) - ((diagnostics?.healthScore ?? 100) / 100) * (2 * Math.PI * 60) }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center justify-center text-center">
                      <span className="text-3xl font-mono font-black text-white">
                        {diagnostics?.healthScore ?? 100}%
                      </span>
                      <span className="text-[9px] text-white/50 font-black uppercase mt-1">
                        {isAr ? 'مؤشر النزاهة' : 'Integrity Index'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Database Metrics Stats */}
                <div className="space-y-2 font-mono text-xs text-white/80 border-t border-white/5 pt-4">
                  <div className="flex justify-between items-center py-1">
                    <span className="text-white/40">{isAr ? 'حجم البيانات' : 'Storage Size'}</span>
                    <span className="text-white font-bold">{diagnostics?.dbSize ?? '—'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-white/40">{isAr ? 'معدل إصابة الفهرس' : 'Index Hit Rate'}</span>
                    <span className="text-emerald-400 font-bold">{diagnostics?.indexHitRate ?? '99.9'}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-white/40">{isAr ? 'اتصالات نشطة' : 'Active Connections'}</span>
                    <span className="text-white font-bold">{diagnostics?.activeConnections ?? '—'}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-white/40">{isAr ? 'زمن الاستجابة' : 'Ping Latency'}</span>
                    <span className="font-bold" style={{ color: (diagnostics?.dbLatency ?? 0) < 50 ? '#10b981' : '#f59e0b' }}>
                      {diagnostics?.dbLatency ?? '—'} ms
                    </span>
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fetchDbDiagnostics(false)}
                  disabled={diagnosticsLoading}
                  className="w-full py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-50"
                >
                  🔄 {diagnosticsLoading ? (isAr ? 'جاري الفحص...' : 'Scanning...') : (isAr ? 'تشغيل فحص السلامة' : 'Run Diagnostics Scan')}
                </motion.button>
              </div>

              {/* Integrity Warning Alerts */}
              <div className="frosted-panel rounded-2xl p-6 border border-white/5 bg-white/2 space-y-4">
                <h4 className="text-xs font-black text-white uppercase tracking-wider">
                  ⚠️ {isAr ? 'تنبيهات سلامة النظام' : 'Integrity Alerts'}
                </h4>
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {diagnostics?.warnings && diagnostics.warnings.length > 0 ? (
                    diagnostics.warnings.map((warn, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-xl border text-xs font-semibold ${
                          warn.type === 'WARNING'
                            ? 'bg-amber-500/5 border-amber-500/20 text-amber-300'
                            : 'bg-red-500/5 border-red-500/20 text-red-300'
                        }`}
                      >
                        <div className="font-bold flex items-center gap-1">
                          <span>⚠️</span>
                          <span>{warn.type}</span>
                        </div>
                        <p className="mt-1.5 leading-relaxed text-[11px] font-medium">
                          {isAr ? warn.message : warn.messageEn}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-6 text-white/30 text-xs font-bold">
                      ✨ {isAr ? 'جميع جداول البيانات سليمة تماماً!' : 'All database checks passed cleanly!'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Database Inspector (Tables dropdown + Query results grid) */}
            <div className="xl:col-span-3 space-y-6">
              {/* Tables selector & Search Bar */}
              <div className="frosted-panel rounded-2xl p-5 border border-white/5 bg-white/2 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-wrap flex-1">
                  <div className="w-full md:w-64">
                    <label className="text-[9px] uppercase font-black text-white/40 block mb-1">
                      {isAr ? 'اختر جدول البيانات للمعاينة' : 'Select Database Model'}
                    </label>
                    <select
                      value={selectedTable}
                      onChange={e => handleTableChange(e.target.value)}
                      className="w-full px-3 py-2.5 bg-black border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[var(--accent)] font-black uppercase cursor-pointer"
                    >
                      {dbTables.map(t => (
                        <option key={t.name} value={t.name} className="bg-black text-white">
                          📁 {t.name} ({t.count} {isAr ? 'سجلات' : 'rows'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1 min-w-[200px] mt-4 md:mt-0">
                    <label className="text-[9px] uppercase font-black text-white/40 block mb-1">
                      {isAr ? 'البحث السريع في السجلات' : 'Search Record Filters'}
                    </label>
                    <input
                      type="text"
                      value={dbSearch}
                      onChange={e => {
                        setDbSearch(e.target.value);
                        setDbPage(1);
                      }}
                      placeholder={isAr ? 'بحث بالاسم، البريد الإلكتروني، الكود...' : 'Search by name, email, code...'}
                      className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[var(--accent)] font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Paginated Grid Display */}
              <div className="frosted-panel rounded-2xl overflow-hidden border border-white/5 bg-white/2 flex flex-col">
                <div className="p-4 border-b border-white/5 bg-white/1 flex items-center justify-between flex-wrap gap-3">
                  <h3 className="text-xs font-black uppercase text-white tracking-widest">
                    🗂️ {isAr ? `استعلامات: ${selectedTable}` : `Query Results: ${selectedTable}`}
                  </h3>
                  <span className="px-2.5 py-0.5 text-[10px] font-mono rounded bg-white/5 text-white/60">
                    {isAr ? `إجمالي السجلات: ${tableData?.total ?? 0}` : `Total Rows: ${tableData?.total ?? 0}`}
                  </span>
                </div>

                {dbLoading ? (
                  <div className="py-24 flex flex-col items-center justify-center gap-3">
                    <span className="h-8 w-8 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[10px] font-bold text-white/40 tracking-wider uppercase">
                      {isAr ? 'جاري جلب سجلات الجدول...' : 'Querying table rows...'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left" dir="ltr">
                      <thead>
                        <tr className="bg-white/5 text-white/40 border-b border-white/5 text-[9px] font-black uppercase tracking-wider">
                          {(tableData?.columns || []).map(col => (
                            <th key={col} className="p-4 whitespace-nowrap">
                              {col}
                            </th>
                          ))}
                          {(tableData?.columns || []).length === 0 && (
                            <th className="p-4 text-center">Empty Schema</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono text-[11px] text-white/80">
                        {(tableData?.rows || []).map((row, rowIndex) => (
                          <tr key={rowIndex} className="hover:bg-white/5 transition-colors">
                            {(tableData?.columns || []).map(col => {
                              const val = row[col];
                              let displayVal = '';

                              if (val === null || val === undefined) {
                                displayVal = 'null';
                              } else if (typeof val === 'boolean') {
                                displayVal = val ? 'true' : 'false';
                              } else if (typeof val === 'object') {
                                displayVal = JSON.stringify(val);
                              } else if (col.toLowerCase().includes('password')) {
                                displayVal = '••••••••';
                              } else if (col.toLowerCase().includes('date') || col.toLowerCase().includes('time') || col.toLowerCase().includes('at')) {
                                const d = new Date(val);
                                displayVal = isNaN(d.getTime()) ? String(val) : d.toLocaleString();
                              } else {
                                displayVal = String(val);
                              }

                              return (
                                <td key={col} className="p-4 max-w-xs truncate" title={displayVal}>
                                  {col === 'id' ? (
                                    <span className="px-1.5 py-0.5 rounded bg-[var(--accent-dim)] text-[var(--accent)] font-black">
                                      {displayVal}
                                    </span>
                                  ) : val === null || val === undefined ? (
                                    <span className="text-white/20 italic">{displayVal}</span>
                                  ) : typeof val === 'boolean' ? (
                                    <span className={val ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                      {displayVal}
                                    </span>
                                  ) : (
                                    displayVal
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        {(tableData?.rows || []).length === 0 && (
                          <tr>
                            <td
                              colSpan={(tableData?.columns || []).length || 1}
                              className="p-16 text-center text-white/30 font-bold font-sans text-sm"
                            >
                              {isAr ? 'لا يوجد أي سجلات مطابقة في هذا الجدول.' : 'No records found matching this query.'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination Controls */}
                {tableData && tableData.total > dbLimit && (
                  <div className="p-4 border-t border-white/5 bg-white/1 flex items-center justify-between gap-4 flex-wrap">
                    <span className="text-[11px] text-white/40 font-semibold font-sans">
                      {isAr
                        ? `عرض ${((dbPage - 1) * dbLimit) + 1} إلى ${Math.min(dbPage * dbLimit, tableData.total)} من أصل ${tableData.total} سجل`
                        : `Showing ${((dbPage - 1) * dbLimit) + 1} to ${Math.min(dbPage * dbLimit, tableData.total)} of ${tableData.total} rows`}
                    </span>

                    <div className="flex gap-2">
                      <button
                        onClick={() => setDbPage(p => Math.max(1, p - 1))}
                        disabled={dbPage === 1 || dbLoading}
                        className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-sans"
                      >
                        ← {isAr ? 'السابق' : 'Previous'}
                      </button>
                      <button
                        onClick={() => setDbPage(p => Math.min(Math.ceil(tableData.total / dbLimit), p + 1))}
                        disabled={dbPage >= Math.ceil(tableData.total / dbLimit) || dbLoading}
                        className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-sans"
                      >
                        {isAr ? 'التالي' : 'Next'} →
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Tab 6: SSE Notification Logs terminal & Lecturer rescheduling requests table */}
        {activeTab === 'logs' && (
          <motion.div
            key="logs-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6 animate-fade-in"
          >
            {/* Terminal log output */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black uppercase text-white tracking-widest">📡 {isAr ? 'سجلات البث المباشر (SSE Terminal)' : 'SSE Broadcast Logs'}</h3>
                <button onClick={() => fetchTelemetry()} className="px-3 py-1 text-[10px] bg-white/5 hover:bg-white/10 rounded-lg border border-white/10">🔄 Reload</button>
              </div>

              <div className="frosted-panel rounded-2xl overflow-hidden flex flex-col border border-white/10 bg-[var(--bg-elevated)]">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5 bg-white/1 select-none">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                  <span className="ml-3 font-mono text-[10px] text-white/40">sse-telemetry-feed.log</span>
                </div>
                <div className="p-5 space-y-2.5 font-mono text-xs max-h-[300px] overflow-y-auto">
                  {recentLogs.map((log) => (
                    <div key={log.id} className="flex items-start gap-4 hover:bg-white/2 p-2 rounded transition-colors">
                      <span className="text-[10px] text-white/30 shrink-0 font-sans">
                        {formatDateSafe(log.sentTime)}
                      </span>
                      <span className="shrink-0 text-emerald-400 font-bold">✓</span>
                      <div className="flex-1 space-y-1">
                        <p className="text-white/80 font-semibold font-sans">{log.message}</p>
                        <div className="flex gap-2">
                          <span className="px-2 py-0.5 rounded bg-blue-900/30 text-blue-400 text-[9px] font-sans">Group: {log.group?.name || 'ALL'}</span>
                          <span className="px-2 py-0.5 rounded bg-teal-900/30 text-teal-400 text-[9px] font-sans uppercase">Status: {log.status}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {recentLogs.length === 0 && (
                    <p className="text-center py-6 text-white/40">{isAr ? 'لا يوجد سجلات حالياً' : 'System logs are currently empty.'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Reschedule requests */}
            <div className="space-y-3">
              <h3 className="text-sm font-black uppercase text-white tracking-widest">📬 {isAr ? 'طلبات تعديل الجداول المقدمة' : 'Lecturer Reschedule Requests'}</h3>
              
              <div className="frosted-panel rounded-2xl overflow-hidden border border-white/5 bg-white/2">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left" dir={isAr ? 'rtl' : 'ltr'}>
                    <thead>
                      <tr className="bg-white/5 text-white/40 border-b border-white/5 text-[9px] font-black uppercase tracking-wider">
                        <th className="p-4">Lecturer</th>
                        <th className="p-4">Subject</th>
                        <th className="p-4">Request</th>
                        <th className="p-4">Details</th>
                        <th className="p-4">Reason</th>
                        <th className="p-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentRequests.map((req) => (
                        <tr key={req.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                          <td className="p-4 font-bold text-white">{req.lecturer?.name || '—'}</td>
                          <td className="p-4 font-mono">{req.schedule?.subject?.name || '—'}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${
                              req.requestType === 'CANCEL' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'
                            }`}>
                              {req.requestType}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-white/70 text-[10px]">
                            {req.requestType === 'CANCEL' ? 'Cancel lecture' : `${req.newDayOfWeek || ''} @ ${req.newStartTime || ''}`}
                          </td>
                          <td className="p-4 text-white/60">{req.reason || '—'}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase ${
                              req.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                              req.status === 'APPROVED' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                              'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>
                              {req.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {recentRequests.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-white/40">{isAr ? 'لا يوجد طلبات تعديل حتى الآن' : 'No lecturer reschedule requests found.'}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal: Tenant Branding & Feature Flags Customizer ────── */}
      <AnimatePresence>
        {editTenantModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.form
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onSubmit={saveTenantConfig}
              className="bg-[#0e0e0e] border border-white/10 p-6 rounded-2xl w-full max-w-lg space-y-4 backdrop-blur-xl relative overflow-y-auto max-h-[90vh]"
            >
              <button
                type="button"
                onClick={() => setEditTenantModal(prev => ({ ...prev, open: false }))}
                className="absolute top-4 left-4 text-white/50 hover:text-white w-8 h-8 rounded-full bg-white/5 flex items-center justify-center transition-all"
              >
                ✕
              </button>

              <div>
                <h3 className="text-base font-black text-white">⚙️ {isAr ? 'تخصيص هوية المستأجر' : 'Configure Tenant Branding'}</h3>
                <p className="text-[10px] text-white/50 font-semibold">{editTenantModal.name} ({editTenantModal.type})</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Branding options */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest">{isAr ? 'الهوية البصرية والروابط' : 'Branding & Domain'}</h4>
                  
                  <div>
                    <label className="text-[9px] uppercase font-black text-white/40 block mb-1">{isAr ? 'لون الثيم (Hex themeColor)' : 'Accent Theme Color (Hex)'}</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={editTenantModal.themeColor}
                        onChange={e => setEditTenantModal(m => ({ ...m, themeColor: e.target.value }))}
                        className="flex-1 px-4 py-2.5 bg-black border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[var(--accent)] font-mono"
                      />
                      <input
                        type="color"
                        value={editTenantModal.themeColor}
                        onChange={e => setEditTenantModal(m => ({ ...m, themeColor: e.target.value }))}
                        className="w-10 h-10 border border-white/10 rounded-lg cursor-pointer bg-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] uppercase font-black text-white/40 block mb-1">{isAr ? 'رابط الشعار المخصص' : 'Custom Logo Image URL'}</label>
                    <input
                      type="text"
                      value={editTenantModal.logoUrl}
                      onChange={e => setEditTenantModal(m => ({ ...m, logoUrl: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[var(--accent)] font-mono"
                      placeholder="/hajjah-logo.png"
                    />
                  </div>

                  <div>
                    <label className="text-[9px] uppercase font-black text-white/40 block mb-1">{isAr ? 'النطاق/الدومين المخصص' : 'Custom subdomain/domain'}</label>
                    <input
                      type="text"
                      value={editTenantModal.customDomain}
                      onChange={e => setEditTenantModal(m => ({ ...m, customDomain: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-[var(--accent)] font-mono"
                      placeholder="hajjah.manar.edu"
                    />
                  </div>
                </div>

                {/* Feature switches board */}
                <div className="space-y-2 border-t md:border-t-0 md:border-l border-white/5 pt-3 md:pt-0 md:pl-4">
                  <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest">{isAr ? 'تفعيل الميزات والخيارات' : 'Feature Flags Switchboard'}</h4>
                  
                  <Toggle
                    label={isAr ? 'الحضور بالـ QR' : 'Dynamic QR Attendance'}
                    sublabel="Enable lecturer QR scanner module"
                    value={editTenantModal.features.qrAttendance}
                    onChange={v => setEditTenantModal(m => ({ ...m, features: { ...m.features, qrAttendance: v } }))}
                  />

                  <Toggle
                    label={isAr ? 'التنبيهات المنبثقة' : 'Web Push Notifications'}
                    sublabel="Enable student PWA notification queue"
                    value={editTenantModal.features.pushNotifications}
                    onChange={v => setEditTenantModal(m => ({ ...m, features: { ...m.features, pushNotifications: v } }))}
                  />

                  <Toggle
                    label={isAr ? 'المولد التلقائي للامتحانات' : 'Automated Exams Scheduler'}
                    sublabel="Enables exams scheduling and halls matrix"
                    value={editTenantModal.features.examsScheduler}
                    onChange={v => setEditTenantModal(m => ({ ...m, features: { ...m.features, examsScheduler: v } }))}
                  />

                  <Toggle
                    label={isAr ? 'ملخص الجدول اليومي' : 'Daily Schedule Summaries'}
                    sublabel="Trigger automated summaries every morning"
                    value={editTenantModal.features.emailDailySummary}
                    onChange={v => setEditTenantModal(m => ({ ...m, features: { ...m.features, emailDailySummary: v } }))}
                  />

                  <Toggle
                    label={isAr ? 'لوحات التحليل البياني' : 'Analytics Dashboards'}
                    sublabel="Unlock charts/histograms on overview slates"
                    value={editTenantModal.features.analyticsDashboard}
                    onChange={v => setEditTenantModal(m => ({ ...m, features: { ...m.features, analyticsDashboard: v } }))}
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black rounded-xl text-xs font-black transition-all cursor-pointer"
                >
                  {isAr ? 'حفظ التخصيص' : 'Save Tenant Config'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditTenantModal(prev => ({ ...prev, open: false }))}
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* ── Modal: Tree hierarchy creation / editing modal ─────── */}
      <AnimatePresence>
        {editModal.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <motion.form
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onSubmit={handleSaveTreeEntity}
              className="bg-[#0e0e0e] border border-white/10 p-6 rounded-2xl w-full max-w-md space-y-4 backdrop-blur-xl relative"
            >
              <button
                type="button"
                onClick={() => setEditModal(prev => ({ ...prev, open: false }))}
                className="absolute top-4 left-4 text-white/50 hover:text-white w-8 h-8 rounded-full bg-white/5 flex items-center justify-center transition-all"
              >
                ✕
              </button>

              <h3 className="text-base font-black text-white">
                {editModal.item ? '✏️ ' + (isAr ? 'تعديل' : 'Edit') : '➕ ' + (isAr ? 'إضافة' : 'Add')}{' '}
                {isAr ? {
                  governorate: 'محافظة',
                  university: 'جامعة',
                  college: 'كلية',
                  department: 'قسم',
                  major: 'تخصص'
                }[editModal.type] : editModal.type}
              </h3>

              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-[10px] uppercase font-black text-white/40 block mb-1">{isAr ? 'الاسم' : 'Name'}</label>
                  <input
                    type="text"
                    required
                    value={editModal.name}
                    onChange={e => setEditModal(m => ({ ...m, name: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[var(--accent)] font-bold"
                  />
                </div>

                {(editModal.type === 'university' || editModal.type === 'college') && (
                  <div>
                    <label className="text-[10px] uppercase font-black text-white/40 block mb-1">{isAr ? 'المعرف الفريد (Slug)' : 'Unique Slug'}</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. hajjah-university"
                      value={editModal.slug}
                      onChange={e => setEditModal(m => ({ ...m, slug: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[var(--accent)] font-mono"
                    />
                  </div>
                )}

                {editModal.type === 'university' && (
                  <>
                    <div>
                      <label className="text-[10px] uppercase font-black text-white/40 block mb-1">{isAr ? 'لون الثيم الافتراضي' : 'Default Theme Color (Hex)'}</label>
                      <input
                        type="text"
                        placeholder="#60c4ff"
                        value={editModal.themeColor}
                        onChange={e => setEditModal(m => ({ ...m, themeColor: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[var(--accent)] font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-black text-white/40 block mb-1">{isAr ? 'رابط الشعار الافتراضي' : 'Default Logo Image URL'}</label>
                      <input
                        type="text"
                        placeholder="/logo-default.png"
                        value={editModal.logoUrl}
                        onChange={e => setEditModal(m => ({ ...m, logoUrl: e.target.value }))}
                        className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[var(--accent)] font-mono"
                      />
                    </div>
                  </>
                )}

                {editModal.type === 'college' && (
                  <div>
                    <label className="text-[10px] uppercase font-black text-white/40 block mb-1">{isAr ? 'الموقع' : 'Location'}</label>
                    <input
                      type="text"
                      value={editModal.location}
                      onChange={e => setEditModal(m => ({ ...m, location: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-black border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[var(--accent)]"
                    />
                  </div>
                )}
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-[var(--accent)] hover:bg-[var(--accent-dim)] text-black rounded-xl text-xs font-extrabold transition-all cursor-pointer"
                >
                  {isAr ? 'حفظ' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditModal(prev => ({ ...prev, open: false }))}
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>

      {/* Warning/Delete Modals */}
      <ErrorModal
        isOpen={deletingUser.open}
        type="confirm"
        title={isAr ? 'تأكيد الحذف النهائي والتطهير' : 'Confirm User Purge'}
        message={isAr
          ? `هل أنت متأكد من حذف حساب "${deletingUser.name}" (${deletingUser.type}) نهائياً من قاعدة البيانات؟ سيتم مسح حضورهم وجداولهم وجميع متعلقاتهم، ولا يمكن التراجع.`
          : `Are you sure you want to permanently purge "${deletingUser.name}" (${deletingUser.type}) from the database? All related schedules, logs, and attendances will be removed. This cannot be undone.`}
        onConfirm={confirmPurgeUser}
        onCancel={() => setDeletingUser({ open: false, type: '', id: null, name: '' })}
      />

      <ErrorModal
        isOpen={confirmModal.open}
        type={confirmModal.type}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(m => ({ ...m, open: false }))}
      />
    </motion.div>
  );
}
