import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { API_URL } from './config';

export default function RepresentativeDashboard() {
  const { i18n } = useTranslation();
  const isAr = i18n.language === 'ar';

  const [activeTab, setActiveTab] = useState('attendance'); // 'attendance', 'broadcasts', 'resources', 'rescheduling'
  const [loading, setLoading] = useState(true);

  // QR Attendance code states
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [selectedQRScheduleId, setSelectedQRScheduleId] = useState('');
  const [generatedQRToken, setGeneratedQRToken] = useState('');
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);

  // Poll creation states
  const [isPollModalOpen, setIsPollModalOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [isSubmittingPoll, setIsSubmittingPoll] = useState(false);

  const handleOpenQRModal = () => {
    if (schedules.length > 0) {
      setSelectedQRScheduleId(schedules[0].id.toString());
    }
    setGeneratedQRToken('');
    setIsQRModalOpen(true);
  };

  const handleGenerateQR = async () => {
    if (!selectedQRScheduleId) return;
    setIsGeneratingQR(true);
    try {
      const res = await axios.post(`${API_URL}/api/rep/attendance/qr-token`, {
        scheduleId: parseInt(selectedQRScheduleId)
      }, { headers });
      if (res.data?.success) {
        setGeneratedQRToken(res.data.token);
        toast.success(isAr ? 'تم توليد رمز الحضور بنجاح!' : 'QR attendance token generated!');
      }
    } catch (err) {
      console.error(err);
      toast.error(isAr ? 'فشل توليد رمز QR' : 'Failed to generate QR token');
    } finally {
      setIsGeneratingQR(false);
    }
  };

  const handleOpenPollModal = () => {
    setPollQuestion('');
    setPollOptions(['', '']);
    setIsPollModalOpen(true);
  };

  const handleAddPollOption = () => {
    setPollOptions([...pollOptions, '']);
  };

  const handleRemovePollOption = (idx) => {
    if (pollOptions.length <= 2) return;
    setPollOptions(pollOptions.filter((_, i) => i !== idx));
  };

  const handlePollOptionChange = (idx, value) => {
    const updated = [...pollOptions];
    updated[idx] = value;
    setPollOptions(updated);
  };

  const handleCreatePollSubmit = async (e) => {
    e.preventDefault();
    if (!pollQuestion.trim()) return;
    const filteredOptions = pollOptions.filter(o => o.trim() !== '');
    if (filteredOptions.length < 2) {
      toast.error(isAr ? 'يرجى إدخال خيارين على الأقل' : 'Please input at least 2 options');
      return;
    }
    setIsSubmittingPoll(true);
    try {
      const res = await axios.post(`${API_URL}/api/exchange/posts`, {
        title: isAr ? 'استبيان الدفعة 📊' : 'Cohort Poll 📊',
        content: pollQuestion,
        category: 'POLL',
        question: pollQuestion,
        options: filteredOptions
      }, { headers });
      if (res.data?.success) {
        toast.success(isAr ? 'تم نشر الاستبيان في ملتقى الشعبة بنجاح!' : 'Poll posted to Class Hub successfully!');
        setIsPollModalOpen(false);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || (isAr ? 'فشل إنشاء الاستبيان' : 'Failed to create poll'));
    } finally {
      setIsSubmittingPoll(false);
    }
  };

  // Group Stats
  const [stats, setStats] = useState({
    totalClassmates: 0,
    totalResources: 0,
    attendanceRate: 100,
    classmateStats: []
  });

  // Class & Classroom data
  const [schedules, setSchedules] = useState([]);
  const [classmates, setClassmates] = useState([]);
  const [rooms, setRooms] = useState([]);

  // Tab 1: Attendance state
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [attendanceSheet, setAttendanceSheet] = useState({});
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Tab 2: Broadcasts state
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastsHistory, setBroadcastsHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState(null);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);

  // Tab 3: Resources state
  const [resources, setResources] = useState([]);
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceUrl, setResourceUrl] = useState('');
  const [addingResource, setAddingResource] = useState(false);

  // Tab 4: Rescheduling state
  const [rescheduleScheduleId, setRescheduleScheduleId] = useState('');
  const [rescheduleType, setRescheduleType] = useState('RESCHEDULE'); // 'RESCHEDULE' or 'CANCEL'
  const [newDayOfWeek, setNewDayOfWeek] = useState('SUNDAY');
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');
  const [newRoomId, setNewRoomId] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [submittingReschedule, setSubmittingReschedule] = useState(false);
  const [rescheduleHistory, setRescheduleHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const token = localStorage.getItem('manar_token');
  const headers = { Authorization: `Bearer ${token}` };

  const tabs = [
    { id: 'attendance', label: isAr ? '📝 التحضير اليومي' : 'Attendance' },
    { id: 'broadcasts', label: isAr ? '📢 تعميمات الدفعة' : 'Group Broadcasts' },
    { id: 'resources', label: isAr ? '🔗 المراجع والمستندات' : 'Shared Resources' },
    { id: 'rescheduling', label: isAr ? '🗓️ تعديل الحصص' : 'Reschedule Requests' }
  ];

  /* ── Fetch Dashboard Stats ──────────────────────────────────── */
  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/rep/dashboard/stats`, { headers });
      if (res.data?.success) {
        setStats(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  /* ── Fetch Rescheduling History ──────────────────────────────── */
  const fetchRescheduleHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await axios.get(`${API_URL}/api/rep/reschedule/history`, { headers });
      if (res.data?.success) {
        setRescheduleHistory(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch reschedule history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [schedsRes, classmatesRes, roomsRes, resourcesRes] = await Promise.all([
        axios.get(`${API_URL}/api/rep/schedules`, { headers }).catch(err => ({ error: err, data: { success: false, data: [] } })),
        axios.get(`${API_URL}/api/rep/classmates`, { headers }).catch(err => ({ error: err, data: { success: false, data: [] } })),
        axios.get(`${API_URL}/api/rooms`, { headers }).catch(() => ({ data: { success: true, data: [] } })),
        axios.get(`${API_URL}/api/rep/resources`, { headers }).catch(() => ({ data: { success: true, data: [] } }))
      ]);

      if (schedsRes.data?.success) {
        setSchedules(schedsRes.data.data);
        if (schedsRes.data.data.length > 0) {
          setSelectedScheduleId(schedsRes.data.data[0].id.toString());
          setRescheduleScheduleId(schedsRes.data.data[0].id.toString());
        }
      } else if (schedsRes.error) {
        const errMsg = schedsRes.error.response?.data?.error;
        if (errMsg) toast.error(errMsg);
      }

      if (classmatesRes.data?.success) {
        setClassmates(classmatesRes.data.data);
      } else if (classmatesRes.error) {
        const errMsg = classmatesRes.error.response?.data?.error;
        if (errMsg) toast.error(errMsg);
      }

      if (roomsRes.data?.success) {
        setRooms(roomsRes.data.data);
      }

      if (resourcesRes.data?.success) {
        setResources(resourcesRes.data.data);
      }

      // Also grab dynamic stats
      await fetchStats();
      await fetchBroadcastsHistory();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || (isAr ? 'فشل تحميل البيانات التمهيدية' : 'Failed to load initial dashboard data'));
    } finally {
      setLoading(false);
    }
  };

  const fetchBroadcastsHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await axios.get(`${API_URL}/api/rep/broadcasts`, { headers });
      if (res.data?.success) {
        setBroadcastsHistory(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch broadcasts history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  /* ── Load Attendance sheet for selected schedule & date ───────── */
  const fetchAttendanceSheet = async (scheduleId, date) => {
    if (!scheduleId) return;
    try {
      const res = await axios.get(`${API_URL}/api/rep/attendance`, {
        params: { scheduleId, date },
        headers
      });
      if (res.data?.success) {
        const records = res.data.data;
        const initialSheet = {};
        classmates.forEach(student => {
          initialSheet[student.id] = 'PRESENT';
        });
        records.forEach(r => {
          initialSheet[r.studentId] = r.status;
        });
        setAttendanceSheet(initialSheet);
      }
    } catch (err) {
      console.error('Failed to load attendance:', err);
    }
  };

  useEffect(() => {
    if (classmates.length > 0 && selectedScheduleId) {
      fetchAttendanceSheet(selectedScheduleId, selectedDate);
    }
  }, [selectedScheduleId, selectedDate, classmates]);

  useEffect(() => {
    if (activeTab === 'rescheduling') {
      fetchRescheduleHistory();
    }
    if (activeTab === 'broadcasts') {
      fetchBroadcastsHistory();
    }
  }, [activeTab]);

  /* ── Quick Fill Helpers ───────────────────────────────────────── */
  const handleMarkAllPresent = () => {
    const updated = { ...attendanceSheet };
    classmates.forEach(c => {
      updated[c.id] = 'PRESENT';
    });
    setAttendanceSheet(updated);
    toast.success(isAr ? 'تم تحديد جميع الطلاب كحاضرين' : 'All students marked as Present');
  };

  const handleResetSheet = () => {
    const updated = { ...attendanceSheet };
    classmates.forEach(c => {
      updated[c.id] = 'PRESENT';
    });
    setAttendanceSheet(updated);
    toast(isAr ? 'تمت إعادة تعيين الورقة لحالتها الافتراضية' : 'Attendance sheet reset to default');
  };

  /* ── Export Current Sheet to CSV ─────────────────────────────── */
  const handleExportCSV = () => {
    if (!selectedScheduleId) return;
    const activeSchedule = schedules.find(s => s.id.toString() === selectedScheduleId);
    const subjectName = activeSchedule?.subject?.name || 'Class';
    
    // Header
    const csvRows = [];
    csvRows.push([
      isAr ? 'الرقم الأكاديمي' : 'ID Number',
      isAr ? 'اسم الطالب' : 'Student Name',
      isAr ? 'الحالة' : 'Attendance Status',
      isAr ? 'التاريخ' : 'Date'
    ]);
    
    classmates.forEach(c => {
      const status = attendanceSheet[c.id] || 'PRESENT';
      let statusStr = status;
      if (isAr) {
        statusStr = status === 'PRESENT' ? 'حاضر' : status === 'ABSENT' ? 'غائب' : 'عذر مقبول';
      }
      csvRows.push([c.idNumber, c.name, statusStr, selectedDate]);
    });
    
    // UTF-8 BOM representation to force Microsoft Excel to parse Arabic content correctly
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' 
      + csvRows.map(e => e.map(val => `"${val}"`).join(',')).join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Attendance_${subjectName.replace(/\s+/g, '_')}_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /* ── Save Attendance ─────────────────────────────────────────── */
  const handleSaveAttendance = async (e) => {
    e.preventDefault();
    if (!selectedScheduleId) {
      toast.error(isAr ? 'الرجاء اختيار الحصة أولاً' : 'Please select a class first');
      return;
    }
    setSavingAttendance(true);
    try {
      const records = Object.keys(attendanceSheet).map(studentId => ({
        studentId: parseInt(studentId),
        status: attendanceSheet[studentId]
      }));

      const res = await axios.post(`${API_URL}/api/rep/attendance`, {
        scheduleId: parseInt(selectedScheduleId),
        date: selectedDate,
        records
      }, { headers });

      if (res.data?.success) {
        toast.success(isAr ? 'تم حفظ وإرسال الإشعارات للطلاب بنجاح!' : 'Attendance saved & notifications dispatched!');
        // Refresh stats
        fetchStats();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || (isAr ? 'فشل حفظ التحضير' : 'Failed to save attendance'));
    } finally {
      setSavingAttendance(false);
    }
  };

  /* ── Broadcast Message ───────────────────────────────────────── */
  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) {
      toast.error(isAr ? 'الرجاء كتابة نص الإعلان' : 'Please write your announcement first');
      return;
    }
    setSendingBroadcast(true);
    try {
      const res = await axios.post(`${API_URL}/api/rep/broadcast`, {
        message: broadcastMessage
      }, { headers });

      if (res.data?.success) {
        toast.success(isAr ? 'تم بث الإعلان وإشعار الطلاب بنجاح' : 'Announcement broadcasted successfully');
        setBroadcastMessage('');
        fetchStats();
        fetchBroadcastsHistory();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || (isAr ? 'فشل إرسال التعميم' : 'Failed to send broadcast'));
    } finally {
      setSendingBroadcast(false);
    }
  };

  /* ── Add Group Resource ──────────────────────────────────────── */
  const handleAddResource = async (e) => {
    e.preventDefault();
    if (!resourceTitle.trim() || !resourceUrl.trim()) {
      toast.error(isAr ? 'الرجاء تعبئة جميع الحقول' : 'Please fill all fields');
      return;
    }
    setAddingResource(true);
    try {
      const res = await axios.post(`${API_URL}/api/rep/resources`, {
        title: resourceTitle,
        url: resourceUrl
      }, { headers });

      if (res.data?.success) {
        toast.success(isAr ? 'تمت إضافة المرجع بنجاح' : 'Resource added successfully');
        setResourceTitle('');
        setResourceUrl('');
        const resList = await axios.get(`${API_URL}/api/rep/resources`, { headers });
        if (resList.data?.success) setResources(resList.data.data);
        fetchStats();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || (isAr ? 'فشل إضافة المرجع' : 'Failed to add resource'));
    } finally {
      setAddingResource(false);
    }
  };

  /* ── Submit Reschedule Request ─────────────────────────────── */
  const handleRescheduleRequest = async (e) => {
    e.preventDefault();
    if (!rescheduleScheduleId) {
      toast.error(isAr ? 'الرجاء اختيار الحصة' : 'Please select a class');
      return;
    }
    setSubmittingReschedule(true);
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

      const res = await axios.post(`${API_URL}/api/rep/reschedule`, payload, { headers });

      if (res.data?.success) {
        toast.success(isAr ? 'تم إرسال طلب التعديل بنجاح' : 'Reschedule request submitted successfully');
        setRescheduleReason('');
        setNewStartTime('');
        setNewEndTime('');
        setNewRoomId('');
        fetchRescheduleHistory();
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || (isAr ? 'فشل إرسال طلب التعديل' : 'Failed to submit reschedule request'));
    } finally {
      setSubmittingReschedule(false);
    }
  };

  // Filter classmate list dynamically based on search bar query
  const filteredClassmates = classmates.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.idNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="h-10 w-10 border-4 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45 }}
      dir={isAr ? 'rtl' : 'ltr'}
      className="w-full max-w-4xl mx-auto space-y-8 text-white p-2"
      style={{ fontFamily: "'Urbanist', 'Inter', sans-serif" }}
    >
      {/* ── Dashboard Header ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tighter text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(to right, var(--accent), var(--accent-2, var(--accent)))' }}>
            {isAr ? 'لوحة المندوب الشاملة' : 'Representative Dashboard'}
          </h2>
          <p className="text-xs text-white/50 mt-1">
            {isAr ? 'إدارة شؤون مجموعتك، حضور الطلاب، مراجع الشعبة وتنسيق المواعيد.' : 'Manage group telemetry, classmate attendances, shared resources, and class times.'}
          </p>
        </div>
      </div>

      {/* ── Stats Widget Banner ─────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="frosted-panel rounded-2xl p-5 border border-white/5 bg-white/2 flex flex-col justify-center">
          <p className="text-[9px] font-black uppercase text-white/40 tracking-wider mb-1">{isAr ? 'إجمالي الطلاب' : 'Group Size'}</p>
          <h4 className="text-2xl font-black text-white font-mono">{stats.totalClassmates}</h4>
        </div>
        <div className="frosted-panel rounded-2xl p-5 border border-white/5 bg-white/2 flex flex-col justify-center">
          <p className="text-[9px] font-black uppercase text-white/40 tracking-wider mb-1">{isAr ? 'معدل الحضور العام' : 'Attendance Rate'}</p>
          <h4 className="text-2xl font-black text-[var(--accent)] font-mono">{stats.attendanceRate}%</h4>
        </div>
        <div className="frosted-panel rounded-2xl p-5 border border-white/5 bg-white/2 flex flex-col justify-center">
          <p className="text-[9px] font-black uppercase text-white/40 tracking-wider mb-1">{isAr ? 'المراجع المشاركة' : 'Shared Files'}</p>
          <h4 className="text-2xl font-black text-blue-400 font-mono">{stats.totalResources}</h4>
        </div>
      </div>

      {/* ── Action Buttons Grid ─────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-2">
        <button 
          onClick={handleOpenQRModal}
          className="bg-emerald-500 text-slate-950 p-4 rounded-2xl text-xs font-black shadow-[0_0_15px_rgba(16,185,129,0.3)] flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform"
        >
          <span className="text-xl">📱</span>
          {isAr ? 'تحضير بـ QR' : 'QR Attendance'}
        </button>
        <button 
          onClick={handleOpenPollModal}
          className="bg-slate-800 border border-slate-700/50 text-white p-4 rounded-2xl text-xs font-black flex flex-col items-center justify-center gap-1.5 active:scale-95 transition-transform hover:bg-slate-750"
        >
          <span className="text-xl text-blue-400">📊</span>
          {isAr ? 'إرسال تصويت' : 'Send Poll'}
        </button>
      </div>

      {/* ── Tab Selector pills ──────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-white/5">
        {tabs.map(tab => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-full text-xs font-black tracking-wider transition-all duration-300 border whitespace-nowrap ${
                active
                  ? 'bg-[var(--accent)] text-slate-950 border-[var(--accent)] shadow-lg'
                  : 'bg-white/5 hover:bg-white/10 border-white/5 text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Container ───────────────────────────────────────── */}
      <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl backdrop-blur-md">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {/* Tab 1: Attendance */}
            {activeTab === 'attendance' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div className="w-full md:w-auto space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-white/40">
                      {isAr ? 'اختر الحصة الدراسية' : 'Select Lecture'}
                    </label>
                    <select
                      value={selectedScheduleId}
                      onChange={e => setSelectedScheduleId(e.target.value)}
                      className="cmd-input w-full md:w-72 cursor-pointer font-bold"
                    >
                      <option value="" disabled>{isAr ? 'اختر المحاضرة...' : 'Select lecture...'}</option>
                      {schedules.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.subject?.name} ({isAr ? ({SUNDAY:'الأحد',MONDAY:'الاثنين',TUESDAY:'الثلاثاء',WEDNESDAY:'الأربعاء',THURSDAY:'الخميس',FRIDAY:'الجمعة',SATURDAY:'السبت'}[s.dayOfWeek]) : s.dayOfWeek} · {s.startTime})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-full md:w-auto space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-wider text-white/40">
                      {isAr ? 'تاريخ الحضور' : 'Date'}
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                      className="cmd-input w-full md:w-48 font-bold"
                    />
                  </div>
                </div>

                {/* Filter and quick actions */}
                <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white/2 p-4 rounded-2xl border border-white/5">
                  <input
                    type="text"
                    placeholder={isAr ? 'البحث بالاسم أو الرقم الأكاديمي...' : 'Search student name or ID...'}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="cmd-input w-full sm:w-64 text-xs"
                  />
                  <div className="flex gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={handleMarkAllPresent}
                      className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold transition-all"
                    >
                      ✓ {isAr ? 'الجميع حضور' : 'All Present'}
                    </button>
                    <button
                      type="button"
                      onClick={handleResetSheet}
                      className="px-3 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 rounded-xl text-xs font-bold transition-all"
                    >
                      ↺ {isAr ? 'إعادة تعيين' : 'Reset'}
                    </button>
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="px-3 py-2 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 text-blue-400 rounded-xl text-xs font-bold transition-all"
                    >
                      📥 {isAr ? 'تصدير ورقة التحضير' : 'Export CSV'}
                    </button>
                  </div>
                </div>

                {filteredClassmates.length === 0 ? (
                  <div className="text-center py-12 text-white/40 text-xs font-bold font-mono">
                    {isAr ? 'لا يوجد زملاء دراسة يطابقون خيارات البحث.' : 'No classmates match your filters.'}
                  </div>
                ) : (
                  <form onSubmit={handleSaveAttendance} className="space-y-4">
                    <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                      {filteredClassmates.map(student => {
                        const currentStatus = attendanceSheet[student.id] || 'PRESENT';
                        
                        // Find dynamic stats from stats hook
                        const studentStats = stats.classmateStats?.find(cs => cs.id === student.id);
                        const individualRate = studentStats ? studentStats.attendanceRate : 100;

                        return (
                          <div key={student.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white/2 border border-white/5 rounded-2xl gap-3 hover:border-white/10 transition-all">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-bold text-white truncate">{student.name}</p>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-black font-mono ${
                                  individualRate >= 85 ? 'bg-emerald-500/10 text-emerald-400' :
                                  individualRate >= 65 ? 'bg-yellow-500/10 text-yellow-400' :
                                  'bg-red-500/10 text-red-400'
                                }`}>
                                  {individualRate}% {isAr ? 'حضور' : 'Rate'}
                                </span>
                              </div>
                              <p className="text-[10px] text-white/40 font-mono mt-1">{student.idNumber}</p>
                            </div>
                            <div className="flex gap-1">
                              {[
                                { status: 'PRESENT', label: isAr ? 'حاضر' : 'Present', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
                                { status: 'ABSENT', label: isAr ? 'غائب' : 'Absent', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
                                { status: 'EXCUSED', label: isAr ? 'بعذر' : 'Excused', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' }
                              ].map(opt => {
                                const selected = currentStatus === opt.status;
                                return (
                                  <button
                                    key={opt.status}
                                    type="button"
                                    onClick={() => setAttendanceSheet({ ...attendanceSheet, [student.id]: opt.status })}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                                      selected
                                        ? opt.color + ' border-current scale-105 shadow-md'
                                        : 'bg-white/3 border-transparent text-slate-400 hover:bg-white/5'
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <button type="submit" disabled={savingAttendance} className="btn-neon w-full py-3.5 mt-2">
                      {savingAttendance ? (
                        <span className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin inline-block" />
                      ) : (isAr ? 'حفظ وإرسال ورقة التحضير' : 'Save Attendance Sheet')}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Tab 2: Broadcast announcements */}
            {activeTab === 'broadcasts' && (
              <div className="space-y-6">
                <form onSubmit={handleSendBroadcast} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-white/40 uppercase mb-2">
                      {isAr ? 'نص التعميم / إرسال تنبيه منبثق' : 'Broadcast Message'}
                    </label>
                    <textarea
                      required
                      value={broadcastMessage}
                      onChange={e => setBroadcastMessage(e.target.value)}
                      className="cmd-input w-full h-28 p-4 text-xs font-semibold"
                      placeholder={isAr ? 'مثال: السلام عليكم زملائي الكرام، تم تأجيل محاضرة الغد إلى الساعة العاشرة صباحاً بناءً على طلب الأستاذ.' : 'Type announcement for classmates...'}
                    />
                  </div>
                  <button type="submit" disabled={sendingBroadcast} className="btn-neon w-full py-3">
                    {sendingBroadcast ? (
                      <span className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin inline-block" />
                    ) : (isAr ? 'بث الإعلان وإرسال إشعار فوري للجميع' : 'Broadcast Announcement') }
                  </button>
                </form>

                {/* تاريخ التعميمات والتحقق من الاستلام */}
                <div className="pt-6 border-t border-white/5 space-y-4">
                  <h4 className="text-sm font-black text-white">📢 {isAr ? 'سجل الإعلانات الموجهة للدفعة' : 'Class Announcements Log'}</h4>
                  {loadingHistory && broadcastsHistory.length === 0 ? (
                    <div className="flex justify-center py-6">
                      <span className="h-6 w-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : broadcastsHistory.length === 0 ? (
                    <p className="text-xs text-white/40 font-semibold font-mono">{isAr ? 'لا يوجد تعميمات سابقة.' : 'No announcements broadcasted yet.'}</p>
                  ) : (
                    <div className="space-y-3">
                      {broadcastsHistory.map(b => {
                        const total = b.recipients.length;
                        const read = b.recipients.filter(r => r.status === 'READ').length;
                        const delivered = b.recipients.filter(r => r.status === 'DELIVERED').length;
                        const pending = b.recipients.filter(r => r.status === 'PENDING').length;

                        return (
                          <div key={b.broadcastId} className="p-4 bg-white/2 border border-white/5 rounded-2xl text-xs space-y-3 hover:border-white/10 transition-all">
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0 flex-1 text-right">
                                <span className="text-[9px] text-slate-500 font-mono">
                                  {new Date(b.sentTime).toLocaleString(isAr ? 'ar-EG' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                                <p className="font-extrabold text-white mt-1 leading-relaxed line-clamp-2" dir="rtl">{b.message}</p>
                              </div>
                              <button
                                onClick={() => {
                                  setSelectedBroadcast(b);
                                  setIsBroadcastModalOpen(true);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-[var(--accent)] text-slate-955 font-black text-[10px] hover:opacity-90 transition-all whitespace-nowrap active:scale-95 shrink-0"
                              >
                                {isAr ? 'حالة الاستلام' : 'Delivery Status'}
                              </button>
                            </div>

                            {/* مؤشرات قراءة الرسالة */}
                            <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400">
                              <div className="flex items-center gap-1">
                                <span className="text-emerald-400">✔✔</span>
                                <span>{isAr ? 'قُرئت:' : 'Read:'} {read}/{total}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-slate-500">✔✔</span>
                                <span>{isAr ? 'وصلت:' : 'Delivered:'} {delivered}/{total}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-slate-650">✔</span>
                                <span>{isAr ? 'انتظار:' : 'Pending:'} {pending}/{total}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 3: Group Resources */}
            {activeTab === 'resources' && (
              <div className="space-y-6">
                <form onSubmit={handleAddResource} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-white/40 uppercase mb-2">
                        {isAr ? 'عنوان الملف / المرجع الدراسي' : 'Resource Title'}
                      </label>
                      <input
                        type="text" required value={resourceTitle} onChange={(e) => setResourceTitle(e.target.value)}
                        className="cmd-input w-full" placeholder={isAr ? 'مثال: ملخص الدرس الأول شبكات' : 'e.g., Lecture 1 Notes'}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-white/40 uppercase mb-2">
                        {isAr ? 'رابط الملف (على Google Drive, Telegram إلخ)' : 'Resource URL Link'}
                      </label>
                      <input
                        type="url" required value={resourceUrl} onChange={(e) => setResourceUrl(e.target.value)}
                        className="cmd-input w-full font-mono" placeholder="https://drive.google.com/..."
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={addingResource} className="btn-neon w-full py-3">
                    {addingResource ? (
                      <span className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin inline-block" />
                    ) : (isAr ? 'نشر الملف ومشاركته مع الدفعة' : 'Share File link') }
                  </button>
                </form>

                <div className="pt-6 border-t border-white/5 space-y-4">
                  <h4 className="text-sm font-black text-white">{isAr ? 'الملفات والمراجع النشطة' : 'Shared References'}</h4>
                  {resources.length === 0 ? (
                    <p className="text-xs text-white/40 font-semibold font-mono">{isAr ? 'لا يوجد مستندات مشاركة حالياً.' : 'No shared references yet.'}</p>
                  ) : (
                    <div className="space-y-2">
                      {resources.map(res => (
                        <div key={res.id} className="flex justify-between items-center p-3 bg-white/2 border border-white/5 rounded-xl hover:border-emerald-500/20 transition-all">
                          <div className="min-w-0 pr-4">
                            <p className="text-xs font-bold text-white truncate">{res.title}</p>
                            <p className="text-[9px] text-white/30 font-mono mt-0.5 truncate">{res.url}</p>
                          </div>
                          <a
                            href={res.url} target="_blank" rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold transition-all shrink-0"
                          >
                            {isAr ? 'فتح المرجع ↗' : 'Open Link ↗'}
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab 4: Rescheduling Requests */}
            {activeTab === 'rescheduling' && (
              <div className="space-y-8">
                <form onSubmit={handleRescheduleRequest} className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-white/40 uppercase mb-2">
                        {isAr ? 'اختر الحصة المراد تعديلها' : 'Select Class to Modify'}
                      </label>
                      <select
                        value={rescheduleScheduleId}
                        onChange={e => setRescheduleScheduleId(e.target.value)}
                        className="cmd-input w-full cursor-pointer font-bold"
                      >
                        <option value="" disabled>{isAr ? 'اختر الحصة...' : 'Select class...'}</option>
                        {schedules.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.subject?.name} ({isAr ? ({SUNDAY:'الأحد',MONDAY:'الاثنين',TUESDAY:'الثلاثاء',WEDNESDAY:'الأربعاء',THURSDAY:'الخميس',FRIDAY:'الجمعة',SATURDAY:'السبت'}[s.dayOfWeek]) : s.dayOfWeek} · {s.startTime})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-white/40 uppercase mb-2">
                        {isAr ? 'نوع التعديل المقترح' : 'Proposed Type'}
                      </label>
                      <select
                        value={rescheduleType}
                        onChange={e => setRescheduleType(e.target.value)}
                        className="cmd-input w-full cursor-pointer font-bold"
                      >
                        <option value="RESCHEDULE">{isAr ? 'إعادة جدولة لموعد آخر' : 'Reschedule Class'}</option>
                        <option value="CANCEL">{isAr ? 'إلغاء المحاضرة بالكامل' : 'Cancel Class'}</option>
                      </select>
                    </div>
                  </div>

                  {rescheduleType === 'RESCHEDULE' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white/2 border border-white/5 rounded-2xl">
                      <div>
                        <label className="block text-xs font-bold text-white/40 uppercase mb-2">
                          {isAr ? 'اليوم البديل المقترح' : 'Suggested Day'}
                        </label>
                        <select
                          value={newDayOfWeek}
                          onChange={e => setNewDayOfWeek(e.target.value)}
                          className="cmd-input w-full cursor-pointer font-bold"
                        >
                          {['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].map(day => (
                            <option key={day} value={day}>
                              {isAr ? ({SUNDAY:'الأحد',MONDAY:'الاثنين',TUESDAY:'الثلاثاء',WEDNESDAY:'الأربعاء',THURSDAY:'الخميس',FRIDAY:'الجمعة',SATURDAY:'السبت'}[day]) : day}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-white/40 uppercase mb-2">
                          {isAr ? 'القاعة البديلة المقترحة (اختياري)' : 'Suggested Room (Optional)'}
                        </label>
                        <select
                          value={newRoomId}
                          onChange={e => setNewRoomId(e.target.value)}
                          className="cmd-input w-full cursor-pointer font-bold"
                        >
                          <option value="">{isAr ? '-- اختر قاعة --' : '-- Select Room --'}</option>
                          {rooms.map(r => (
                            <option key={r.id} value={r.id}>{r.name} ({isAr ? 'سعة' : 'cap'}: {r.capacity})</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-white/40 uppercase mb-2">
                          {isAr ? 'وقت البدء الجديد' : 'New Start Time'}
                        </label>
                        <input
                          type="time" required value={newStartTime} onChange={e => setNewStartTime(e.target.value)}
                          className="cmd-input w-full font-semibold" dir="ltr"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-white/40 uppercase mb-2">
                          {isAr ? 'وقت الانتهاء الجديد' : 'New End Time'}
                        </label>
                        <input
                          type="time" required value={newEndTime} onChange={e => setNewEndTime(e.target.value)}
                          className="cmd-input w-full font-semibold" dir="ltr"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-white/40 uppercase mb-2">
                      {isAr ? 'توضيح سبب التعديل للإدارة' : 'Reason for adjustment'}
                    </label>
                    <textarea
                      required
                      value={rescheduleReason}
                      onChange={e => setRescheduleReason(e.target.value)}
                      className="cmd-input w-full h-24 p-3 text-sm font-semibold"
                      placeholder={isAr ? 'مثال: تزامن مع موعد اختبار آخر، أو لعدم توفر المدرس في الموعد الأصلي.' : 'Why is this change needed...'}
                    />
                  </div>

                  <button type="submit" disabled={submittingReschedule} className="btn-neon w-full py-3.5">
                    {submittingReschedule ? (
                      <span className="h-4 w-4 border-2 border-black border-t-transparent rounded-full animate-spin inline-block" />
                    ) : (isAr ? 'إرسال طلب التعديل إلى إدارة الكلية' : 'Submit Adjustment Request') }
                  </button>
                </form>

                {/* Reschedule request history list */}
                <div className="pt-6 border-t border-white/5 space-y-4">
                  <h4 className="text-sm font-black text-white">📋 {isAr ? 'طلبات التعديل السابقة وحالتها' : 'Adjustment Requests History'}</h4>
                  {historyLoading && rescheduleHistory.length === 0 ? (
                    <div className="flex justify-center py-6">
                      <span className="h-6 w-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : rescheduleHistory.length === 0 ? (
                    <p className="text-xs text-white/40 font-semibold font-mono">{isAr ? 'لا يوجد طلبات سابقة لشعبتك.' : 'No rescheduling request history found.'}</p>
                  ) : (
                    <div className="space-y-3">
                      {rescheduleHistory.map(req => (
                        <div key={req.id} className="p-4 bg-white/2 border border-white/5 rounded-2xl text-xs space-y-3">
                          <div className="flex justify-between items-start flex-wrap gap-2">
                            <div>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                req.requestType === 'CANCEL' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'
                              }`}>
                                {req.requestType}
                              </span>
                              <h5 className="font-extrabold text-white mt-1.5">{req.schedule?.subject?.name || 'Class'}</h5>
                              <p className="text-[10px] text-white/40 font-mono mt-0.5">{isAr ? 'المدرس:' : 'Lecturer:'} {req.lecturer?.name || '—'}</p>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                              req.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/15' :
                              req.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15' :
                              'bg-rose-500/10 text-rose-400 border border-rose-500/15'
                            }`}>
                              {req.status === 'PENDING' ? (isAr ? 'معلق' : 'Pending') :
                               req.status === 'APPROVED' ? (isAr ? 'مقبول' : 'Approved') : (isAr ? 'مرفوض' : 'Rejected')}
                            </span>
                          </div>

                          {req.requestType === 'RESCHEDULE' && (
                            <div className="p-2.5 bg-black/40 rounded-xl font-mono text-[10px] space-y-1 text-white/70">
                              <p>🗓️ {isAr ? 'الموعد الجديد:' : 'Proposed Slot:'} {isAr ? ({SUNDAY:'الأحد',MONDAY:'الاثنين',TUESDAY:'الثلاثاء',WEDNESDAY:'الأربعاء',THURSDAY:'الخميس',FRIDAY:'الجمعة',SATURDAY:'السبت'}[req.newDayOfWeek]) : req.newDayOfWeek} · {req.newStartTime} - {req.newEndTime}</p>
                              {req.newRoom && <p>🏫 {isAr ? 'القاعة المقترحة:' : 'Proposed Room:'} {req.newRoom.name}</p>}
                            </div>
                          )}

                          <div className="text-[11px] text-white/60 space-y-1 leading-relaxed">
                            <p><span className="font-bold text-white/80">{isAr ? 'السبب:' : 'Reason:'}</span> {req.reason || '—'}</p>
                            {req.adminNotes && (
                              <p className="text-amber-300 font-bold bg-amber-500/5 p-2 rounded-lg border border-amber-500/10 mt-2">
                                💬 {isAr ? 'ملاحظات الإدارة:' : 'Admin Notes:'} {req.adminNotes}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      {/* ── Recipient Delivery Status Modal ── */}
      {isBroadcastModalOpen && selectedBroadcast && (
        <div className="fixed inset-0 z-[9995] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="frosted-panel w-full max-w-lg rounded-3xl border border-white/10 bg-[#121824] p-6 shadow-2xl space-y-5 text-right font-sans overflow-hidden max-h-[90vh] flex flex-col"
            dir={isAr ? 'rtl' : 'ltr'}
          >
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-white/5 pb-3">
              <div className="text-right">
                <h3 className="text-md font-black text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] to-teal-400">
                  {isAr ? 'تفاصيل حالة استلام الإعلان' : 'Announcement Delivery Logs'}
                </h3>
                <p className="text-[10px] text-slate-500 mt-1 font-mono">
                  {new Date(selectedBroadcast.sentTime).toLocaleString(isAr ? 'ar-EG' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              <button
                onClick={() => {
                  setIsBroadcastModalOpen(false);
                  setSelectedBroadcast(null);
                }}
                className="h-7 w-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all text-xs"
              >
                ✕
              </button>
            </div>

            {/* Announcement Message Box */}
            <div className="p-3.5 bg-black/35 border border-white/5 rounded-2xl text-xs text-slate-200 leading-relaxed max-h-24 overflow-y-auto text-right" dir="rtl">
              {selectedBroadcast.message}
            </div>

            {/* Recipient Categorized Statuses */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* 1. READ LIST */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                  <span>✔✔ {isAr ? 'قرأ الإعلان' : 'Read'} ({selectedBroadcast.recipients.filter(r => r.status === 'READ').length})</span>
                </div>
                <div className="space-y-1.5">
                  {selectedBroadcast.recipients.filter(r => r.status === 'READ').map(r => (
                    <div key={r.studentId} className="flex justify-between items-center p-2 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-400 text-[10px]">●</span>
                        <span className="font-bold text-white">{r.studentName}</span>
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono font-semibold">
                        {r.readAt ? new Date(r.readAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  ))}
                  {selectedBroadcast.recipients.filter(r => r.status === 'READ').length === 0 && (
                    <p className="text-[10px] text-slate-600 font-bold italic">{isAr ? 'لم يقرأه أحد بعد' : 'No one read yet'}</p>
                  )}
                </div>
              </div>

              {/* 2. DELIVERED LIST */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  <span>✔✔ {isAr ? 'استلم ولم يقرأ' : 'Delivered'} ({selectedBroadcast.recipients.filter(r => r.status === 'DELIVERED').length})</span>
                </div>
                <div className="space-y-1.5">
                  {selectedBroadcast.recipients.filter(r => r.status === 'DELIVERED').map(r => (
                    <div key={r.studentId} className="flex justify-between items-center p-2 bg-white/2 border border-white/5 rounded-xl text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-[10px]">●</span>
                        <span className="font-bold text-white">{r.studentName}</span>
                      </div>
                      <span className="text-[9px] text-slate-500 font-mono font-semibold">
                        {r.deliveredAt ? new Date(r.deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  ))}
                  {selectedBroadcast.recipients.filter(r => r.status === 'DELIVERED').length === 0 && (
                    <p className="text-[10px] text-slate-600 font-bold italic">{isAr ? 'لا يوجد مستلمين لم يقرأوا' : 'No unread deliveries'}</p>
                  )}
                </div>
              </div>

              {/* 3. PENDING LIST */}
              <div className="space-y-2 pt-2 border-t border-white/5">
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-600 tracking-wider">
                  <span>✔ {isAr ? 'في الانتظار (أوفلاين)' : 'Pending (Offline)'} ({selectedBroadcast.recipients.filter(r => r.status === 'PENDING').length})</span>
                </div>
                <div className="space-y-1.5">
                  {selectedBroadcast.recipients.filter(r => r.status === 'PENDING').map(r => (
                    <div key={r.studentId} className="flex justify-between items-center p-2 bg-slate-900/30 border border-white/5 rounded-xl text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-600 text-[10px]">●</span>
                        <span className="font-bold text-slate-400">{r.studentName}</span>
                      </div>
                      <span className="text-[9px] text-slate-600 font-mono font-semibold">
                        Pending
                      </span>
                    </div>
                  ))}
                  {selectedBroadcast.recipients.filter(r => r.status === 'PENDING').length === 0 && (
                    <p className="text-[10px] text-slate-600 font-bold italic">{isAr ? 'تلقى الجميع التنبيه' : 'All users received'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-white/5 pt-3 flex justify-end">
              <button
                onClick={() => {
                  setIsBroadcastModalOpen(false);
                  setSelectedBroadcast(null);
                }}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs active:scale-95 transition-all"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── QR Attendance Modal ── */}
      <AnimatePresence>
        {isQRModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1e293b] border border-slate-700/50 rounded-3xl p-6 w-full max-w-sm text-white shadow-2xl relative text-right"
              dir="rtl"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-1.5 font-sans">
                  📱 {isAr ? 'تحضير بـ QR' : 'QR Attendance Generator'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsQRModalOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 font-sans text-right">
                <div className="space-y-1">
                  <label className="block text-xs text-[#94a3b8] text-right">
                    {isAr ? 'اختر المحاضرة / المادة للتحضير' : 'Select Lecture / Subject'}
                  </label>
                  <select
                    value={selectedQRScheduleId}
                    onChange={(e) => {
                      setSelectedQRScheduleId(e.target.value);
                      setGeneratedQRToken('');
                    }}
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:border-emerald-500 text-right"
                  >
                    {schedules.map((s) => (
                      <option key={s.id} value={s.id} className="text-right bg-[#0b1120]">
                        {s.subject?.name} - {s.dayOfWeek} ({s.startTime})
                      </option>
                    ))}
                  </select>
                </div>

                {!generatedQRToken ? (
                  <button
                    onClick={handleGenerateQR}
                    disabled={isGeneratingQR || !selectedQRScheduleId}
                    className="w-full bg-emerald-500 hover:bg-emerald-450 text-slate-950 py-3 rounded-xl text-xs font-bold transition-all disabled:opacity-50 mt-2"
                  >
                    {isGeneratingQR 
                      ? (isAr ? 'جاري توليد الرمز...' : 'Generating QR...') 
                      : (isAr ? 'توليد الرمز المشفر' : 'Generate Secure QR')}
                  </button>
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-slate-700/50 space-y-4 my-2">
                    <img 
                      src={`https://chart.googleapis.com/chart?chs=220x220&cht=qr&chl=${encodeURIComponent(generatedQRToken)}`} 
                      alt="Check-in QR Code" 
                      className="w-48 h-48"
                    />
                    <p className="text-[10px] text-slate-700 font-bold text-center leading-relaxed">
                      {isAr 
                        ? 'اطلب من الطلاب فتح تطبيق البوابة ومسح الكود عبر الماسح. ينتهي صلاحية الكود تلقائياً بعد 15 دقيقة.' 
                        : 'Students must scan this code using their Student Portal camera. Token expires in 15 minutes.'}
                    </p>
                  </div>
                )}

                {generatedQRToken && (
                  <button
                    onClick={handleGenerateQR}
                    disabled={isGeneratingQR}
                    className="w-full bg-slate-800 border border-slate-700 text-white py-2 rounded-xl text-xs font-bold transition-all"
                  >
                    🔄 {isAr ? 'تحديث الرمز' : 'Regenerate QR'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Poll Creation Modal ── */}
      <AnimatePresence>
        {isPollModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1e293b] border border-slate-700/50 rounded-3xl p-6 w-full max-w-sm text-white shadow-2xl relative text-right"
              dir="rtl"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-1.5 font-sans">
                  📊 {isAr ? 'إرسال تصويت جديد للشعبة' : 'Send Cohort Poll'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsPollModalOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreatePollSubmit} className="space-y-4 font-sans text-right">
                <div className="space-y-1">
                  <label className="block text-xs text-[#94a3b8] text-right">
                    {isAr ? 'سؤال الاستبيان' : 'Poll Question'}
                  </label>
                  <input
                    type="text"
                    required
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl p-3 text-xs text-white outline-none placeholder:text-slate-600 focus:border-blue-500 text-right"
                    placeholder={isAr ? 'مثال: ما هو الموعد المناسب لتعويض محاضرة السبت؟' : 'e.g. When is the best time for the makeup class?'}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs text-[#94a3b8] text-right">
                    {isAr ? 'خيارات التصويت' : 'Poll Options'}
                  </label>
                  {pollOptions.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      {pollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePollOption(idx)}
                          className="text-red-400 hover:text-red-300 transition-colors text-sm"
                        >
                          ✕
                        </button>
                      )}
                      <input
                        type="text"
                        required
                        value={opt}
                        onChange={(e) => handlePollOptionChange(idx, e.target.value)}
                        className="w-full bg-[#0b1120] border border-slate-700 rounded-xl p-2.5 text-xs text-white outline-none focus:border-blue-500 text-right"
                        placeholder={isAr ? `الخيار ${idx + 1}` : `Option ${idx + 1}`}
                      />
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    onClick={handleAddPollOption}
                    className="text-[10px] text-blue-400 font-bold hover:text-blue-300 flex items-center gap-1 mt-1 transition-colors"
                  >
                    ➕ {isAr ? 'إضافة خيار آخر' : 'Add Option'}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingPoll}
                  className="w-full bg-blue-500 hover:bg-blue-450 text-white py-3 rounded-xl text-xs font-bold transition-all disabled:opacity-50 mt-4"
                >
                  {isSubmittingPoll 
                    ? (isAr ? 'جاري النشر في الملتقى...' : 'Posting to Class Hub...') 
                    : (isAr ? 'نشر التصويت' : 'Create & Post Poll')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
