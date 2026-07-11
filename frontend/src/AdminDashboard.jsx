import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { API_URL } from './config';
import ThemeSwitcher from './ThemeSwitcher';
import ConfirmationModal from './ConfirmationModal';
import DevSignature from './DevSignature';

import OverviewTab from './components/admin/OverviewTab';
import ApprovalsTab from './components/admin/ApprovalsTab';
import ScheduleTab from './components/admin/ScheduleTab';
import BroadcastTab from './components/admin/BroadcastTab';
import BulkImportTab from './components/admin/BulkImportTab';
import ExamsTab from './components/admin/ExamsTab';
import LecturersTab from './components/admin/LecturersTab';

const DAYS = ['SATURDAY', 'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY'];
const TIME_SLOTS = [
  { start: '08:00', end: '10:00', label: '08:00 AM - 10:00 AM' },
  { start: '10:00', end: '12:00', label: '10:00 AM - 12:00 PM' },
  { start: '12:00', end: '14:00', label: '12:00 PM - 02:00 PM' },
  { start: '14:00', end: '16:00', label: '02:00 PM - 04:00 PM' },
  { start: '16:00', end: '18:00', label: '04:00 PM - 06:00 PM' },
];

const getActiveDay = (schedule) => {
  if (schedule.overrides && schedule.overrides.length > 0) {
    const latest = schedule.overrides[schedule.overrides.length - 1];
    const date = new Date(latest.date);
    const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
    return dayNames[date.getDay()];
  }
  return schedule.dayOfWeek;
};

const getActiveStartTime = (s) => {
  if (s.overrides && s.overrides.length > 0) {
    const l = s.overrides[s.overrides.length - 1];
    return l.newStartTime || s.startTime;
  }
  return s.startTime;
};

const getActiveEndTime = (s) => {
  if (s.overrides && s.overrides.length > 0) {
    const l = s.overrides[s.overrides.length - 1];
    return l.newEndTime || s.endTime;
  }
  return s.endTime;
};

export default function AdminDashboard({ tab }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const [activeTab, setActiveTab] = useState(tab || 'overview'); // overview, approvals, schedule, broadcast
  
  useEffect(() => {
    if (tab) {
      setActiveTab(tab);
    }
  }, [tab]);

  const [loading, setLoading] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // ── View 1: Overview States ──────────────────────────────────────────
  const [metrics, setMetrics] = useState({ students: 0, lectures: 0, departments: 0, classrooms: 0 });
  const [analytics, setAnalytics] = useState(null); // { totalStudents, totalGroups, totalSchedules, attendanceHealth, ... }
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [rescheduleRequests, setRescheduleRequests] = useState([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [noteMap, setNoteMap] = useState({});
  const [dateMap, setDateMap] = useState({});

  // ── View 2: Approvals States ─────────────────────────────────────────
  const [unverifiedStudents, setUnverifiedStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [approvingId, setApprovingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);

  // ── View 3: Kanban Schedule Manager States ────────────────────────────
  const [schedules, setSchedules] = useState([]);
  const [groups, setGroups] = useState([]);
  // ── Classroom Occupancy Modal States ───────────────────────────────────────
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [roomsList, setRoomsList] = useState([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomSearchQuery, setRoomSearchQuery] = useState('');
  // ── Cascading schedule filter: Major → Level → Group ───────────────────────
  const [schedMajor, setSchedMajor] = useState('ALL');
  const [schedLevel, setSchedLevel] = useState('ALL');
  const [schedGroup, setSchedGroup] = useState('ALL');
  const [draggedSchedule, setDraggedSchedule] = useState(null);
  const [overrideConfirmData, setOverrideConfirmData] = useState(null);
  const [isAddScheduleOpen, setIsAddScheduleOpen] = useState(false);
  const [newScheduleForm, setNewScheduleForm] = useState({
    subjectName: '',
    subjectCode: '',
    subjectType: 'THEORY',
    roomName: '',
    roomCapacity: '45',
    lecturerName: '',
    groupName: 'Group A',
    dayOfWeek: 'SATURDAY',
    timeSlotIndex: '0'
  });

  const [isEditScheduleOpen, setIsEditScheduleOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [editScheduleForm, setEditScheduleForm] = useState({
    subjectName: '',
    subjectCode: '',
    subjectType: 'THEORY',
    roomName: '',
    roomCapacity: '45',
    lecturerName: '',
    groupName: 'Group A',
    dayOfWeek: 'SATURDAY',
    timeSlotIndex: '0'
  });

  // ── View 6: Exam States ───────────────────────────────────────────────
  const [exams, setExams] = useState([]);
  const [examsLoading, setExamsLoading] = useState(false);
  const [isAddExamOpen, setIsAddExamOpen] = useState(false);
  const [examSubmitting, setExamSubmitting] = useState(false);
  const [newExamForm, setNewExamForm] = useState({
    subjectName: '',
    subjectCode: '',
    roomName: '',
    groupName: '',
    examDate: '',
    startTime: '08:00',
    endTime: '10:00',
    notes: ''
  });

  // ── View 4: Broadcast States ─────────────────────────────────────────
  const [broadcastTarget, setBroadcastTarget] = useState('ALL');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastPriority, setBroadcastPriority] = useState('normal'); // normal, urgent
  const [broadcastLoading, setBroadcastLoading] = useState(false);

  // ── View 5: Bulk Import States ────────────────────────────────────────
  const [bulkUploadType, setBulkUploadType] = useState('students'); // students | schedules | exams
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkFileName, setBulkFileName] = useState('');
  const [bulkDragging, setBulkDragging] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null); // { created, skipped, errors[], message }

  const token = localStorage.getItem('manar_token');
  const userJson = localStorage.getItem('manar_user');
  let user = null;
  if (userJson) {
    try { user = JSON.parse(userJson); } catch {}
  }
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // Apply accent color styling token locally
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', '#22d3ee'); // Cyan accent
    document.documentElement.style.setProperty('--accent-glow', 'rgba(34,211,238,0.2)');
    document.documentElement.style.setProperty('--accent-dim', 'rgba(34,211,238,0.08)');
  }, []);

  // Reload tab contents on switch
  useEffect(() => {
    if (activeTab === 'overview') {
      fetchMetrics();
      fetchRescheduleRequests();
      fetchAnalytics();
    } else if (activeTab === 'approvals') {
      fetchUnverifiedStudents();
    } else if (activeTab === 'schedule') {
      fetchSchedules();
      fetchGroups();
    } else if (activeTab === 'exams') {
      fetchExams();
      fetchGroups();
    } else if (activeTab === 'broadcast') {
      fetchGroups();
    } else if (activeTab === 'bulkImport') {
      setBulkResult(null);
      setBulkFile(null);
      setBulkFileName('');
    }
  }, [activeTab]);

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

  const translateDay = (day) => {
    const map = {
      SUNDAY: 'الأحد',
      MONDAY: 'الإثنين',
      TUESDAY: 'الثلاثاء',
      WEDNESDAY: 'الأربعاء',
      THURSDAY: 'الخميس',
      FRIDAY: 'الجمعة',
      SATURDAY: 'السبت'
    };
    return isAr ? (map[day] || day) : day;
  };

  // ── API Fetchers ────────────────────────────────────────────────────
  const fetchMetrics = async () => {
    try {
      let url = `${API_URL}/api/admin/metrics`;
      if (isSuperAdmin) {
        const selCollegeId = localStorage.getItem('superadmin_selectedCollegeId');
        if (selCollegeId) url += `?collegeId=${selCollegeId}`;
      }
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) setMetrics(res.data.data);
    } catch {
      toast.error(isAr ? 'فشل تحميل الإحصائيات' : 'Failed to fetch metrics');
    }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      let url = `${API_URL}/api/admin/analytics`;
      if (isSuperAdmin) {
        const selCollegeId = localStorage.getItem('superadmin_selectedCollegeId');
        if (selCollegeId) url += `?collegeId=${selCollegeId}`;
      }
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) setAnalytics(res.data.data);
    } catch {
      // Non-critical — overview still works without analytics
      console.warn('[Analytics] Failed to fetch analytics data');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchRescheduleRequests = async () => {
    setRequestsLoading(true);
    try {
      let url = `${API_URL}/api/admin/requests`;
      if (isSuperAdmin) {
        const selCollegeId = localStorage.getItem('superadmin_selectedCollegeId');
        if (selCollegeId) url += `?collegeId=${selCollegeId}`;
      }
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) {
        setRescheduleRequests(res.data.data);
        const todayStr = new Date().toISOString().substring(0, 10);
        const dates = {};
        res.data.data.forEach(r => {
          dates[r.id] = todayStr;
        });
        setDateMap(dates);
      }
    } catch {
      toast.error(isAr ? 'فشل جلب طلبات المحاضرين' : 'Failed to load lecturer requests');
    } finally {
      setRequestsLoading(false);
    }
  };

  const fetchUnverifiedStudents = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/admin/unverified-students`;
      if (isSuperAdmin) {
        const selCollegeId = localStorage.getItem('superadmin_selectedCollegeId');
        if (selCollegeId) url += `?collegeId=${selCollegeId}`;
      }
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) {
        setUnverifiedStudents(res.data.data);
        if (res.data.data.length > 0) {
          setSelectedStudent(res.data.data[0]);
        } else {
          setSelectedStudent(null);
        }
      }
    } catch {
      toast.error(isAr ? 'فشل تحميل الحسابات غير الموثقة' : 'Failed to load unverified students');
    } finally {
      setLoading(false);
    }
  };

  const fetchExams = async () => {
    setExamsLoading(true);
    try {
      let url = `${API_URL}/api/exams`;
      if (isSuperAdmin) {
        const selCollegeId = localStorage.getItem('superadmin_selectedCollegeId');
        if (selCollegeId) url += `?collegeId=${selCollegeId}`;
      }
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) {
        setExams(res.data.data);
      }
    } catch {
      toast.error(isAr ? 'فشل تحميل جدول الامتحانات' : 'Failed to load exam schedules');
    } finally {
      setExamsLoading(false);
    }
  };

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/schedules`;
      if (isSuperAdmin) {
        const selCollegeId = localStorage.getItem('superadmin_selectedCollegeId');
        if (selCollegeId) url += `?collegeId=${selCollegeId}`;
      }
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) setSchedules(res.data.data);
    } catch {
      toast.error(isAr ? 'فشل تحميل الجدول الدراسي' : 'Failed to fetch schedules');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      let url = `${API_URL}/api/groups`;
      if (isSuperAdmin) {
        const selCollegeId = localStorage.getItem('superadmin_selectedCollegeId');
        if (selCollegeId) url += `?collegeId=${selCollegeId}`;
      }
      const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) setGroups(res.data.data);
    } catch {}
  };

  const fetchRoomsList = async () => {
    setRoomsLoading(true);
    try {
      let url = `${API_URL}/api/rooms`;
      if (isSuperAdmin) {
        const selCollegeId = localStorage.getItem('superadmin_selectedCollegeId');
        if (selCollegeId) url += `?collegeId=${selCollegeId}`;
      }
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setRoomsList(res.data.data);
      }
    } catch (err) {
      console.error(err);
      toast.error(isAr ? 'فشل تحميل القاعات' : 'Failed to load classrooms');
    } finally {
      setRoomsLoading(false);
    }
  };

  useEffect(() => {
    if (isRoomModalOpen) {
      fetchRoomsList();
    }
  }, [isRoomModalOpen]);

  // ── Actions ──────────────────────────────────────────────────────────
  const handleResolveReschedule = async (id, status, overrideType = 'TEMPORARY', customDate = null, notes = '') => {
    setResolvingId(id);
    try {
      const todayStr = customDate || new Date().toISOString().substring(0, 10);
      const payload = {
        status,
        overrideType,
        date: todayStr,
        adminNotes: notes || (isAr ? 'تمت المعالجة من لوحة الإدارة' : 'Processed from admin panel')
      };
      const res = await axios.post(`${API_URL}/api/admin/requests/${id}/resolve`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        toast.success(isAr ? 'تم تحديث حالة طلب المحاضر بنجاح' : 'Lecturer request processed successfully');
        fetchRescheduleRequests();
        fetchMetrics();
      }
    } catch {
      toast.error(isAr ? 'فشل معالجة الطلب' : 'Failed to process request');
    } finally {
      setResolvingId(null);
    }
  };

  const handleApproveStudent = async (studentId) => {
    setApprovingId(studentId);
    try {
      const res = await axios.post(`${API_URL}/api/admin/students/${studentId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        toast.success(isAr ? 'تم توثيق وتنشيط حساب الطالب بنجاح!' : 'Student account verified and approved successfully!');
        setUnverifiedStudents(prev => {
          const updated = prev.filter(s => s.id !== studentId);
          setSelectedStudent(updated.length > 0 ? updated[0] : null);
          return updated;
        });
        fetchMetrics();
      }
    } catch {
      toast.error(isAr ? 'فشل توثيق الحساب' : 'Failed to approve student account');
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectStudent = async (studentId) => {
    setRejectingId(studentId);
    try {
      const res = await axios.post(`${API_URL}/api/admin/students/${studentId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        toast.success(isAr ? 'تم حذف ورفض طلب التسجيل' : 'Registration request rejected and deleted.');
        setUnverifiedStudents(prev => {
          const updated = prev.filter(s => s.id !== studentId);
          setSelectedStudent(updated.length > 0 ? updated[0] : null);
          return updated;
        });
        fetchMetrics();
      }
    } catch {
      toast.error(isAr ? 'فشل رفض الحساب' : 'Failed to reject student account');
    } finally {
      setRejectingId(null);
    }
  };

  // ── Drag & Drop Kanban Handlers ──────────────────────────────────────
  const handleDragStart = (e, schedule) => {
    setDraggedSchedule(schedule);
    e.dataTransfer.setData('scheduleId', schedule.id.toString());
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetDay) => {
    e.preventDefault();
    const scheduleIdStr = e.dataTransfer.getData('scheduleId');
    const scheduleId = parseInt(scheduleIdStr);
    if (!scheduleId || !draggedSchedule) return;

    const currentDay = getActiveDay(draggedSchedule);
    if (currentDay === targetDay) {
      setDraggedSchedule(null);
      return;
    }

    const start = getActiveStartTime(draggedSchedule);
    const end = getActiveEndTime(draggedSchedule);

    setOverrideConfirmData({
      scheduleId,
      targetDay,
      targetStart: start,
      targetEnd: end
    });
  };

  const getTargetDateString = (dayName) => {
    const daysMap = { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3, THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 };
    const targetIndex = daysMap[dayName];
    const now = new Date();
    const currentDayIndex = now.getDay();
    const diff = targetIndex - currentDayIndex;
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + diff);
    return targetDate.toISOString().split('T')[0];
  };

  const executeOverride = async (overrideType) => {
    if (!overrideConfirmData) return;
    const { scheduleId, targetDay, targetStart, targetEnd } = overrideConfirmData;
    const targetDate = getTargetDateString(targetDay);
    const payload = {
      scheduleId,
      newStartTime: targetStart,
      newEndTime: targetEnd,
      date: targetDate,
      overrideType,
    };

    setOverrideConfirmData(null);
    setDraggedSchedule(null);

    try {
      const res = await axios.post(`${API_URL}/api/schedules/override`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        toast.success(isAr ? 'تم تعديل ميعاد المحاضرة بنجاح!' : `Successfully moved lecture to ${targetDay}!`);
        fetchSchedules();
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || (isAr ? 'حدث تعارض في القاعات أو المحاضر' : 'Scheduling Conflict Detected.');
      toast.error(errMsg);
    }
  };

  const handleAddSchedule = async (e) => {
    e.preventDefault();
    const slot = TIME_SLOTS[parseInt(newScheduleForm.timeSlotIndex)];
    const payload = {
      subjectName: newScheduleForm.subjectName,
      subjectCode: newScheduleForm.subjectCode,
      subjectType: newScheduleForm.subjectType,
      roomName: newScheduleForm.roomName,
      roomCapacity: parseInt(newScheduleForm.roomCapacity) || 45,
      lecturerId: newScheduleForm.lecturerId ? parseInt(newScheduleForm.lecturerId) : undefined,
      lecturerName: newScheduleForm.lecturerName,
      groupName: newScheduleForm.groupName,
      dayOfWeek: newScheduleForm.dayOfWeek,
      startTime: slot.start,
      endTime: slot.end
    };

    try {
      const res = await axios.post(`${API_URL}/api/schedules`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        toast.success(isAr ? 'تمت إضافة المحاضرة للجدول بنجاح' : 'Schedule added successfully');
        setIsAddScheduleOpen(false);
        fetchSchedules();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل إضافة المحاضرة' : 'Failed to add schedule'));
    }
  };

  const handleOpenEdit = (sched) => {
    setEditingSchedule(sched);
    const slotIndex = TIME_SLOTS.findIndex(slot => slot.start === sched.startTime);
    setEditScheduleForm({
      subjectName: sched.subject?.name || '',
      subjectCode: sched.subject?.code || '',
      subjectType: sched.subject?.type || 'THEORY',
      roomName: sched.room?.name || '',
      roomCapacity: String(sched.room?.capacity || 45),
      lecturerId: sched.lecturerId ? String(sched.lecturerId) : '',
      lecturerName: sched.lecturerName || '',
      groupName: sched.group?.name || '',
      dayOfWeek: sched.dayOfWeek || 'SUNDAY',
      timeSlotIndex: String(slotIndex !== -1 ? slotIndex : 0)
    });
    setIsEditScheduleOpen(true);
  };

  const handleEditSchedule = async (e) => {
    e.preventDefault();
    if (!editingSchedule) return;

    const slot = TIME_SLOTS[parseInt(editScheduleForm.timeSlotIndex)];
    const payload = {
      subjectName: editScheduleForm.subjectName,
      subjectCode: editScheduleForm.subjectCode,
      subjectType: editScheduleForm.subjectType,
      roomName: editScheduleForm.roomName,
      roomCapacity: parseInt(editScheduleForm.roomCapacity) || 45,
      lecturerId: editScheduleForm.lecturerId ? parseInt(editScheduleForm.lecturerId) : undefined,
      lecturerName: editScheduleForm.lecturerName,
      groupName: editScheduleForm.groupName,
      dayOfWeek: editScheduleForm.dayOfWeek,
      startTime: slot.start,
      endTime: slot.end
    };

    try {
      const res = await axios.put(`${API_URL}/api/schedules/${editingSchedule.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        toast.success(isAr ? 'تم تعديل المحاضرة بنجاح' : 'Schedule updated successfully');
        setIsEditScheduleOpen(false);
        setEditingSchedule(null);
        fetchSchedules();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل تعديل المحاضرة' : 'Failed to update schedule'));
    }
  };

  const handleDeleteSchedule = async () => {
    if (!editingSchedule) return;
    if (!window.confirm(isAr ? 'هل أنت متأكد من حذف هذه المحاضرة نهائياً؟' : 'Are you sure you want to delete this schedule entry permanently?')) return;

    try {
      const res = await axios.delete(`${API_URL}/api/schedules/${editingSchedule.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        toast.success(isAr ? 'تم حذف المحاضرة بنجاح' : 'Schedule deleted successfully');
        setIsEditScheduleOpen(false);
        setEditingSchedule(null);
        fetchSchedules();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل حذف المحاضرة' : 'Failed to delete schedule'));
    }
  };

  // ── Dispatch Broadcast Handlers ──────────────────────────────────────
  const handleSendBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastMessage.trim()) return;

    setBroadcastLoading(true);
    const payload = {
      groupId: broadcastTarget,
      message: `${broadcastPriority === 'urgent' ? '🚨 [عاجل] ' : '📢 '}${broadcastMessage}`
    };

    if (isSuperAdmin) {
      const selCollegeId = localStorage.getItem('superadmin_selectedCollegeId');
      if (selCollegeId) payload.collegeId = parseInt(selCollegeId);
    }

    try {
      const res = await axios.post(`${API_URL}/api/broadcasts`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        toast.success(isAr ? 'تم إرسال البث لجميع المستهدفين بنجاح!' : 'Broadcast announcement dispatched successfully!');
        setBroadcastMessage('');
      }
    } catch {
      toast.error(isAr ? 'فشل إرسال البث العام' : 'Failed to deploy broadcast');
    } finally {
      setBroadcastLoading(false);
    }
  };

  // ── Cascading derived option lists for the schedule Kanban filter ───────────
  // groups[] comes from /api/groups which includes major & level relations
  const schedMajors = Array.from(
    new Map(groups.map(g => [g.major?.id, g.major]).filter(([id]) => id)).values()
  );
  const schedLevels = Array.from(
    new Map(
      groups
        .filter(g => schedMajor === 'ALL' || String(g.major?.id) === schedMajor)
        .map(g => [g.level?.id, g.level])
        .filter(([id]) => id)
    ).values()
  );
  const schedGroups = groups.filter(g =>
    (schedMajor === 'ALL' || String(g.major?.id) === schedMajor) &&
    (schedLevel === 'ALL' || String(g.level?.id) === schedLevel)
  );

  // Filter schedules: apply all three levels hierarchically
  const filteredSchedules = schedules.filter(s => {
    const grp = groups.find(g => String(g.id) === String(s.groupId));
    if (!grp) return false;

    const matchesMajor = schedMajor === 'ALL' || String(grp.major?.id) === schedMajor;
    const matchesLevel = schedLevel === 'ALL' || String(grp.level?.id) === schedLevel;
    const matchesGroup = schedGroup === 'ALL' || String(s.groupId) === schedGroup;

    return matchesMajor && matchesLevel && matchesGroup;
  });

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-900 text-slate-100 flex-1 flex flex-col font-urbanist select-none">
      
      {/* ── MAIN CONTENT AREA ─────────────────────────────────────────── */}
      <main className="flex-1 bg-slate-900 p-8 overflow-y-auto max-h-screen">
        
        {/* Header toolbar */}
        <header className="flex justify-between items-center pb-6 border-b border-slate-800 mb-8">
          <div>
            <h2 className="text-xl font-extrabold text-white tracking-tight uppercase">
              {activeTab === 'overview' && (isAr ? 'نظرة عامة على الكلية' : 'College Overview')}
              {activeTab === 'approvals' && (isAr ? 'توثيق وتفعيل الطلاب الجدد' : 'Student Identity Verifications')}
              {activeTab === 'schedule' && (isAr ? 'لوحة جدولة المحاضرات' : 'Lecture Scheduling Board')}
              {activeTab === 'broadcast' && (isAr ? 'مركز الاتصالات والبث العام' : 'Public Communications Hub')}
              {activeTab === 'bulkImport' && (isAr ? 'رفع البيانات الجماعية عبر Excel' : 'Bulk Data Import via Excel')}
              {activeTab === 'lecturers' && (isAr ? 'إدارة هيئة التدريس' : 'Lecturers')}
            </h2>
            <p className="text-xs text-slate-400 font-bold mt-1">
              {activeTab === 'overview' && (isAr ? 'إحصائيات فورية وطلبات المحاضرين المعلقة.' : 'Live college stats, and lecturer request queue.')}
              {activeTab === 'approvals' && (isAr ? 'مراجعة وتفعيل الحسابات المعلقة والمطالبة بالتوثيق.' : 'Review ID photo credentials and activate pending student profiles.')}
              {activeTab === 'schedule' && (isAr ? 'اسحب كارت المحاضرة وأفلتها لتغيير اليوم أو الموعد بشكل فوري.' : 'Drag lectures between days to deploy instant timetable updates.')}
              {activeTab === 'broadcast' && (isAr ? 'أرسل إعلاناً موجهاً فورياً لكل الدفعة أو لشعبة معينة.' : 'Compose and dispatch instant announcements to targeted student audiences.')}
              {activeTab === 'bulkImport' && (isAr ? 'ارفع ملف Excel لاستيراد الطلاب أو الجداول أو الاختبارات دفعةً واحدة.' : 'Upload an Excel file to import students, schedules, or exams in one shot.')}
              {activeTab === 'lecturers' && (isAr ? 'إدارة حسابات أعضاء هيئة التدريس وربطهم.' : 'Manage lecturer accounts and assign them to colleges.')}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700/80 text-[10px] font-black uppercase text-slate-300">
              🔑 {user?.name} ({user?.role})
            </span>
          </div>
        </header>

        {/* ── TAB VIEWS CONTENT ───────────────────────────────────────── */}
        
        {activeTab === 'overview' && (
          <OverviewTab
            isAr={isAr}
            metrics={metrics}
            analytics={analytics}
            analyticsLoading={analyticsLoading}
            rescheduleRequests={rescheduleRequests}
            requestsLoading={requestsLoading}
            resolvingId={resolvingId}
            noteMap={noteMap}
            setNoteMap={setNoteMap}
            dateMap={dateMap}
            setDateMap={setDateMap}
            token={token}
            fetchMetrics={fetchMetrics}
            fetchRescheduleRequests={fetchRescheduleRequests}
            fetchAnalytics={fetchAnalytics}
            isSuperAdmin={isSuperAdmin}
          />
        )}

        {activeTab === 'approvals' && (
          <ApprovalsTab
            isAr={isAr}
            loading={loading}
            unverifiedStudents={unverifiedStudents}
            selectedStudent={selectedStudent}
            setSelectedStudent={setSelectedStudent}
            approvingId={approvingId}
            rejectingId={rejectingId}
            handleApproveStudent={async (id) => {
              setApprovingId(id);
              try {
                const res = await axios.post(`${API_URL}/api/admin/verify-student/${id}`, {}, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data?.success) {
                  toast.success(isAr ? 'تم توثيق الطالب وتفعيل حسابه' : 'Student verified and activated successfully');
                  fetchUnverifiedStudents();
                }
              } catch (err) {
                toast.error(err.response?.data?.error || (isAr ? 'فشل توثيق الطالب' : 'Failed to verify student'));
              } finally {
                setApprovingId(null);
              }
            }}
            handleRejectStudent={async (id) => {
              setRejectingId(id);
              try {
                const res = await axios.delete(`${API_URL}/api/admin/reject-student/${id}`, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data?.success) {
                  toast.success(isAr ? 'تم رفض وحذف الحساب بنجاح' : 'Student registration rejected and deleted');
                  fetchUnverifiedStudents();
                }
              } catch (err) {
                toast.error(err.response?.data?.error || (isAr ? 'فشل إجراء الرفض' : 'Failed to reject registration'));
              } finally {
                setRejectingId(null);
              }
            }}
          />
        )}

        {activeTab === 'schedule' && (
          <ScheduleTab
            isAr={isAr}
            loading={loading}
            schedules={schedules}
            groups={groups}
            isRoomModalOpen={isRoomModalOpen}
            setIsRoomModalOpen={setIsRoomModalOpen}
            roomsList={roomsList}
            roomsLoading={roomsLoading}
            roomSearchQuery={roomSearchQuery}
            setRoomSearchQuery={setRoomSearchQuery}
            schedMajor={schedMajor}
            setSchedMajor={setSchedMajor}
            schedLevel={schedLevel}
            setSchedLevel={setSchedLevel}
            schedGroup={schedGroup}
            setSchedGroup={setSchedGroup}
            filteredSchedules={filteredSchedules}
            handleDragStart={handleDragStart}
            handleDragOver={handleDragOver}
            handleDrop={handleDrop}
            overrideConfirmData={overrideConfirmData}
            setOverrideConfirmData={setOverrideConfirmData}
            executeOverride={executeOverride}
            isAddScheduleOpen={isAddScheduleOpen}
            setIsAddScheduleOpen={setIsAddScheduleOpen}
            newScheduleForm={newScheduleForm}
            setNewScheduleForm={setNewScheduleForm}
            handleAddSchedule={handleAddSchedule}
            isEditScheduleOpen={isEditScheduleOpen}
            setIsEditScheduleOpen={setIsEditScheduleOpen}
            editingSchedule={editingSchedule}
            setEditingSchedule={setEditingSchedule}
            editScheduleForm={editScheduleForm}
            setEditScheduleForm={setEditScheduleForm}
            handleOpenEdit={handleOpenEdit}
            handleEditSchedule={handleEditSchedule}
            handleDeleteSchedule={handleDeleteSchedule}
            token={token}
            fetchSchedules={fetchSchedules}
            fetchRoomsList={fetchRoomsList}
            isSuperAdmin={isSuperAdmin}
            DAYS={DAYS}
            TIME_SLOTS={TIME_SLOTS}
            getActiveDay={getActiveDay}
            getActiveStartTime={getActiveStartTime}
            getActiveEndTime={getActiveEndTime}
            translateDay={translateDay}
          />
        )}

        {activeTab === 'broadcast' && (
          <BroadcastTab
            isAr={isAr}
            groups={groups}
            broadcastTarget={broadcastTarget}
            setBroadcastTarget={setBroadcastTarget}
            broadcastMessage={broadcastMessage}
            setBroadcastMessage={setBroadcastMessage}
            broadcastPriority={broadcastPriority}
            setBroadcastPriority={setBroadcastPriority}
            broadcastLoading={broadcastLoading}
            handleSendBroadcast={async (e) => {
              e.preventDefault();
              if (!broadcastMessage.trim()) return;
              setBroadcastLoading(true);
              try {
                const payload = {
                  target: broadcastTarget,
                  message: broadcastMessage,
                  priority: broadcastPriority
                };
                if (isSuperAdmin) {
                  const selCollegeId = localStorage.getItem('superadmin_selectedCollegeId');
                  if (selCollegeId) payload.collegeId = parseInt(selCollegeId);
                }
                const res = await axios.post(`${API_URL}/api/admin/broadcast`, payload, {
                  headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data?.success) {
                  toast.success(isAr ? 'تم إرسال البث للجمهور المستهدف بنجاح!' : 'Broadcast dispatched successfully!');
                  setBroadcastMessage('');
                }
              } catch (err) {
                toast.error(err.response?.data?.error || (isAr ? 'فشل إرسال البث' : 'Failed to dispatch broadcast'));
              } finally {
                setBroadcastLoading(false);
              }
            }}
          />
        )}

        {activeTab === 'bulkImport' && (
          <BulkImportTab
            isAr={isAr}
            bulkUploadType={bulkUploadType}
            setBulkUploadType={setBulkUploadType}
            bulkFile={bulkFile}
            setBulkFile={setBulkFile}
            bulkFileName={bulkFileName}
            setBulkFileName={setBulkFileName}
            bulkDragging={bulkDragging}
            setBulkDragging={setBulkDragging}
            bulkLoading={bulkLoading}
            setBulkLoading={setBulkLoading}
            bulkResult={bulkResult}
            setBulkResult={setBulkResult}
            token={token}
            isSuperAdmin={isSuperAdmin}
            API_URL={API_URL}
          />
        )}

        {activeTab === 'exams' && (
          <ExamsTab
            isAr={isAr}
            exams={exams}
            examsLoading={examsLoading}
            fetchExams={fetchExams}
            token={token}
            isSuperAdmin={isSuperAdmin}
          />
        )}

        {activeTab === 'lecturers' && (
          <LecturersTab
            isAr={isAr}
            token={token}
            isSuperAdmin={isSuperAdmin}
          />
        )}

      </main>

      {/* ── Add Exam Modal ─────────────────────────────────────── */}
      <AnimatePresence>
        {isAddExamOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl w-full max-w-lg space-y-6 text-white max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-amber-400">
                  📝 {isAr ? 'إضافة امتحان للجدول' : 'Schedule New Exam'}
                </h3>
                <button onClick={() => setIsAddExamOpen(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                setExamSubmitting(true);
                try {
                  const payload = { ...newExamForm };
                  if (isSuperAdmin) {
                    const selCollegeId = localStorage.getItem('superadmin_selectedCollegeId');
                    if (selCollegeId) payload.collegeId = parseInt(selCollegeId);
                  }
                  const res = await axios.post(`${API_URL}/api/exams`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  if (res.data?.success) {
                    toast.success(isAr ? 'تمت إضافة الامتحان بنجاح' : 'Exam added successfully');
                    setIsAddExamOpen(false);
                    fetchExams();
                    setNewExamForm({ subjectName: '', subjectCode: '', roomName: '', groupName: '', examDate: '', startTime: '08:00', endTime: '10:00', notes: '' });
                  }
                } catch (err) {
                  toast.error(err.response?.data?.error || (isAr ? 'فشل إضافة الامتحان' : 'Failed to add exam'));
                } finally {
                  setExamSubmitting(false);
                }
              }} className="space-y-4 text-xs font-bold">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { key: 'subjectName', label: isAr ? 'اسم المادة' : 'Subject Name', placeholder: isAr ? 'مثال: الجبر الخطي' : 'e.g. Linear Algebra', required: true },
                    { key: 'subjectCode', label: isAr ? 'رمز المادة' : 'Subject Code', placeholder: 'e.g. MATH-201', required: false },
                    { key: 'roomName', label: isAr ? 'القاعة / القاعات' : 'Room(s)', placeholder: isAr ? 'مثال: قاعة A1' : 'e.g. Hall A1', required: true },
                    { key: 'groupName', label: isAr ? 'الشعبة' : 'Group', placeholder: isAr ? 'مثال: شعبة أ' : 'e.g. Group A', required: true },
                  ].map(f => (
                    <div key={f.key} className="space-y-1">
                      <label className="text-slate-400">{f.label}</label>
                      <input
                        type="text"
                        required={f.required}
                        value={newExamForm[f.key]}
                        onChange={e => setNewExamForm({...newExamForm, [f.key]: e.target.value})}
                        placeholder={f.placeholder}
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  ))}
                  <div className="space-y-1">
                    <label className="text-slate-400">{isAr ? 'تاريخ الامتحان' : 'Exam Date'}</label>
                    <input
                      type="date"
                      required
                      value={newExamForm.examDate}
                      onChange={e => setNewExamForm({...newExamForm, examDate: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">{isAr ? 'وقت البدء' : 'Start Time'}</label>
                    <input
                      type="time"
                      required
                      value={newExamForm.startTime}
                      onChange={e => setNewExamForm({...newExamForm, startTime: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">{isAr ? 'وقت الانتهاء' : 'End Time'}</label>
                    <input
                      type="time"
                      required
                      value={newExamForm.endTime}
                      onChange={e => setNewExamForm({...newExamForm, endTime: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-slate-400">{isAr ? 'ملاحظات (اختياري)' : 'Notes (optional)'}</label>
                    <textarea
                      rows={2}
                      value={newExamForm.notes}
                      onChange={e => setNewExamForm({...newExamForm, notes: e.target.value})}
                      placeholder={isAr ? 'أي تعليمات خاصة بالامتحان...' : 'Any special exam instructions...'}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-amber-400 text-xs"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                  <button type="button" onClick={() => setIsAddExamOpen(false)} className="px-5 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs text-white">
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button type="submit" disabled={examSubmitting} className="px-6 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-black active:scale-95 transition-all flex items-center gap-2">
                    {examSubmitting ? <span className="h-3.5 w-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" /> : null}
                    {isAr ? 'حفظ الامتحان' : 'Save Exam'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Drag & Drop Override Confirmation Popup Modal ────────────── */}
      <ConfirmationModal
        isOpen={overrideConfirmData !== null}
        title={isAr ? 'تأكيد تعديل ميعاد المحاضرة' : 'Confirm Lecture Override'}
        message={
          isAr 
            ? 'هل ترغب في تطبيق هذا التعديل بصفة دائمة على مدار الفصل الدراسي بأكمله، أم كاستثناء مؤقت لهذا الأسبوع فقط؟'
            : 'Do you want to apply this schedule change as a Permanent rule, or as a Temporary exception for this week only?'
        }
        onConfirm={() => executeOverride('PERMANENT')}
        onCancel={() => executeOverride('TEMPORARY')}
        confirmText={isAr ? 'تعديل دائم' : 'Permanent'}
        cancelText={isAr ? 'استثناء مؤقت' : 'Temporary'}
        showClose={true}
        onClose={() => setOverrideConfirmData(null)}
      />

      {/* ── Add New Lecture Schedule Modal ───────────────────────────── */}
      <AnimatePresence>
        {isAddScheduleOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl w-full max-w-lg space-y-6 text-white"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-cyan-400">
                  📅 {isAr ? 'إضافة محاضرة جديدة للجدول' : 'Add New Schedule Entry'}
                </h3>
                <button
                  onClick={() => setIsAddScheduleOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors text-lg leading-none"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddSchedule} className="space-y-4 text-xs font-bold">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-400">{isAr ? 'اسم المادة' : 'Subject Name'}</label>
                    <input
                      type="text"
                      required
                      value={newScheduleForm.subjectName}
                      onChange={e => setNewScheduleForm({...newScheduleForm, subjectName: e.target.value})}
                      placeholder="e.g. Artificial Intelligence"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">{isAr ? 'رمز المادة' : 'Subject Code'}</label>
                    <input
                      type="text"
                      required
                      value={newScheduleForm.subjectCode}
                      onChange={e => setNewScheduleForm({...newScheduleForm, subjectCode: e.target.value})}
                      placeholder="e.g. CS-404"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">{isAr ? 'نوع المحاضرة' : 'Type'}</label>
                    <select
                      value={newScheduleForm.subjectType}
                      onChange={e => setNewScheduleForm({...newScheduleForm, subjectType: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-400"
                    >
                      <option value="THEORY">{isAr ? 'نظري' : 'THEORY'}</option>
                      <option value="PRACTICAL">{isAr ? 'عملي (معمل)' : 'PRACTICAL'}</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">{isAr ? 'اسم القاعة' : 'Room Name'}</label>
                    <input
                      type="text"
                      required
                      value={newScheduleForm.roomName}
                      onChange={e => setNewScheduleForm({...newScheduleForm, roomName: e.target.value})}
                      placeholder="e.g. Hall A2"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">{isAr ? 'سعة القاعة' : 'Room Capacity'}</label>
                    <input
                      type="number"
                      required
                      value={newScheduleForm.roomCapacity}
                      onChange={e => setNewScheduleForm({...newScheduleForm, roomCapacity: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">{isAr ? 'المحاضر' : 'Lecturer'}</label>
                    <input
                      type="text"
                      required
                      value={newScheduleForm.lecturerName}
                      onChange={e => setNewScheduleForm({...newScheduleForm, lecturerName: e.target.value})}
                      placeholder="e.g. Dr. Kordi"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">{isAr ? 'الشعبة' : 'Group'}</label>
                    <input
                      type="text"
                      required
                      value={newScheduleForm.groupName}
                      onChange={e => setNewScheduleForm({...newScheduleForm, groupName: e.target.value})}
                      placeholder="e.g. Group A"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">{isAr ? 'اليوم الدراسي' : 'Day'}</label>
                    <select
                      value={newScheduleForm.dayOfWeek}
                      onChange={e => setNewScheduleForm({...newScheduleForm, dayOfWeek: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-400"
                    >
                      {DAYS.map(day => (
                        <option key={day} value={day}>{translateDay(day)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-slate-400">{isAr ? 'الفترة الزمنية' : 'Time Slot'}</label>
                    <select
                      value={newScheduleForm.timeSlotIndex}
                      onChange={e => setNewScheduleForm({...newScheduleForm, timeSlotIndex: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-400"
                    >
                      {TIME_SLOTS.map((slot, idx) => (
                        <option key={idx} value={idx}>{slot.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsAddScheduleOpen(false)}
                    className="px-5 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs text-white"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-black active:scale-95 transition-transform"
                  >
                    {isAr ? 'حفظ الحصة' : 'Create Entry'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Edit Existing Lecture Schedule Modal ────────────────────────── */}
      <AnimatePresence>
        {isEditScheduleOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl w-full max-w-lg space-y-6 text-white"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black uppercase tracking-wider text-cyan-400">
                  📅 {isAr ? 'تعديل المحاضرة في الجدول' : 'Edit Schedule Entry'}
                </h3>
                <button
                  onClick={() => { setIsEditScheduleOpen(false); setEditingSchedule(null); }}
                  className="text-slate-400 hover:text-white transition-colors text-lg leading-none"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleEditSchedule} className="space-y-4 text-xs font-bold">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-slate-400">{isAr ? 'اسم المادة' : 'Subject Name'}</label>
                    <input
                      type="text"
                      required
                      value={editScheduleForm.subjectName}
                      onChange={e => setEditScheduleForm({...editScheduleForm, subjectName: e.target.value})}
                      placeholder="e.g. Artificial Intelligence"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">{isAr ? 'رمز المادة' : 'Subject Code'}</label>
                    <input
                      type="text"
                      required
                      value={editScheduleForm.subjectCode}
                      onChange={e => setEditScheduleForm({...editScheduleForm, subjectCode: e.target.value})}
                      placeholder="e.g. CS-404"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">{isAr ? 'نوع المحاضرة' : 'Type'}</label>
                    <select
                      value={editScheduleForm.subjectType}
                      onChange={e => setEditScheduleForm({...editScheduleForm, subjectType: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-400"
                    >
                      <option value="THEORY">{isAr ? 'نظري' : 'THEORY'}</option>
                      <option value="PRACTICAL">{isAr ? 'عملي (معمل)' : 'PRACTICAL'}</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">{isAr ? 'اسم القاعة' : 'Room Name'}</label>
                    <input
                      type="text"
                      required
                      value={editScheduleForm.roomName}
                      onChange={e => setEditScheduleForm({...editScheduleForm, roomName: e.target.value})}
                      placeholder="e.g. Hall A2"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">{isAr ? 'سعة القاعة' : 'Room Capacity'}</label>
                    <input
                      type="number"
                      required
                      value={editScheduleForm.roomCapacity}
                      onChange={e => setEditScheduleForm({...editScheduleForm, roomCapacity: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">{isAr ? 'المحاضر' : 'Lecturer'}</label>
                    <input
                      type="text"
                      required
                      value={editScheduleForm.lecturerName}
                      onChange={e => setEditScheduleForm({...editScheduleForm, lecturerName: e.target.value})}
                      placeholder="e.g. Dr. Kordi"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">{isAr ? 'الشعبة' : 'Group'}</label>
                    <input
                      type="text"
                      required
                      value={editScheduleForm.groupName}
                      onChange={e => setEditScheduleForm({...editScheduleForm, groupName: e.target.value})}
                      placeholder="e.g. Group A"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-400">{isAr ? 'اليوم الدراسي' : 'Day'}</label>
                    <select
                      value={editScheduleForm.dayOfWeek}
                      onChange={e => setEditScheduleForm({...editScheduleForm, dayOfWeek: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-400"
                    >
                      {DAYS.map(day => (
                        <option key={day} value={day}>{translateDay(day)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-slate-400">{isAr ? 'الفترة الزمنية' : 'Time Slot'}</label>
                    <select
                      value={editScheduleForm.timeSlotIndex}
                      onChange={e => setEditScheduleForm({...editScheduleForm, timeSlotIndex: e.target.value})}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-400"
                    >
                      {TIME_SLOTS.map((slot, idx) => (
                        <option key={idx} value={idx}>{slot.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-slate-800 gap-3">
                  <button
                    type="button"
                    onClick={handleDeleteSchedule}
                    className="px-5 py-2 bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-white rounded-xl text-xs font-black transition-colors"
                  >
                    🗑️ {isAr ? 'حذف المحاضرة' : 'Delete Entry'}
                  </button>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => { setIsEditScheduleOpen(false); setEditingSchedule(null); }}
                      className="px-5 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs text-white"
                    >
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-xs font-black active:scale-95 transition-transform"
                    >
                      {isAr ? 'حفظ التعديل' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Classroom Occupancy Modal ─────────────────────────────── */}
      <AnimatePresence>
        {isRoomModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="bg-slate-950/95 border border-slate-800/80 rounded-3xl p-6 shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col text-white"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-start border-b border-slate-800 pb-4 mb-4 shrink-0">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
                    🏢 {isAr ? 'القاعات والمختبرات النشطة' : 'Active Halls & Classrooms'}
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {isAr
                      ? 'مراقبة فورية للسعة الاستيعابية ومستوى إشغال المحاضرات اليومي.'
                      : 'Live tracking of capacity boundaries and active lecture sessions.'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsRoomModalOpen(false);
                    setRoomSearchQuery('');
                  }}
                  className="text-slate-400 hover:text-white text-lg p-1 hover:bg-white/5 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Stats & Search Toolbar */}
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 mb-6 shrink-0 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/50">
                {/* Stats */}
                <div className="flex items-center gap-6 text-[11px] font-black">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">{isAr ? 'إجمالي القاعات:' : 'Total Rooms:'}</span>
                    <span className="text-white text-sm">{roomsList.length}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">{isAr ? 'قيد الاستخدام:' : 'In Use Now:'}</span>
                    <span className="text-amber-400 text-sm">
                      {(() => {
                        const daysMap = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
                        const currentDay = daysMap[new Date().getDay()];
                        const now = new Date();
                        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                        return roomsList.filter(room =>
                          schedules.some(s =>
                            (s.roomId === room.id || s.room?.id === room.id) &&
                            s.dayOfWeek === currentDay &&
                            timeStr >= s.startTime &&
                            timeStr <= s.endTime
                          )
                        ).length;
                      })()}
                    </span>
                  </div>
                </div>

                {/* Search input */}
                <div className="relative flex-1 sm:max-w-xs">
                  <input
                    type="text"
                    placeholder={isAr ? 'ابحث عن قاعة أو مختبر...' : 'Search hall or lab...'}
                    value={roomSearchQuery}
                    onChange={(e) => setRoomSearchQuery(e.target.value)}
                    className="cmd-input w-full px-3.5 py-2 text-xs"
                    style={{ minHeight: '38px', height: '38px' }}
                  />
                  {roomSearchQuery && (
                    <button
                      onClick={() => setRoomSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Classrooms Cards Grid */}
              <div className="flex-1 overflow-y-auto pr-1 -mr-1 space-y-4">
                {roomsLoading ? (
                  <div className="flex flex-col justify-center items-center py-20 gap-3">
                    <span className="h-8 w-8 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">
                      {isAr ? 'جاري جلب القاعات من قاعدة البيانات...' : 'Fetching rooms from vault...'}
                    </p>
                  </div>
                ) : (() => {
                  const filteredRooms = roomsList.filter(room =>
                    room.name.toLowerCase().includes(roomSearchQuery.toLowerCase())
                  );

                  if (filteredRooms.length === 0) {
                    return (
                      <div className="py-16 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl">
                        <span className="text-4xl block mb-3">🏢</span>
                        <p className="text-xs font-black">
                          {isAr ? 'لم يتم العثور على قاعات تطابق بحثك.' : 'No rooms match your search query.'}
                        </p>
                      </div>
                    );
                  }

                  const daysMap = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
                  const currentDay = daysMap[new Date().getDay()];
                  const now = new Date();
                  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredRooms.map(room => {
                        const roomSchedules = schedules.filter(s => s.roomId === room.id || s.room?.id === room.id);
                        
                        // Check if a lecture is active now
                        const activeLecture = roomSchedules.find(s =>
                          s.dayOfWeek === currentDay &&
                          timeStr >= s.startTime &&
                          timeStr <= s.endTime
                        );

                        // Calculate total weekly hours scheduled in this room
                        const weeklyLecturesCount = roomSchedules.length;

                        return (
                          <div
                            key={room.id}
                            className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex flex-col justify-between gap-4 hover:border-cyan-400/20 transition-all duration-300 relative group"
                          >
                            {/* Card Header */}
                            <div>
                              <div className="flex justify-between items-start">
                                <h4 className="font-extrabold text-sm text-white flex items-center gap-1.5">
                                  🏛️ {room.name}
                                </h4>
                                {activeLecture ? (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[9px] font-black uppercase tracking-wider animate-glow-expand">
                                    {isAr ? '🔴 مشغول الآن' : '🔴 IN USE NOW'}
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[9px] font-black uppercase tracking-wider">
                                    {isAr ? '🟢 متاح' : '🟢 FREE'}
                                  </span>
                                )}
                              </div>

                              {/* Capacity */}
                              <div className="mt-3 space-y-1">
                                <div className="flex justify-between items-center text-[9px] font-black text-slate-500 uppercase">
                                  <span>{isAr ? 'السعة الاستيعابية:' : 'Capacity Limit:'}</span>
                                  <span className="text-slate-300">{room.capacity} {isAr ? 'طالب' : 'Students'}</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-850 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-cyan-500 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(Math.round((room.capacity / 120) * 100), 100)}%` }}
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Active Lecture Details or Status */}
                            {activeLecture ? (
                              <div className="p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl space-y-1">
                                <p className="text-[10px] font-black text-amber-400 uppercase tracking-wide">
                                  {isAr ? 'المحاضرة الحالية:' : 'Active Lecture:'}
                                </p>
                                <p className="text-xs font-black text-white truncate" title={activeLecture.subject?.name}>
                                  {activeLecture.subject?.name}
                                </p>
                                <p className="text-[10px] text-slate-400 font-bold">
                                  {activeLecture.group?.name} · {activeLecture.startTime} - {activeLecture.endTime}
                                </p>
                              </div>
                            ) : (
                              <div className="p-3 bg-slate-950/40 border border-slate-900 rounded-xl text-center text-[10px] text-slate-500 font-bold">
                                {isAr ? 'لا توجد محاضرات جارية حالياً.' : 'No active session at the moment.'}
                              </div>
                            )}

                            {/* Today's Timetable / Weekly stats footer */}
                            <div className="flex justify-between items-center border-t border-slate-900 pt-3 text-[9px] text-slate-500 font-bold">
                              <span>📅 {weeklyLecturesCount} {isAr ? 'محاضرات بالأسبوع' : 'lectures / week'}</span>
                              <span className="text-cyan-400 hover:underline cursor-pointer" onClick={() => {
                                setIsRoomModalOpen(false);
                                setSchedMajor('ALL');
                                setSchedLevel('ALL');
                                setSchedGroup('ALL');
                                setActiveTab('schedule');
                              }}>
                                {isAr ? 'عرض الجدول' : 'View Timetable'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Logout Confirmation Modal ─────────────────────────────── */}
      <ConfirmationModal
        isOpen={isLogoutModalOpen}
        title={isAr ? 'تأكيد تسجيل الخروج' : 'Confirm Sign Out'}
        message={isAr ? 'هل أنت متأكد من تسجيل الخروج والعودة لصفحة الدخول؟' : 'Are you sure you want to sign out of your administration portal?'}
        onConfirm={confirmLogout}
        onCancel={() => setIsLogoutModalOpen(false)}
        confirmText={isAr ? 'خروج' : 'Sign Out'}
        cancelText={isAr ? 'إلغاء' : 'Cancel'}
      />

    </div>
  );
}
