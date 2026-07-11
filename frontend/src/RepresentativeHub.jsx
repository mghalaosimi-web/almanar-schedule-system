import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { API_URL } from './config';
import ConfirmationModal from './ConfirmationModal';

export default function RepresentativeHub() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();

  // ── States ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('home');
  const [classmates, setClassmates] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [attendanceList, setAttendanceList] = useState([]);
  const [priority, setPriority] = useState('normal');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [stats, setStats] = useState({ totalClassmates: 0, attendanceRate: 100 });
  
  // ── Cohort & Advanced Tools States ───────────────────────────────────
  const [subView, setSubView] = useState(null); // 'approvals', 'assignments', 'reschedule', 'summaries', 'logs'
  const [allCohortStudents, setAllCohortStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [cohortLoading, setCohortLoading] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(null);

  // Rescheduling states
  const [rescheduleType, setRescheduleType] = useState('RESCHEDULE');
  const [rescheduleScheduleId, setRescheduleScheduleId] = useState('');
  const [newDayOfWeek, setNewDayOfWeek] = useState('SUNDAY');
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [newRoomId, setNewRoomId] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleHistory, setRescheduleHistory] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Resources states
  const [resources, setResources] = useState([]);
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourcesLoading, setResourcesLoading] = useState(false);

  // Past logs states
  const [pastLogsSelectedScheduleId, setPastLogsSelectedScheduleId] = useState('');
  const [pastLogsSelectedDate, setPastLogsSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [pastLogsAttendance, setPastLogsAttendance] = useState([]);
  const [pastLogsLoading, setPastLogsLoading] = useState(false);
  

  // ── Offline-First Engine ──────────────────────────────────────────
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const token = localStorage.getItem('manar_token');

  // Track connectivity changes
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Auto-sync pending attendance when connectivity is restored
  useEffect(() => {
    if (!isOnline) return;
    const pending = JSON.parse(localStorage.getItem('pendingAttendance') || 'null');
    if (!pending || !pending.syncPending) return;

    // Attempt to flush saved payload to the backend
    axios.post(`${API_URL}/api/rep/attendance`, {
      scheduleId: pending.scheduleId,
      records: pending.records
    }, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      if (res.data?.success) {
        localStorage.removeItem('pendingAttendance');
        toast.success(
          isAr
            ? '📡 تمت المزامنة: تم رفع كشف الحضور المحفوظ محلياً بنجاح!'
            : '📡 Synced: Local attendance record uploaded successfully!',
          { duration: 5000 }
        );
      }
    }).catch(err => {
      console.warn('[Offline Sync] Auto-sync failed — will retry on next online event.', err.message);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // Load classmates, schedules, and stats
  useEffect(() => {
    if (!token) return;
    
    // Fetch classmates
    axios.get(`${API_URL}/api/rep/classmates`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      if (res.data?.success) {
        setClassmates(res.data.data);
      }
    }).catch(err => {
      console.error('Failed to fetch classmates', err);
    });

    // Fetch schedules
    axios.get(`${API_URL}/api/rep/schedules`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      if (res.data?.success) {
        const scheds = res.data.data;
        setSchedules(scheds);
        if (scheds.length > 0) {
          setSelectedScheduleId(scheds[0].id.toString());
        }
      }
    }).catch(err => {
      console.error('Failed to fetch schedules', err);
    });

    // Fetch stats
    axios.get(`${API_URL}/api/rep/dashboard/stats`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      if (res.data?.success) {
        setStats(res.data.data);
      }
    }).catch(err => {
      console.error('Failed to fetch dashboard stats', err);
    });
  }, [token]);

  // Load advanced sub-view data when active sub-view changes
  useEffect(() => {
    if (!token) return;
    const studentUser = JSON.parse(localStorage.getItem('manar_user') || '{}');
    const { collegeId, majorId, levelId } = studentUser;

    if (subView === 'approvals' || subView === 'assignments') {
      setCohortLoading(true);
      axios.get(`${API_URL}/api/representative/students`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        if (res.data?.success) {
          setAllCohortStudents(res.data.data);
        }
      }).catch(err => {
        console.error('Failed to fetch cohort students', err);
      }).finally(() => {
        setCohortLoading(false);
      });
    }

    if (subView === 'assignments') {
      axios.get(`${API_URL}/api/groups?collegeId=${collegeId}&majorId=${majorId}&levelId=${levelId}`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        if (res.data?.success) {
          setGroups(res.data.data);
        }
      }).catch(err => {
        console.error('Failed to fetch groups', err);
      });
    }

    if (subView === 'reschedule') {
      setHistoryLoading(true);
      axios.get(`${API_URL}/api/rep/reschedule/history`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        if (res.data?.success) {
          setRescheduleHistory(res.data.data);
        }
      }).catch(err => {
        console.error('Failed to fetch reschedule history', err);
      }).finally(() => {
        setHistoryLoading(false);
      });

      axios.get(`${API_URL}/api/rooms`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        if (res.data?.success) {
          setRooms(res.data.data);
        }
      }).catch(err => {
        console.error('Failed to fetch rooms', err);
      });
    }

    if (subView === 'summaries') {
      setResourcesLoading(true);
      axios.get(`${API_URL}/api/rep/resources`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(res => {
        if (res.data?.success) {
          setResources(res.data.data);
        }
      }).catch(err => {
        console.error('Failed to fetch resources', err);
      }).finally(() => {
        setResourcesLoading(false);
      });
    }
  }, [subView, token]);

  const handleApproveStudent = async (studentId) => {
    setSubmittingAction(studentId);
    try {
      const res = await axios.post(`${API_URL}/api/rep/students/${studentId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        toast.success(isAr ? 'تم توثيق وقبول حساب الطالب بنجاح!' : 'Student account successfully verified!');
        setAllCohortStudents(prev =>
          prev.map(s => (s.id === studentId ? { ...s, isEmailVerified: true, isPhoneVerified: true } : s))
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل توثيق الحساب.' : 'Failed to verify account.'));
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleRejectStudent = async (studentId) => {
    if (!window.confirm(isAr ? 'هل أنت متأكد من رفض وحذف هذا الطالب نهائياً؟' : 'Are you sure you want to permanently reject and delete this student?')) return;
    setSubmittingAction(studentId);
    try {
      const res = await axios.post(`${API_URL}/api/rep/students/${studentId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        toast.success(isAr ? 'تم رفض وحذف حساب الطالب بنجاح.' : 'Student account rejected and removed.');
        setAllCohortStudents(prev => prev.filter(s => s.id !== studentId));
      }
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل حذف الحساب.' : 'Failed to delete account.'));
    } finally {
      setSubmittingAction(null);
    }
  };

  const handleAssignGroup = async (studentId, groupId) => {
    try {
      const res = await axios.post(`${API_URL}/api/representative/assign`, {
        studentIds: [studentId],
        groupId: groupId === '' ? null : parseInt(groupId)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        toast.success(isAr ? 'تم تعيين وتسكين الطالب في الشعبة بنجاح!' : 'Student assigned to group successfully!');
        setAllCohortStudents(prev =>
          prev.map(s => (s.id === studentId ? { ...s, groupId: groupId === '' ? null : parseInt(groupId) } : s))
        );
      }
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل تسكين الطالب.' : 'Failed to assign group.'));
    }
  };

  const handleRescheduleSubmit = async (e) => {
    e.preventDefault();
    if (!rescheduleScheduleId) {
      toast.error(isAr ? 'الرجاء اختيار الحصة' : 'Please select class');
      return;
    }
    setCohortLoading(true);
    try {
      const payload = {
        scheduleId: parseInt(rescheduleScheduleId),
        requestType: rescheduleType,
        reason: rescheduleReason,
        newDayOfWeek: rescheduleType === 'RESCHEDULE' ? newDayOfWeek : null,
        newStartTime: rescheduleType === 'RESCHEDULE' ? newStartTime : null,
        newEndTime: rescheduleType === 'RESCHEDULE' ? newEndTime : null,
        newRoomId: (rescheduleType === 'RESCHEDULE' && newRoomId) ? parseInt(newRoomId) : null
      };

      const res = await axios.post(`${API_URL}/api/rep/reschedule`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        toast.success(isAr ? 'تم إرسال طلب التعديل بنجاح إلى إدارة الكلية' : 'Adjustment request submitted successfully');
        setRescheduleReason('');
        setNewStartTime('');
        setNewEndTime('');
        setNewRoomId('');
        // Refresh history
        const histRes = await axios.get(`${API_URL}/api/rep/reschedule/history`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (histRes.data?.success) setRescheduleHistory(histRes.data.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل إرسال طلب التعديل.' : 'Failed to submit reschedule request.'));
    } finally {
      setCohortLoading(false);
    }
  };

  const handleAddResourceSubmit = async (e) => {
    e.preventDefault();
    if (!resourceTitle.trim() || !resourceUrl.trim()) {
      toast.error(isAr ? 'الرجاء تعبئة كل الحقول' : 'Please fill all fields');
      return;
    }
    setCohortLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/rep/resources`, {
        title: resourceTitle,
        url: resourceUrl
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        toast.success(isAr ? 'تم نشر ومشاركة الملف بنجاح' : 'Resource added and shared successfully');
        setResourceTitle('');
        setResourceUrl('');
        // Refresh resources
        const resList = await axios.get(`${API_URL}/api/rep/resources`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (resList.data?.success) setResources(resList.data.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل إضافة المرجع.' : 'Failed to add resource.'));
    } finally {
      setCohortLoading(false);
    }
  };

  const handleLoadPastLogs = () => {
    if (!pastLogsSelectedScheduleId) {
      toast.error(isAr ? 'الرجاء اختيار الحصة أولاً' : 'Please select a class first');
      return;
    }
    setPastLogsLoading(true);
    axios.get(`${API_URL}/api/rep/attendance`, {
      params: { scheduleId: pastLogsSelectedScheduleId, date: pastLogsSelectedDate },
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      if (res.data?.success) {
        setPastLogsAttendance(res.data.data);
        if (res.data.data.length === 0) {
          toast.success(isAr ? 'لا يوجد سجل حضور لهذا اليوم' : 'No attendance record found for this day.');
        }
      }
    }).catch(err => {
      console.error(err);
      toast.error(isAr ? 'فشل تحميل سجل الحضور.' : 'Failed to load attendance log.');
    }).finally(() => setPastLogsLoading(false));
  };

  // Load attendance whenever selectedScheduleId changes or classmates load
  useEffect(() => {
    if (!token || !selectedScheduleId || classmates.length === 0) return;

    axios.get(`${API_URL}/api/rep/attendance?scheduleId=${selectedScheduleId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(res => {
      if (res.data?.success) {
        const records = res.data.data;
        const mapped = classmates.map(student => {
          const rec = records.find(r => r.studentId === student.id);
          return {
            ...student,
            isPresent: rec ? rec.status === 'PRESENT' : true // Default to present
          };
        });
        setAttendanceList(mapped);
      }
    }).catch(err => {
      console.error('Failed to fetch attendance records', err);
      // Fallback
      setAttendanceList(classmates.map(c => ({ ...c, isPresent: true })));
    });
  }, [selectedScheduleId, classmates, token]);

  const confirmLogout = () => {
    const token = localStorage.getItem('manar_token');
    if (token) {
      axios.post(`${API_URL}/api/auth/logout`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(err => console.warn('[Logout API] Error logging out:', err.message));
    }
    localStorage.removeItem('manar_token');
    localStorage.removeItem('manar_user');
    localStorage.removeItem('student_profile');
    setIsLogoutModalOpen(false);
    navigate('/login');
  };

  // Calculate live statistics
  const presentCount = attendanceList.filter(s => s.isPresent).length;
  const totalStudents = attendanceList.length;

  const handleToggleAttendance = (studentId) => {
    setAttendanceList(prev =>
      prev.map(s => (s.id === studentId ? { ...s, isPresent: !s.isPresent } : s))
    );
  };

  const handleSubmitAttendance = async (e) => {
    e.preventDefault();
    if (!selectedScheduleId) {
      toast.error(isAr ? 'لم يتم تحديد محاضرة.' : 'No schedule selected.');
      return;
    }

    const records = attendanceList.map(s => ({
      studentId: s.id,
      status: s.isPresent ? 'PRESENT' : 'ABSENT'
    }));

    // ── OFFLINE PATH ──────────────────────────────────────────
    if (!navigator.onLine) {
      localStorage.setItem('pendingAttendance', JSON.stringify({
        syncPending: true,
        savedAt: new Date().toISOString(),
        scheduleId: parseInt(selectedScheduleId),
        records
      }));
      toast(
        isAr
          ? '⚠️ أنت حالياً غير متصل بالإنترنت. تم حفظ التحضير محلياً وستتم المزامنة تلقائياً عند عودة الاتصال.'
          : '⚠️ You are offline. Attendance saved locally and will sync automatically when connection is restored.',
        {
          duration: 8000,
          icon: '📥',
          style: {
            background: '#451a03',
            color: '#fcd34d',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            fontWeight: 'bold'
          }
        }
      );
      return;
    }
    // ─────────────────────────────────────────────────────

    // ── ONLINE PATH ──────────────────────────────────────────
    try {
      const res = await axios.post(`${API_URL}/api/rep/attendance`, {
        scheduleId: parseInt(selectedScheduleId),
        records
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        // Clear any stale offline payload on successful online submit
        localStorage.removeItem('pendingAttendance');
        toast.success(
          isAr
            ? `تم حفظ وإرسال كشف حضور الحصة! (${presentCount}/${totalStudents} حاضرين)`
            : `Attendance list saved and dispatched! (${presentCount}/${totalStudents} present)`,
          {
            style: {
              background: '#1e1b4b',
              color: '#00f59b',
              border: '1px solid rgba(0, 245, 155, 0.3)'
            }
          }
        );
      }
    } catch (err) {
      toast.error(isAr ? 'فشل حفظ الكشف.' : 'Failed to submit attendance.');
    }
    // ──────────────────────────────────────────
  };

  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) {
      toast.error(isAr ? 'الرجاء كتابة نص الإعلان أولاً' : 'Please type your announcement message');
      return;
    }

    try {
      const res = await axios.post(`${API_URL}/api/rep/broadcast`, {
        message: `${priority === 'urgent' ? '🚨 [عاجل] ' : '📢 '}${broadcastMessage}`
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data?.success) {
        toast.success(
          isAr 
            ? `تم بث الإعلان بنجاح! الفئة: [${priority === 'urgent' ? 'عاجل جداً' : 'عادي'}]` 
            : `Announcement broadcasted successfully! Priority: [${priority.toUpperCase()}]`,
          {
            style: {
              background: '#0f172a',
              color: '#fbbf24',
              border: '1px solid rgba(245, 158, 11, 0.3)'
            }
          }
        );
        setBroadcastMessage('');
      }
    } catch (err) {
      toast.error(isAr ? 'فشل بث الإعلان.' : 'Failed to send broadcast.');
    }
  };

  // ── Dynamic Header Details ──────────────────────────────────────────
  const getHeaderDetails = () => {
    switch (activeTab) {
      case 'home':
        return {
          title: isAr ? 'مركز قيادة المندوب' : 'Representative Command Hub',
          subtitle: isAr ? 'إدارة الشؤون التنظيمية والتنسيق لشعبتك' : 'Manage organizational actions & cohort tasks',
          showAvatar: true
        };
      case 'attendance':
        return {
          title: isAr ? 'كشف الحضور والغياب' : 'Class Attendance Sheet',
          subtitle: isAr ? 'رصد وتوثيق الحضور المباشر لحصة اليوم' : 'Record and submit live classroom attendance',
          showAvatar: false
        };
      case 'broadcast':
        return {
          title: isAr ? 'البث العام للشعبة' : 'Cohort Broadcast Center',
          subtitle: isAr ? 'إرسال إعلانات وتنبيهات مباشرة لدفعتك' : 'Publish announcements directly to student portals',
          showAvatar: false
        };
      case 'tasks':
        if (subView === 'approvals') {
          return {
            title: isAr ? 'توثيق الحسابات والقبول' : 'Student Verifications',
            subtitle: isAr ? 'مراجعة وتفعيل حسابات الطلاب الجدد بصفة رسمية' : 'Approve or reject new cohort student profiles',
            showAvatar: false
          };
        }
        if (subView === 'assignments') {
          return {
            title: isAr ? 'توزيع الشعب والتسكين' : 'Group Cohort Assignment',
            subtitle: isAr ? 'تنسيق الطلاب وتسكينهم في الشعب الدراسية' : 'Assign classmates to academic study groups',
            showAvatar: false
          };
        }
        if (subView === 'reschedule') {
          return {
            title: isAr ? 'إدارة وتعديل المحاضرات' : 'Schedule Override Requests',
            subtitle: isAr ? 'تقديم طلب تعديل الموعد أو إلغاء الحصة لإدارة الكلية' : 'Submit reschedule requests to college administration',
            showAvatar: false
          };
        }
        if (subView === 'summaries') {
          return {
            title: isAr ? 'ملخصات ومراجع الدفعة' : 'Shared Lecture Resources',
            subtitle: isAr ? 'مشاركة ونشر المراجع وكتب المحاضرات والمستندات' : 'Share reference files & study links with cohort',
            showAvatar: false
          };
        }
        if (subView === 'logs') {
          return {
            title: isAr ? 'سجلات الحضور السابقة' : 'Historic Attendance Sheets',
            subtitle: isAr ? 'مراجعة كشوف حضور وغياب الطلاب السابقة للحصص' : 'Query past recorded attendance sheets',
            showAvatar: false
          };
        }
        return {
          title: isAr ? 'أدوات المندوب المتقدمة' : 'Representative Toolbox',
          subtitle: isAr ? 'طلبات التعديل، توثيق الطلاب الجدد، وتوزيع الشعب والمراجع' : 'Timetable overrides, approvals, group assignments & resources',
          showAvatar: false
        };
      default:
        return { title: 'Representative Hub', subtitle: '', showAvatar: false };
    }
  };

  const header = getHeaderDetails();

  const studentUser = JSON.parse(localStorage.getItem('manar_user') || '{}');
  const initials = studentUser.name ? studentUser.name.split(' ').slice(0, 2).map(n => n[0]).join('') : 'ST';

  // ── Render Views ────────────────────────────────────────────────────
  
  // VIEW 1: HOME VIEW
  const renderHomeView = () => {
    return (
      <div className="space-y-5">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3.5">
          <div className="bg-slate-950/40 border border-amber-500/10 p-4 rounded-2xl flex flex-col justify-between h-24 shadow-md">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
              {isAr ? 'الطلاب المسجلين' : 'Cohort Students'}
            </span>
            <span className="text-2xl font-black text-amber-400">{stats.totalClassmates}</span>
          </div>
          <div className="bg-slate-950/40 border border-amber-500/10 p-4 rounded-2xl flex flex-col justify-between h-24 shadow-md">
            <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
              {isAr ? 'معدل الحضور العام' : 'Attendance Rate'}
            </span>
            <span className="text-2xl font-black text-emerald-400">{stats.attendanceRate}%</span>
          </div>
        </div>

        {/* Action Panel Header */}
        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 px-1 mt-6">
          {isAr ? 'إجراءات سريعة' : 'Quick Actions'}
        </h3>

        {/* Quick Action Navigation Cards */}
        <div className="space-y-3">
          <div
            onClick={() => setActiveTab('attendance')}
            className="border-r-4 border-amber-500 bg-white/5 hover:-translate-x-1 transition-all duration-200 cursor-pointer p-4 rounded-xl flex items-center justify-between shadow-lg"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">📋</span>
              <div className="text-left">
                <p className="text-xs font-black text-white">{isAr ? 'رصد حضور الطلاب' : 'Track Class Attendance'}</p>
                <p className="text-[9px] text-slate-400 font-bold mt-0.5">{isAr ? 'تسجيل الحضور للمحاضرة النشطة' : 'Record students presence for current session'}</p>
              </div>
            </div>
            <span className="text-amber-500 text-sm">➔</span>
          </div>

          <div
            onClick={() => setActiveTab('broadcast')}
            className="border-r-4 border-amber-500 bg-white/5 hover:-translate-x-1 transition-all duration-200 cursor-pointer p-4 rounded-xl flex items-center justify-between shadow-lg"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">📢</span>
              <div className="text-left">
                <p className="text-xs font-black text-white">{isAr ? 'بث تنبيه عام للدفعة' : 'Broadcast Cohort Announcement'}</p>
                <p className="text-[9px] text-slate-400 font-bold mt-0.5">{isAr ? 'نشر رسالة عاجلة في لوحة تحكم الطلاب' : 'Send notification alert to all portals'}</p>
              </div>
            </div>
            <span className="text-amber-500 text-sm">➔</span>
          </div>
        </div>

        {/* Announcement Tip Box */}
        <div className="p-4 bg-amber-500/5 border border-amber-500/15 rounded-2xl mt-5">
          <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5 mb-1.5">
            <span>💡</span>
            {isAr ? 'تنويه المندوب التنظيمي' : 'Representative Note'}
          </p>
          <p className="text-[10px] text-slate-400 leading-relaxed font-bold">
            {isAr 
              ? 'بصفتك مندوباً للشعبة، يمكنك تعديل أوقات المحاضرات وإرسال إعلانات وإدارة كشوف الحضور مباشرة. يرجى مراجعة الجدول بشكل دوري.'
              : 'As cohort representative, you have administrative permission to request reschedules, verify attendance logs, and broadcast urgent alerts.'}
          </p>
        </div>

      </div>
    );
  };

  // VIEW 2: ATTENDANCE VIEW
  const renderAttendanceView = () => {
    return (
      <div className="space-y-4">

        {/* ── Offline Connectivity Warning Banner ── */}
        {!isOnline && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.08)]">
            <span className="text-lg shrink-0 mt-0.5">📡</span>
            <div>
              <p className="text-xs font-black text-amber-400 uppercase tracking-wider">
                {isAr ? 'وضع عدم الاتصال' : 'Offline Mode Active'}
              </p>
              <p className="text-[10px] text-amber-300/80 font-bold mt-0.5 leading-relaxed">
                {isAr
                  ? 'أنت حالياً غير متصل بالإنترنت. تم حفظ التحضير محلياً وستتم المزامنة تلقائياً عند عودة الاتصال.'
                  : 'You are currently offline. Attendance will be saved locally and automatically synced when your connection is restored.'}
              </p>
            </div>
          </div>
        )}

        {/* Lecture Select Banner */}
        <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 flex justify-between items-center shadow-md">
          <div className="min-w-0">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
              {isAr ? 'المحاضرة الحالية المحددة' : 'Selected Active Class'}
            </span>
            <select
              value={selectedScheduleId}
              onChange={e => setSelectedScheduleId(e.target.value)}
              className="bg-transparent text-xs font-black text-white focus:outline-none mt-1 cursor-pointer w-full max-w-[200px]"
            >
              {schedules.map(s => (
                <option key={s.id} value={s.id} className="bg-slate-950 text-white">
                  {s.subject?.name} ({s.subject?.type === 'PRACTICAL' ? (isAr ? 'عملي' : 'Lab') : (isAr ? 'نظري' : 'Theory')})
                </option>
              ))}
            </select>
          </div>
          <div className="text-right shrink-0 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl">
            <span className="text-[9px] font-black text-slate-400 block uppercase">{isAr ? 'إجمالي الحضور' : 'Present'}</span>
            <span className="text-xs font-black text-amber-400 mt-0.5 block">{presentCount} / {totalStudents}</span>
          </div>
        </div>

        {/* Student list headers */}
        <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-slate-500 px-1 mt-4">
          <span>{isAr ? 'اسم الطالب' : 'Student Name'}</span>
          <span>{isAr ? 'الحالة (حاضر / غائب)' : 'Status (Pres / Abs)'}</span>
        </div>

        {/* Live Attendance Student List */}
        <form onSubmit={handleSubmitAttendance} className="space-y-2">
          <div className="space-y-2">
            {attendanceList.map(student => (
              <div 
                key={student.id} 
                className="bg-white/5 border border-white/5 rounded-xl p-3.5 flex justify-between items-center shadow-sm"
              >
                <div className="min-w-0">
                  <p className="text-xs font-black text-white truncate">{student.name}</p>
                  <p className="text-[9px] text-slate-500 font-mono font-bold mt-0.5">{student.idNumber}</p>
                </div>
                
                {/* Custom Toggle Switch - Absent (غ) / Present (ح) */}
                <div className="shrink-0 flex items-center">
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={student.isPresent}
                      onChange={() => handleToggleAttendance(student.id)}
                      className="sr-only peer"
                    />
                    <div className="w-14 h-7 bg-red-500/80 border border-red-500/30 rounded-full peer peer-checked:bg-emerald-500/80 peer-checked:border-emerald-500/30 transition-all duration-300 relative flex items-center justify-between px-2.5 text-[9px] font-black text-white">
                      <span>ح</span>
                      <span>غ</span>
                      
                      {/* Sliding Circle Dot */}
                      <div className="absolute top-[2px] left-[2px] bg-white rounded-full h-5.5 w-5.5 transition-all duration-300 peer-checked:translate-x-[26px] shadow-md flex items-center justify-center text-[8px] font-black text-slate-800">
                        {student.isPresent ? '✓' : '✕'}
                      </div>
                    </div>
                  </label>
                </div>
              </div>
            ))}
          </div>

          <button
            type="submit"
            className="w-full mt-6 py-3.5 rounded-xl font-black text-xs uppercase tracking-wider bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all active:scale-98"
          >
            {isAr ? 'حفظ وإرسال الكشف المعتمد' : 'Save & Submit Attendance'}
          </button>
        </form>

      </div>
    );
  };

  // VIEW 3: BROADCAST VIEW
  const renderBroadcastView = () => {
    return (
      <form onSubmit={handleSendBroadcast} className="space-y-4">
        
        {/* Text Input area */}
        <div className="space-y-1">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block px-1">
            {isAr ? 'نص الإعلان أو التنبيه للشعبة' : 'Announcement Notice Message'}
          </label>
          <textarea
            required
            value={broadcastMessage}
            onChange={e => setBroadcastMessage(e.target.value)}
            placeholder={isAr ? 'اكتب تفاصيل التنبيه الأكاديمي هنا للطلاب...' : 'Type cohort notification description...'}
            rows="5"
            className="w-full p-4 text-xs font-semibold text-white bg-slate-950/60 border border-slate-800 rounded-2xl focus:outline-none focus:border-amber-500 focus:shadow-[0_0_15px_rgba(245,158,11,0.1)] transition-all"
          />
        </div>

        {/* Priority select pills */}
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block px-1">
            {isAr ? 'تحديد درجة الأهمية' : 'Notification Priority'}
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPriority('normal')}
              className={`flex-1 py-3.5 rounded-xl text-xs font-black uppercase border tracking-wider transition-all ${
                priority === 'normal'
                  ? 'bg-blue-500/10 border-blue-500/40 text-blue-400 shadow-md shadow-blue-500/5'
                  : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'
              }`}
            >
              🔵 {isAr ? 'عادي (أكاديمي)' : 'Normal (Academic)'}
            </button>
            <button
              type="button"
              onClick={() => setPriority('urgent')}
              className={`flex-1 py-3.5 rounded-xl text-xs font-black uppercase border tracking-wider transition-all ${
                priority === 'urgent'
                  ? 'bg-red-500/10 border-red-500/40 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
                  : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'
              }`}
            >
              🚨 {isAr ? 'عاجل جداً!' : 'Urgent Alert!'}
            </button>
          </div>
        </div>

        {/* Dispatch button */}
        <button
          type="submit"
          className="w-full mt-4 py-3.5 rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.25)] transition-all active:scale-98"
        >
          ⚡ {isAr ? 'بث الإشعار فورياً' : 'Dispatch Announcement Now'}
        </button>
      </form>
    );
  };

  // VIEW 4: TASKS VIEW
  const renderTasksView = () => {
    const renderBackButton = () => (
      <button
        type="button"
        onClick={() => setSubView(null)}
        className="flex items-center gap-2 mb-4 px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black text-amber-400 uppercase tracking-widest hover:bg-white/10 transition-colors w-max"
      >
        {isAr ? '← العودة للأدوات' : '← Back to Tools'}
      </button>
    );

    if (subView === 'approvals') {
      const pendingStudents = allCohortStudents.filter(s => !s.isEmailVerified || !s.isPhoneVerified);
      return (
        <div className="space-y-4">
          {renderBackButton()}
          
          {cohortLoading ? (
            <div className="flex justify-center py-20">
              <span className="h-6 w-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pendingStudents.length === 0 ? (
            <div className="p-10 text-center bg-white/5 border border-white/5 rounded-2xl space-y-3">
              <span className="text-3xl block">🎉</span>
              <p className="text-xs font-bold text-slate-400">
                {isAr ? 'ممتاز! لا يوجد حسابات معلقة للتوثيق في دفعتك حالياً.' : 'Amazing! No pending cohort registrations to verify.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {pendingStudents.map(student => (
                <div key={student.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col gap-3 shadow-md">
                  <div className="flex justify-between items-start">
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-sm text-white truncate">{student.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{student.email}</p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{isAr ? 'الرقم الأكاديمي:' : 'ID Number:'} {student.idNumber} · {student.phone}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[8px] font-black uppercase tracking-wider">
                      {isAr ? 'معلق' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex gap-2 border-t border-white/5 pt-3">
                    <button
                      onClick={() => handleApproveStudent(student.id)}
                      disabled={submittingAction === student.id}
                      className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-450 text-slate-950 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-[0_0_10px_rgba(16,185,129,0.15)] flex justify-center items-center h-9"
                    >
                      {submittingAction === student.id ? (
                        <span className="h-3.5 w-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                      ) : (isAr ? 'توثيق وقبول' : 'Verify Student')}
                    </button>
                    <button
                      onClick={() => handleRejectStudent(student.id)}
                      disabled={submittingAction === student.id}
                      className="px-4 py-2 border border-red-500/30 bg-red-500/5 hover:bg-red-500 hover:text-white text-red-400 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all flex justify-center items-center h-9"
                    >
                      {isAr ? 'رفض' : 'Reject'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (subView === 'assignments') {
      const verifiedCohort = allCohortStudents.filter(s => s.isEmailVerified && s.isPhoneVerified);
      return (
        <div className="space-y-4">
          {renderBackButton()}
          
          {cohortLoading ? (
            <div className="flex justify-center py-20">
              <span className="h-6 w-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : verifiedCohort.length === 0 ? (
            <div className="p-10 text-center bg-white/5 border border-white/5 rounded-2xl">
              <p className="text-xs font-bold text-slate-400">
                {isAr ? 'لا يوجد طلاب موثقين في دفعتك لتسكينهم.' : 'No verified students in your cohort yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-2xl mb-2">
                <p className="text-[9px] text-amber-400 font-black uppercase tracking-wider flex items-center gap-1">
                  <span>ℹ️</span> {isAr ? 'تعليمات تسكين الشعب' : 'Group Assignment Info'}
                </p>
                <p className="text-[9px] text-slate-400 mt-1 leading-relaxed">
                  {isAr 
                    ? 'اختر الشعبة الدراسية المناسبة لكل طالب وسيتم نقله وتحديث جدوله فوراً.' 
                    : 'Select the academic group for each classmate. Their schedule will be updated instantly.'}
                </p>
              </div>

              {verifiedCohort.map(student => (
                <div key={student.id} className="p-3.5 bg-white/5 border border-white/5 rounded-xl flex justify-between items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-white truncate">{student.name}</p>
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">{student.idNumber}</p>
                  </div>
                  <div className="shrink-0">
                    <select
                      value={student.groupId || ''}
                      onChange={(e) => handleAssignGroup(student.id, e.target.value)}
                      className="bg-slate-950 text-slate-200 text-xs font-black rounded-xl border border-white/10 px-3 py-1.5 focus:outline-none focus:border-amber-400 cursor-pointer"
                    >
                      <option value="">{isAr ? 'بدون شعبة' : 'No Group'}</option>
                      {groups.map(g => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (subView === 'reschedule') {
      return (
        <div className="space-y-6">
          {renderBackButton()}

          <form onSubmit={handleRescheduleSubmit} className="space-y-4">
            <div className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                  {isAr ? 'اختر الحصة المراد تعديلها' : 'Select Lecture to Adjust'}
                </label>
                <select
                  required
                  value={rescheduleScheduleId}
                  onChange={e => setRescheduleScheduleId(e.target.value)}
                  className="bg-slate-950 text-xs font-bold text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none w-full cursor-pointer h-12"
                >
                  <option value="" disabled>{isAr ? 'اختر المحاضرة...' : 'Select lecture...'}</option>
                  {schedules.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.subject?.name} ({isAr ? ({SUNDAY:'الأحد',MONDAY:'الاثنين',TUESDAY:'الثلاثاء',WEDNESDAY:'الأربعاء',THURSDAY:'الخميس',FRIDAY:'الجمعة',SATURDAY:'السبت'}[s.dayOfWeek]) : s.dayOfWeek} · {s.startTime})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                  {isAr ? 'نوع التعديل المقترح' : 'Modification Type'}
                </label>
                <select
                  value={rescheduleType}
                  onChange={e => setRescheduleType(e.target.value)}
                  className="bg-slate-950 text-xs font-bold text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none w-full cursor-pointer h-12"
                >
                  <option value="RESCHEDULE">{isAr ? 'إعادة جدولة لموعد آخر' : 'Reschedule class'}</option>
                  <option value="CANCEL">{isAr ? 'إلغاء المحاضرة بالكامل' : 'Cancel class session'}</option>
                </select>
              </div>

              {rescheduleType === 'RESCHEDULE' && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-black/20 rounded-xl border border-white/5">
                  <div className="space-y-1.5 col-span-2">
                    <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                      {isAr ? 'اليوم المقترح' : 'Proposed Day'}
                    </label>
                    <select
                      value={newDayOfWeek}
                      onChange={e => setNewDayOfWeek(e.target.value)}
                      className="bg-slate-950 text-xs font-bold text-white border border-white/10 rounded-xl px-3 py-2.5 focus:outline-none w-full cursor-pointer h-10"
                    >
                      {['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].map(d => (
                        <option key={d} value={d}>
                          {isAr ? ({SUNDAY:'الأحد',MONDAY:'الاثنين',TUESDAY:'الثلاثاء',WEDNESDAY:'الأربعاء',THURSDAY:'الخميس',FRIDAY:'الجمعة',SATURDAY:'السبت'}[d]) : d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                      {isAr ? 'وقت البدء' : 'Start Time'}
                    </label>
                    <input
                      type="time" required value={newStartTime} onChange={e => setNewStartTime(e.target.value)}
                      className="bg-slate-950 text-xs font-bold text-white border border-white/10 rounded-xl px-3 py-2.5 focus:outline-none w-full h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                      {isAr ? 'وقت الانتهاء' : 'End Time'}
                    </label>
                    <input
                      type="time" required value={newEndTime} onChange={e => setNewEndTime(e.target.value)}
                      className="bg-slate-950 text-xs font-bold text-white border border-white/10 rounded-xl px-3 py-2.5 focus:outline-none w-full h-10"
                    />
                  </div>

                  <div className="space-y-1.5 col-span-2">
                    <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                      {isAr ? 'القاعة المقترحة (اختياري)' : 'Proposed Room (Optional)'}
                    </label>
                    <select
                      value={newRoomId}
                      onChange={e => setNewRoomId(e.target.value)}
                      className="bg-slate-950 text-xs font-bold text-white border border-white/10 rounded-xl px-3 py-2.5 focus:outline-none w-full cursor-pointer h-10"
                    >
                      <option value="">{isAr ? '-- اختر قاعة --' : '-- Select Classroom --'}</option>
                      {rooms.map(r => (
                        <option key={r.id} value={r.id}>{r.name} ({isAr ? 'سعة' : 'cap'}: {r.capacity})</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                  {isAr ? 'توضيح السبب للإدارة' : 'Reason for Adjustment'}
                </label>
                <textarea
                  required
                  value={rescheduleReason}
                  onChange={e => setRescheduleReason(e.target.value)}
                  className="bg-slate-950 text-xs font-semibold text-white border border-white/10 rounded-xl p-3 focus:outline-none w-full h-20"
                  placeholder={isAr ? 'توضيح سبب التعديل (مثال: عطلة رسمية أو تزامن مع محاضرة أخرى)...' : 'Why is this schedule change requested...'}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={cohortLoading}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-450 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)] flex justify-center items-center h-12"
            >
              {cohortLoading ? (
                <span className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (isAr ? 'إرسال طلب التعديل للإدارة' : 'Submit Timetable Request')}
            </button>
          </form>

          {/* Reschedule history */}
          <div className="pt-6 border-t border-white/5 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
              📋 {isAr ? 'سجل طلبات التعديل السابقة' : 'Timetable Adjustments History'}
            </h4>
            
            {historyLoading ? (
              <div className="flex justify-center py-10">
                <span className="h-5 w-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : rescheduleHistory.length === 0 ? (
              <p className="text-[10px] text-slate-500 font-bold">{isAr ? 'لا يوجد طلبات تعديل سابقة للشعبة.' : 'No rescheduling history found.'}</p>
            ) : (
              <div className="space-y-2.5">
                {rescheduleHistory.map(req => (
                  <div key={req.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl text-[10px] space-y-2 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black ${
                          req.requestType === 'CANCEL' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {req.requestType}
                        </span>
                        <h5 className="font-extrabold text-white mt-1.5">{req.schedule?.subject?.name || 'Class'}</h5>
                        <p className="text-[9px] text-slate-500 font-bold mt-0.5">{isAr ? 'المحاضر:' : 'Lecturer:'} {req.lecturer?.name || '—'}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${
                        req.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                        req.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>
                        {req.status === 'PENDING' ? (isAr ? 'معلق' : 'Pending') :
                         req.status === 'APPROVED' ? (isAr ? 'مقبول' : 'Approved') : (isAr ? 'مرفوض' : 'Rejected')}
                      </span>
                    </div>

                    {req.requestType === 'RESCHEDULE' && (
                      <div className="p-2 bg-black/30 border border-white/5 rounded-xl font-mono text-[9px] space-y-0.5 text-slate-350">
                        <p>🗓️ {isAr ? 'الموعد المقترح:' : 'Proposed Slot:'} {isAr ? ({SUNDAY:'الأحد',MONDAY:'الاثنين',TUESDAY:'الثلاثاء',WEDNESDAY:'الأربعاء',THURSDAY:'الخميس',FRIDAY:'الجمعة',SATURDAY:'السبت'}[req.newDayOfWeek]) : req.newDayOfWeek} · {req.newStartTime} - {req.newEndTime}</p>
                        {req.newRoom && <p>🏢 {isAr ? 'القاعة البديلة:' : 'Classroom:'} {req.newRoom.name}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (subView === 'summaries') {
      return (
        <div className="space-y-6">
          {renderBackButton()}

          <form onSubmit={handleAddResourceSubmit} className="space-y-4">
            <div className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                  {isAr ? 'عنوان الملف / الدرس' : 'Resource File Title'}
                </label>
                <input
                  type="text" required value={resourceTitle} onChange={e => setResourceTitle(e.target.value)}
                  className="bg-slate-950 text-xs font-bold text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none w-full h-12"
                  placeholder={isAr ? 'مثال: ملخص الجبر الخطي - الدرس الأول' : 'e.g., Linear Algebra - Lecture 1 Notes'}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                  {isAr ? 'رابط المشاركة المباشر' : 'Resource Shareable URL Link'}
                </label>
                <input
                  type="url" required value={resourceUrl} onChange={e => setResourceUrl(e.target.value)}
                  className="bg-slate-950 text-xs font-bold text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none w-full h-12 font-mono"
                  placeholder="https://drive.google.com/..."
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={cohortLoading}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-450 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)] flex justify-center items-center h-12"
            >
              {cohortLoading ? (
                <span className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (isAr ? 'نشر ومشاركة المرجع' : 'Publish Reference Link')}
            </button>
          </form>

          {/* Resources list */}
          <div className="pt-6 border-t border-white/5 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
              📂 {isAr ? 'مراجع ومستندات الدفعة المشاركة' : 'Shared Reference Materials'}
            </h4>
            
            {resourcesLoading ? (
              <div className="flex justify-center py-10">
                <span className="h-5 w-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : resources.length === 0 ? (
              <p className="text-[10px] text-slate-500 font-bold">{isAr ? 'لا يوجد مراجع دراسية مشاركة حالياً.' : 'No cohort references uploaded yet.'}</p>
            ) : (
              <div className="space-y-2">
                {resources.map(res => (
                  <div key={res.id} className="p-3 bg-white/5 border border-white/5 rounded-xl flex justify-between items-center gap-3">
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-black text-white truncate">{res.title}</p>
                      <p className="text-[9px] text-slate-500 font-mono mt-0.5 truncate">{res.url}</p>
                    </div>
                    <a
                      href={res.url} target="_blank" rel="noopener noreferrer"
                      className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-white font-black text-[10px] uppercase transition-all shrink-0 cursor-pointer"
                    >
                      {isAr ? 'فتح الرابط ↗' : 'Open Link ↗'}
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (subView === 'logs') {
      return (
        <div className="space-y-4">
          {renderBackButton()}

          <div className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                {isAr ? 'اختر الحصة' : 'Select Lecture'}
              </label>
              <select
                value={pastLogsSelectedScheduleId}
                onChange={e => setPastLogsSelectedScheduleId(e.target.value)}
                className="bg-slate-950 text-xs font-bold text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none w-full cursor-pointer h-12"
              >
                <option value="" disabled>{isAr ? 'اختر المحاضرة...' : 'Select lecture...'}</option>
                {schedules.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.subject?.name} ({isAr ? ({SUNDAY:'الأحد',MONDAY:'الاثنين',TUESDAY:'الثلاثاء',WEDNESDAY:'الأربعاء',THURSDAY:'الخميس',FRIDAY:'الجمعة',SATURDAY:'السبت'}[s.dayOfWeek]) : s.dayOfWeek} · {s.startTime})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                {isAr ? 'اختر التاريخ' : 'Select Date'}
              </label>
              <input
                type="date"
                value={pastLogsSelectedDate}
                onChange={e => setPastLogsSelectedDate(e.target.value)}
                className="bg-slate-950 text-xs font-bold text-white border border-white/10 rounded-xl px-4 py-3 focus:outline-none w-full h-12"
              />
            </div>

            <button
              onClick={handleLoadPastLogs}
              disabled={pastLogsLoading}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-450 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all h-12 flex justify-center items-center"
            >
              {pastLogsLoading ? (
                <span className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (isAr ? 'استعلام كشف الحضور' : 'Query Attendance Sheet')}
            </button>
          </div>

          {/* Query result */}
          {pastLogsLoading ? (
            <div className="flex justify-center py-20">
              <span className="h-6 w-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : pastLogsAttendance.length > 0 ? (
            <div className="space-y-2">
              <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-slate-500 px-1">
                <span>{isAr ? 'اسم الطالب' : 'Student Name'}</span>
                <span>{isAr ? 'حالة الحضور' : 'Status'}</span>
              </div>
              <div className="space-y-2">
                {pastLogsAttendance.map(record => (
                  <div key={record.id} className="p-3 bg-white/5 border border-white/5 rounded-xl flex justify-between items-center">
                    <div>
                      <p className="text-xs font-black text-white">{record.student?.name}</p>
                      <p className="text-[9px] text-slate-400 mt-0.5 font-mono">{record.student?.idNumber}</p>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                      record.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      record.status === 'ABSENT' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {record.status === 'PRESENT' ? (isAr ? 'حاضر' : 'Present') :
                       record.status === 'ABSENT' ? (isAr ? 'غائب' : 'Absent') : (isAr ? 'بعذر' : 'Excused')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div className="space-y-6">
        
        {/* Tools Grid */}
        <div className="grid grid-cols-2 gap-3.5">
          {[
            {
              id: 'reschedule',
              icon: '📅',
              title: isAr ? 'طلب تعديل الجدول' : 'Reschedule Req',
              desc: isAr ? 'تغيير موعد محاضرة شعبتك' : 'Suggest class reschedule',
              color: 'text-blue-400 border-blue-500/10 hover:border-blue-500/30'
            },
            {
              id: 'summaries',
              icon: '📁',
              title: isAr ? 'مراجع الدفعة' : 'Lecture Resources',
              desc: isAr ? 'مشاركة الكتب والملخصات' : 'Share study files & links',
              color: 'text-purple-400 border-purple-500/10 hover:border-purple-500/30'
            },
            {
              id: 'logs',
              icon: '📝',
              title: isAr ? 'سجلات الحضور' : 'Attendance Logs',
              desc: isAr ? 'مراجعة الكشوف التاريخية' : 'Review past lists',
              color: 'text-emerald-400 border-emerald-500/10 hover:border-emerald-500/30'
            },
            {
              id: 'approvals',
              icon: '🎓',
              title: isAr ? 'توثيق وقبول الطلاب' : 'Cohort Approvals',
              desc: isAr ? 'قبول وتفعيل حسابات الدفعة' : 'Verify new cohort profiles',
              color: 'text-amber-400 border-amber-500/10 hover:border-amber-500/30'
            },
            {
              id: 'assignments',
              icon: '👥',
              title: isAr ? 'توزيع وتسكين الشعب' : 'Group Assignment',
              desc: isAr ? 'تسكين الدفعة في الشعب' : 'Assign classmates to groups',
              color: 'text-cyan-400 border-cyan-500/10 hover:border-cyan-500/30'
            },
            {
              id: 'feedback',
              icon: '💬',
              title: isAr ? 'مراسلة الإدارة' : 'Direct Message',
              desc: isAr ? 'اتصال مباشر بعميد الكلية' : 'Send message to admin',
              color: 'text-pink-400 border-pink-500/10 hover:border-pink-500/30'
            }
          ].map(tool => (
            <div
              key={tool.title}
              onClick={() => {
                if (tool.id === 'feedback') {
                  toast.success(isAr ? 'تم فتح خط اتصال مباشر مع العمادة!' : 'Direct message connection established!');
                  const msg = window.prompt(isAr ? 'اكتب رسالتك الموجهة لعمادة الكلية:' : 'Type your message to the administration:');
                  if (msg && msg.trim()) {
                    axios.post(`${API_URL}/api/rep/broadcast`, {
                      message: `[REP FEEDBACK] ${msg}`
                    }, { headers: { Authorization: `Bearer ${token}` } })
                      .then(() => toast.success(isAr ? 'تم إرسال رسالتك بنجاح!' : 'Your message has been sent!'))
                      .catch(() => toast.error(isAr ? 'فشل إرسال الرسالة.' : 'Failed to send message.'));
                  }
                } else {
                  setSubView(tool.id);
                }
              }}
              className={`p-4 bg-white/5 border rounded-2xl cursor-pointer hover:bg-white/10 transition-all shadow-md flex flex-col justify-between h-28 ${tool.color}`}
            >
              <span className="text-2xl">{tool.icon}</span>
              <div>
                <p className="text-xs font-black text-white leading-tight">{tool.title}</p>
                <p className="text-[9px] text-slate-500 font-bold mt-0.5">{tool.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Switch Role Button Section */}
        <div className="border-t border-slate-800 pt-6 mt-6">
          <button
            onClick={() => navigate('/student/home')}
            className="w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-wider border-2 border-dashed border-amber-500/40 hover:border-amber-500 text-amber-400 hover:text-amber-300 bg-amber-500/5 hover:bg-amber-500/10 transition-all duration-200 active:scale-98 flex items-center justify-center gap-2"
          >
            <span>🔄</span>
            {isAr ? 'التبديل إلى لوحة الطالب العادية' : 'Switch to Normal Student View'}
          </button>
        </div>

      </div>
    );
  };

  // ── Main Shell Layout ───────────────────────────────────────────────
  return (
    <div className="flex-1 w-full flex flex-col items-center min-h-screen bg-slate-950 p-0" dir={isAr ? 'rtl' : 'ltr'}>
      
      {/* SPA Main Golden Container Frame */}
      <div className="w-full max-w-md min-h-screen bg-slate-900 text-white flex flex-col relative pb-24 shadow-[0_0_40px_rgba(245,158,11,0.15)] border-x border-slate-800/80 overflow-hidden">
        
        {/* Dynamic Golden Header */}
        <header className="px-5 py-4 border-b border-amber-500/10 bg-gradient-to-b from-amber-500/15 to-transparent sticky top-0 z-30 flex items-center justify-between">
          <div className="min-w-0">
            {/* Title / Sub */}
            <h2 className="text-base font-black text-white truncate tracking-tight flex items-center gap-1.5">
              {header.title}
            </h2>
            <p className="text-[10px] text-amber-200/60 font-bold mt-0.5">
              {header.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {header.showAvatar && (
              <div className="w-9 h-9 rounded-xl border border-amber-500/20 shrink-0 bg-gradient-to-tr from-amber-500/20 to-amber-600/20 flex items-center justify-center font-black text-xs text-amber-400">
                {initials}
              </div>
            )}

            {/* Representative Badge */}
            <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-widest leading-none flex items-center gap-1">
              <span>👑</span>
              {isAr ? 'مندوب' : 'Rep'}
            </span>
          </div>
        </header>

        {/* Content View area */}
        <main className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="space-y-4"
            >
              {activeTab === 'home' && renderHomeView()}
              {activeTab === 'attendance' && renderAttendanceView()}
              {activeTab === 'broadcast' && renderBroadcastView()}
              {activeTab === 'tasks' && renderTasksView()}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Bottom Tab Navigation Dock - Amber Themed */}
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-slate-950/95 backdrop-blur-lg border-t border-amber-500/20 px-4 py-2.5 flex justify-around items-center z-40">
          {[
            {
              id: 'home',
              label: isAr ? 'الرئيسية' : 'Home',
              iconActive: (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5.5 h-5.5">
                  <path d="M11.47 3.82a.75.75 0 011.06 0l8.69 8.69a.75.75 0 11-1.06 1.06l-.22-.22v7.42a1.75 1.75 0 01-1.75 1.75h-8.5A1.75 1.75 0 013 20.75v-7.42l-.22.22a.75.75 0 01-1.06-1.06l8.69-8.69z" />
                </svg>
              ),
              iconInactive: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5.5 h-5.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
              )
            },
            {
              id: 'attendance',
              label: isAr ? 'التحضير' : 'Attendance',
              iconActive: (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5.5 h-5.5">
                  <path d="M19.5 21a3 3 0 003-3v-4.5a3 3 0 00-3-3h-15a3 3 0 00-3 3V18a3 3 0 003 3h15zM1.5 10.146V6a3 3 0 013-3h5.379a.75.75 0 01.53.22L11.72 4.5h7.78a3 3 0 013 3v2.646a4.478 4.478 0 00-3-1.146h-15a4.478 4.478 0 00-3 1.146z" />
                </svg>
              ),
              iconInactive: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5.5 h-5.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h.008a.75.75 0 00.75-.75 4.39 4.39 0 01.96-2.583m-1.368 2.583a4.39 4.39 0 01-2.63-2.583m3.998 2.583H15m-3.998 0H8.22M15 15.75a3 3 0 01-6 0V12h6v3.75z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 10.5h.008v.008h-.008V10.5zM18.75 13.5h.008v.008h-.008v-.008zM18.75 16.5h.008v.008h-.008v-.008zM5.25 10.5h.008v.008H5.25V10.5zM5.25 13.5h.008v.008H5.25v-.008zM5.25 16.5h.008v.008H5.25v-.008zM9 9h6M9 6h6" />
                </svg>
              )
            },
            {
              id: 'broadcast',
              label: isAr ? 'البث' : 'Broadcast',
              iconActive: (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5.5 h-5.5">
                  <path fillRule="evenodd" d="M5.25 9a6.75 6.75 0 0113.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 01-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 11-7.48 0 24.585 24.585 0 01-4.831-1.244.75.75 0 01-.298-1.205A8.217 8.217 0 005.25 9.75V9zm4.502 8.9a2.25 2.25 0 104.496 0 25.057 25.057 0 01-4.496 0z" clipRule="evenodd" />
                </svg>
              ),
              iconInactive: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5.5 h-5.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
              )
            },
            {
              id: 'tasks',
              label: isAr ? 'الأدوات' : 'Tools',
              iconActive: (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5.5 h-5.5">
                  <path fillRule="evenodd" d="M7.5 2.25A2.25 2.25 0 005.25 4.5v1.5a3 3 0 00-3 3v9a3 3 0 003 3h13.5a3 3 0 003-3v-9a3 3 0 00-3-3V4.5a2.25 2.25 0 00-2.25-2.25h-7.5zm9 3.75V4.5a.75.75 0 00-.75-.75h-7.5a.75.75 0 00-.75.75V6h9zM20.25 9v1.5H3.75V9h16.5zm0 3v6a1.5 1.5 0 01-1.5 1.5H5.25A1.5 1.5 0 013.75 18v-6h16.5z" clipRule="evenodd" />
                </svg>
              ),
              iconInactive: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="w-5.5 h-5.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              )
            }
          ].map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setSubView(null);
                }}
                className={`flex-1 flex flex-col items-center py-2 transition-all duration-300 relative ${
                  active ? 'text-amber-500 -translate-y-1 drop-shadow-[0_0_10px_rgba(245,158,11,0.6)]' : 'text-slate-500 hover:text-slate-350'
                }`}
              >
                <span className="relative">
                  {active ? tab.iconActive : tab.iconInactive}
                </span>
                
                <span className="text-[9px] font-black tracking-wider mt-0.5 uppercase">
                  {tab.label}
                </span>

                {/* Golden active glow dot */}
                {active && (
                  <span className="absolute bottom-[-1px] h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)] animate-pulse" />
                )}
              </button>
            );
          })}
        </nav>

      </div>
    </div>
  );
}
