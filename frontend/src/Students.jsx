import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { motion } from 'framer-motion';
import { API_URL } from './config';

export default function Students() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [impersonatingId, setImpersonatingId] = useState(null);
  const [togglingRepId, setTogglingRepId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUnverifiedOnly, setShowUnverifiedOnly] = useState(false);
  const [groupBy, setGroupBy] = useState('none'); // 'none', 'college', 'department', 'group'
  // ── Cascading hierarchy filters: Major → Level → Group ──────────────────────
  const [filterMajor, setFilterMajor] = useState('ALL');
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [filterGroup, setFilterGroup] = useState('ALL');
  const [visibleCount, setVisibleCount] = useState(15);

  useEffect(() => {
    setVisibleCount(15);
  }, [filterMajor, filterLevel, filterGroup, searchQuery, showUnverifiedOnly, groupBy]);

  // Phase 3: Reset Password States
  const [resettingId, setResettingId] = useState(null);
  const [tempPassword, setTempPassword] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [resetStudentName, setResetStudentName] = useState('');

  const getGroupedStudents = () => {
    const displayedStudents = filteredStudents.slice(0, visibleCount);
    if (groupBy === 'none') return { 'all': displayedStudents };
    
    const groups = {};
    displayedStudents.forEach(student => {
      let key = isAr ? 'أخرى / غير محدد' : 'Other / Non-assigned';
      if (groupBy === 'college') {
        key = student.college?.name || student.group?.college?.name || (isAr ? 'بدون كلية' : 'No College');
      } else if (groupBy === 'department') {
        key = student.major?.department?.name || (isAr ? 'بدون قسم' : 'No Department');
      } else if (groupBy === 'group') {
        key = student.group?.name || (isAr ? 'بدون شعبة' : 'No Group');
      }
      if (!groups[key]) groups[key] = [];
      groups[key].push(student);
    });
    return groups;
  };

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('manar_token');
      const userJson = localStorage.getItem('manar_user');
      let userObj = null;
      try { userObj = JSON.parse(userJson); } catch {}

      let url = `${API_URL}/api/students`;
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
        setStudents(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch students:', err);
      toast.error('Failed to retrieve student directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();

    const handleCollegeSwitch = () => {
      console.log('[Students] College switch event detected, reloading student list.');
      fetchStudents();
    };

    window.addEventListener('MANAR_COLLEGE_SWITCH', handleCollegeSwitch);
    return () => {
      window.removeEventListener('MANAR_COLLEGE_SWITCH', handleCollegeSwitch);
    };
  }, []);

  const handleImpersonate = async (student) => {
    setImpersonatingId(student.id);
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.post(
        `${API_URL}/api/auth/impersonate`,
        { studentId: student.id },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );

      if (res.data && res.data.success) {
        const { token: studentToken, user: studentUser } = res.data;

        // Store active admin session credentials in a separate cache if we want to restore later,
        // or just perform direct overwriting per phase requirements.
        localStorage.setItem('manar_token', studentToken);
        localStorage.setItem('manar_user', JSON.stringify(studentUser));

        // Create student_profile cache
        localStorage.setItem('student_profile', JSON.stringify({
          name: student.name,
          email: student.email,
          department: student.major?.department?.name || 'Default Department',
          level: student.level?.name || 'Default Level',
          groupId: student.groupId
        }));

        toast.success(`God Mode Activated: Logged in as ${student.name}`);
        navigate('/student/home');
      }
    } catch (err) {
      console.error('Impersonation failed:', err);
      const errMsg = err.response?.data?.error || 'Failed to authenticate impersonated session';
      toast.error(errMsg);
    } finally {
      setImpersonatingId(null);
    }
  };

  const handleToggleRep = async (student) => {
    setTogglingRepId(student.id);
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.put(
        `${API_URL}/api/admin/students/${student.id}/representative-status`,
        { isRepresentative: !student.isRepresentative },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (res.data && res.data.success) {
        toast.success(isAr ? 'تم تحديث صلاحيات المندوب' : 'Representative status updated');
        setStudents(students.map(s => s.id === student.id ? { ...s, isRepresentative: res.data.data.isRepresentative } : s));
      }
    } catch (err) {
      console.error('Failed to toggle representative:', err);
      toast.error(isAr ? 'فشل التحديث' : 'Failed to update status');
    } finally {
      setTogglingRepId(null);
    }
  };

  const handleResetPassword = async (student) => {
    if (!window.confirm(isAr 
      ? `هل أنت متأكد من إعادة ضبط كلمة مرور الطالب ${student.name}؟` 
      : `Are you sure you want to reset the password for student ${student.name}?`
    )) return;
    
    setResettingId(student.id);
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.post(
        `${API_URL}/api/admin/students/${student.id}/reset-password`,
        {},
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (res.data && res.data.success) {
        setTempPassword(res.data.tempPassword);
        setResetStudentName(student.name);
        setShowSuccessModal(true);
        toast.success(isAr ? 'تم إعادة تعيين كلمة المرور بنجاح' : 'Password reset successfully');
      }
    } catch (err) {
      console.error('Failed to reset password:', err);
      const errMsg = err.response?.data?.error || (isAr ? 'فشل إعادة تعيين كلمة المرور' : 'Failed to reset password');
      toast.error(errMsg);
    } finally {
      setResettingId(null);
    }
  };

  // ── Derive unique option lists from loaded data (no extra API calls) ─────────
  const allMajors = Array.from(
    new Map(students.map(s => [s.major?.id, s.major]).filter(([id]) => id)).values()
  );
  const allLevels = Array.from(
    new Map(
      students
        .filter(s => filterMajor === 'ALL' || String(s.major?.id) === filterMajor)
        .map(s => [s.level?.id, s.level])
        .filter(([id]) => id)
    ).values()
  );
  const allGroups = Array.from(
    new Map(
      students
        .filter(s => filterMajor === 'ALL' || String(s.major?.id) === filterMajor)
        .filter(s => filterLevel === 'ALL' || String(s.level?.id) === filterLevel)
        .map(s => [s.group?.id, s.group])
        .filter(([id]) => id)
    ).values()
  );

  // Filter students based on query, verification status, and cascading hierarchy
  const filteredStudents = students.filter(student => {
    const query = searchQuery.toLowerCase();
    const matchesSearch = (
      student.name.toLowerCase().includes(query) ||
      student.email.toLowerCase().includes(query) ||
      student.idNumber.toLowerCase().includes(query)
    );
    const matchesUnverified = !showUnverifiedOnly || (student.isEmailVerified === false || student.isPhoneVerified === false);
    const matchesMajor = filterMajor === 'ALL' || String(student.major?.id) === filterMajor;
    const matchesLevel = filterLevel === 'ALL' || String(student.level?.id) === filterLevel;
    const matchesGroup = filterGroup === 'ALL' || String(student.group?.id) === filterGroup;
    return matchesSearch && matchesUnverified && matchesMajor && matchesLevel && matchesGroup;
  });

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="flex-1 bg-transparent p-4 md:p-8 space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2,var(--accent))]">
            {t('students.title')}
          </h2>
          <p className="text-sm text-gray-400">{t('students.subtitle')}</p>
        </div>
        
        {/* ── Cascading Hierarchy Filter: Major → Level → Group ────────────── */}
        <div className="flex flex-wrap items-center gap-2 bg-white/[0.03] border border-white/10 rounded-xl p-3">
          {/* Total counter */}
          <span className="text-[10px] font-black text-[var(--accent)] bg-[var(--accent-dim)] border border-[var(--accent-glow)] px-2.5 py-1 rounded-lg shrink-0">
            {filteredStudents.length} {isAr ? 'طالب' : 'students'}
          </span>

          {/* Major filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest shrink-0">
              {isAr ? 'التخصص' : 'Major'}
            </span>
            <select
              value={filterMajor}
              onChange={e => { setFilterMajor(e.target.value); setFilterLevel('ALL'); setFilterGroup('ALL'); }}
              className="bg-white/5 border border-white/10 rounded-lg text-[11px] font-bold text-white px-2.5 py-1.5 focus:outline-none focus:border-[var(--accent)] cursor-pointer max-w-[140px] truncate"
            >
              <option value="ALL">{isAr ? 'كل التخصصات' : 'All Majors'}</option>
              {allMajors.map(m => (
                <option key={m.id} value={String(m.id)}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Chevron separator */}
          <span className="text-slate-700 font-black text-xs">›</span>

          {/* Level filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest shrink-0">
              {isAr ? 'المستوى' : 'Level'}
            </span>
            <select
              value={filterLevel}
              onChange={e => { setFilterLevel(e.target.value); setFilterGroup('ALL'); }}
              disabled={allLevels.length === 0}
              className="bg-white/5 border border-white/10 rounded-lg text-[11px] font-bold text-white px-2.5 py-1.5 focus:outline-none focus:border-[var(--accent)] cursor-pointer disabled:opacity-40 max-w-[120px]"
            >
              <option value="ALL">{isAr ? 'كل المستويات' : 'All Levels'}</option>
              {allLevels.map(l => (
                <option key={l.id} value={String(l.id)}>{l.name}</option>
              ))}
            </select>
          </div>

          {/* Chevron separator */}
          <span className="text-slate-700 font-black text-xs">›</span>

          {/* Group filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest shrink-0">
              {isAr ? 'الشعبة' : 'Group'}
            </span>
            <select
              value={filterGroup}
              onChange={e => setFilterGroup(e.target.value)}
              disabled={allGroups.length === 0}
              className="bg-white/5 border border-white/10 rounded-lg text-[11px] font-bold text-white px-2.5 py-1.5 focus:outline-none focus:border-[var(--accent)] cursor-pointer disabled:opacity-40 max-w-[110px]"
            >
              <option value="ALL">{isAr ? 'كل الشعب' : 'All Groups'}</option>
              {allGroups.map(g => (
                <option key={g.id} value={String(g.id)}>{g.name}</option>
              ))}
            </select>
          </div>

          {/* Clear filters */}
          {(filterMajor !== 'ALL' || filterLevel !== 'ALL' || filterGroup !== 'ALL') && (
            <button
              onClick={() => { setFilterMajor('ALL'); setFilterLevel('ALL'); setFilterGroup('ALL'); }}
              className="text-[10px] font-black text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-400/40 bg-red-500/5 hover:bg-red-500/10 px-2 py-1 rounded-lg transition-all"
            >
              {isAr ? '× مسح الفلاتر' : '× Clear'}
            </button>
          )}
        </div>

        {/* Secondary controls: groupBy + unverified toggle + search */}
        <div className="flex flex-wrap w-full md:w-auto items-center gap-3">
          {/* Grouping Filter Selector */}
          <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10 shrink-0">
            {[
              { id: 'none', label: isAr ? 'عرض الكل' : 'Show All' },
              { id: 'college', label: isAr ? 'حسب الكلية' : 'By College' },
              { id: 'department', label: isAr ? 'حسب القسم' : 'By Department' },
              { id: 'group', label: isAr ? 'حسب الشعبة' : 'By Group' }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setGroupBy(item.id)}
                className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${
                  groupBy === item.id 
                    ? 'bg-[var(--accent)] text-black font-extrabold shadow-sm' 
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowUnverifiedOnly(!showUnverifiedOnly)}
            className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all border shrink-0 ${
              showUnverifiedOnly
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-white hover:bg-white/10'
            }`}
          >
            ⚠️ {isAr ? 'الحسابات غير الموثقة فقط' : 'Unverified Accounts Only'}
          </button>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('students.searchPlaceholder')}
            className="w-full md:w-60 bg-gray-955/50 border border-white/10 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[var(--accent)] font-medium"
          />
        </div>
      </div>

      {/* Grid of Student Cards / Grouped Categories */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <span className="h-8 w-8 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-gray-900/30 backdrop-blur-md border border-white/10 rounded-xl p-12 text-center text-gray-450 text-xs">
          {t('students.noRecords')}
        </div>
      ) : (
        <div className="space-y-8">
          {Object.keys(getGroupedStudents()).map(categoryName => {
            const categoryStudents = getGroupedStudents()[categoryName];
            return (
              <div key={categoryName} className="space-y-4">
                {groupBy !== 'none' && (
                  <div className="flex items-center gap-3 border-b border-white/5 pb-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      {categoryName} <span className="text-[10px] text-slate-500 font-mono font-bold">({categoryStudents.length})</span>
                    </h3>
                  </div>
                )}
                
                <motion.div 
                  variants={containerVariants}
                  initial="hidden"
                  animate="show"
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
                >
                  {categoryStudents.map(student => (
                    <motion.div 
                      variants={itemVariants}
                      key={student.id} 
                      className="bg-gray-900/20 backdrop-blur-md border border-white/10 rounded-xl p-5 hover:border-[var(--accent-glow)] transition duration-300 flex flex-col justify-between space-y-4 shadow-lg group relative overflow-hidden"
                    >
                      {/* Highlight accent for super admin impersonation potential */}
                      <div className="absolute top-0 right-0 h-1.5 w-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2,var(--accent))] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      <div className="space-y-3">
                        {/* Avatar / Profile Row */}
                        <div className="flex items-center gap-3.5">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[var(--accent)]/20 to-[var(--accent-glow)]/10 border border-[var(--accent-glow)]/40 flex items-center justify-center font-black text-xs text-[var(--accent)]">
                            {student.name ? student.name.split(' ').slice(0, 2).map(n => n[0]).join('') : 'ST'}
                          </div>
                          
                          <div className="overflow-hidden">
                            <h3 className="font-bold text-sm text-white truncate flex items-center gap-1.5">
                              {student.name}
                              {student.isRepresentative && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] bg-green-500/20 text-green-300 font-bold shrink-0">
                                  {isAr ? 'مندوب' : 'Rep'}
                                </span>
                              )}
                            </h3>
                            <p className="text-[10px] font-mono text-gray-400 truncate">{student.email}</p>
                          </div>
                        </div>

                        {/* Program Details Table */}
                        <div className="bg-gray-955/50 rounded-lg p-3 border border-white/5 space-y-1.5 text-[11px]">
                          <div className="flex justify-between">
                            <span className="text-gray-450">{t('students.studentId')}</span>
                            <span className="font-bold text-white">{student.idNumber}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-455">{t('students.phone')}</span>
                            <span className="text-gray-300 font-medium">{student.phone || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-455">{t('students.department')}</span>
                            <span className="text-gray-300">{student.major?.department?.name || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-455">{t('students.major')}</span>
                            <span className="text-gray-300">{student.major?.name || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-455">{t('students.level')}</span>
                            <span className="text-[var(--accent)]">{student.level?.name || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-455">{t('students.group')}</span>
                            <span className="text-[var(--accent)] font-semibold">{student.group?.name || 'N/A'}</span>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-white/5 items-center">
                            <span className="text-gray-455">{t('students.status')}</span>
                            <div className="flex gap-1">
                              <span className={`px-1.5 py-0.5 rounded-[3px] text-[9px] font-bold ${
                                student.isEmailVerified ? 'bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent-glow)]' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                              }`}>
                                📧 {student.isEmailVerified ? t('students.verifiedBadge') : t('students.pendingBadge')}
                              </span>
                              <span className={`px-1.5 py-0.5 rounded-[3px] text-[9px] font-bold ${
                                student.isPhoneVerified ? 'bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent-glow)]' : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                              }`}>
                                📱 {student.isPhoneVerified ? t('students.verifiedBadge') : t('students.pendingBadge')}
                              </span>
                            </div>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-white/5 items-center mt-1">
                            <span className="text-gray-455">{isAr ? 'مندوب شعبة' : 'Representative'}</span>
                            <button
                              onClick={() => handleToggleRep(student)}
                              disabled={togglingRepId === student.id}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                                student.isRepresentative
                                  ? 'bg-[var(--accent)] text-black border border-[var(--accent)] hover:bg-[var(--accent-dim)] hover:text-white'
                                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
                              }`}
                            >
                              {togglingRepId === student.id ? '...' : student.isRepresentative ? (isAr ? 'نعم' : 'Yes') : (isAr ? 'لا' : 'No')}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 w-full">
                        {/* Impersonate Button */}
                        <button
                          onClick={() => handleImpersonate(student)}
                          disabled={impersonatingId !== null}
                          className="py-2 bg-gray-900/60 hover:bg-[var(--accent)] hover:text-black text-[11px] font-extrabold rounded-lg border border-white/10 hover:border-[var(--accent)] text-[var(--accent)] transition-all duration-300 flex items-center justify-center gap-1.5"
                        >
                          {impersonatingId === student.id ? (
                            <span className="h-3.5 w-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <span>🔑</span>
                              <span className="truncate">{t('students.impersonateBtn').split(' ')[0]}</span>
                            </>
                          )}
                        </button>

                        {/* Reset Password Button */}
                        <button
                          onClick={() => handleResetPassword(student)}
                          disabled={resettingId !== null}
                          className="py-2 bg-gray-900/60 hover:bg-red-500 hover:text-white text-[11px] font-extrabold rounded-lg border border-white/10 hover:border-red-500 text-red-400 transition-all duration-300 flex items-center justify-center gap-1.5"
                        >
                          {resettingId === student.id ? (
                            <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <span>🔄</span>
                              <span className="truncate">{isAr ? 'إعادة ضبط' : 'Reset'}</span>
                            </>
                          )}
                        </button>
                      </div>

                    </motion.div>
                  ))}
                </motion.div>
              </div>
            );
          })}

          {filteredStudents.length > visibleCount && (
            <div className="flex justify-center pt-6 pb-4">
              <button
                onClick={() => setVisibleCount(prev => prev + 15)}
                className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-[var(--accent)] hover:shadow-[0_0_15px_var(--accent-glow)] text-white font-bold text-xs transition-all duration-200"
              >
                {isAr ? 'عرض المزيد' : 'Show More'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl w-full max-w-md text-white text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-cyan-500 to-blue-500" />
            
            <span className="text-4xl block mb-3 mt-2">🔑</span>
            <h3 className="text-lg font-black uppercase tracking-wider text-cyan-400 mb-2">
              {isAr ? 'تمت إعادة تعيين كلمة المرور' : 'Password Reset Complete'}
            </h3>
            
            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              {isAr 
                ? `كلمة المرور المؤقتة الجديدة للطالب ${resetStudentName} هي:` 
                : `The new temporary password for student ${resetStudentName} is:`}
            </p>
            
            {/* Password Display Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-4 flex items-center justify-between font-mono text-lg font-bold text-white relative group">
              <span className="select-all tracking-wider">{tempPassword}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(tempPassword);
                  toast.success(isAr ? 'تم النسخ للحافظة' : 'Copied to clipboard');
                }}
                className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-cyan-400 border border-white/5 hover:border-cyan-400/20 transition-all"
              >
                {isAr ? 'نسخ' : 'Copy'}
              </button>
            </div>
            
            <p className="text-[10px] text-amber-400/80 font-bold mb-6 bg-amber-500/5 border border-amber-500/10 p-3 rounded-xl leading-relaxed">
              ⚠️ {isAr 
                ? 'يرجى نسخ كلمة المرور المؤقتة هذه وإعطاؤها للطالب. لن تظهر هذه القيمة مرة أخرى!' 
                : 'Please copy this temporary password and give it to the student. This value will not be shown again!'}
            </p>
            
            <button
              onClick={() => {
                setShowSuccessModal(false);
                setTempPassword('');
                setResetStudentName('');
              }}
              className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black rounded-xl transition-all"
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      )}
      
    </div>
  );
}
