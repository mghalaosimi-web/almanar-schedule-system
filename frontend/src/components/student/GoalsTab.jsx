import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { API_URL } from '../../config';

export default function GoalsTab({ isAr, goals, goalsLoading, onToggleGoal, onAddPersonalTask, onDeletePersonalTask, profile, setProfile }) {
  const [filterType, setFilterType] = useState('ALL');

  const [focusActive, setFocusActive] = useState(() => localStorage.getItem('manar_focus_mode') === 'active');
  const [timeLeft, setTimeLeft] = useState(1500); // 25 mins

  useEffect(() => {
    let interval = null;
    if (focusActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            setFocusActive(false);
            localStorage.removeItem('manar_focus_mode');
            toast.success(isAr ? '🏆 انتهت جلسة التركيز بنجاح! طاب مجهودك.' : '🏆 Focus session finished successfully! Great job.');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (!focusActive) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [focusActive, timeLeft, isAr]);

  const handleToggleFocus = () => {
    const nextState = !focusActive;
    setFocusActive(nextState);
    if (nextState) {
      setTimeLeft(1500);
      localStorage.setItem('manar_focus_mode', 'active');
      toast.success(isAr ? '📴 تم تفعيل وضع التركيز وكتم الإشعارات محلياً' : '📴 Focus mode activated locally, notifications muted');
    } else {
      localStorage.removeItem('manar_focus_mode');
      toast(isAr ? '🔙 تم إلغاء وضع التركيز واستئناف الإشعارات' : '🔙 Focus mode stopped, notifications resumed');
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Add Task Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState('PERSONAL');
  const [addingTask, setAddingTask] = useState(false);

  // Smart Split states
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitSubtasks, setSplitSubtasks] = useState([]);
  const [selectedSubtasks, setSelectedSubtasks] = useState({});

  const handleSmartSplit = async () => {
    if (!newTaskTitle.trim()) {
      toast.error(isAr ? 'يرجى إدخال عنوان المهمة أولاً' : 'Please enter a task title first');
      return;
    }
    setSplitLoading(true);
    setSplitSubtasks([]);
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.post(`${API_URL}/api/student/tasks/split`, {
        title: newTaskTitle.trim()
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data?.success) {
        setSplitSubtasks(res.data.subtasks);
        const initialSelected = {};
        res.data.subtasks.forEach((_, idx) => {
          initialSelected[idx] = true;
        });
        setSelectedSubtasks(initialSelected);
        toast.success(isAr ? 'تم تقسيم المهمة بنجاح!' : 'Task split successfully!');
      }
    } catch (err) {
      console.error(err);
      toast.error(isAr ? 'فشل تقسيم المهمة' : 'Failed to split task');
    } finally {
      setSplitLoading(false);
    }
  };

  const handleAddTaskSubmit = async (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setAddingTask(true);

    // 1. Add main task
    const mainSuccess = await onAddPersonalTask(newTaskTitle, newTaskDueDate || null, newTaskCategory);

    // 2. Add subtasks in parallel
    if (mainSuccess && splitSubtasks.length > 0) {
      const selected = splitSubtasks.filter((_, idx) => selectedSubtasks[idx]);
      if (selected.length > 0) {
        const promises = selected.map(subTitle => 
          onAddPersonalTask(subTitle, newTaskDueDate || null, 'PERSONAL')
        );
        await Promise.all(promises);
      }
    }

    setAddingTask(false);
    if (mainSuccess) {
      setNewTaskTitle('');
      setNewTaskDueDate('');
      setNewTaskCategory('PERSONAL');
      setSplitSubtasks([]);
      setSelectedSubtasks({});
      setIsAddModalOpen(false);
    }
  };

  // Calculate stats
  const totalCount = goals.length;
  const completedCount = goals.filter(g => g.completed).length;
  const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const assignmentCount = goals.filter(g => g.type === 'ASSIGNMENT').length;
  const projectCount = goals.filter(g => g.type === 'PROJECT').length;
  const examCount = goals.filter(g => g.type === 'EXAM').length;
  const achievementCount = goals.filter(g => g.type === 'ACHIEVEMENT').length;

  const filteredGoals = filterType === 'ALL'
    ? goals
    : goals.filter(g => g.type === filterType);

  const getBadgeStyles = (type) => {
    switch (type) {
      case 'ASSIGNMENT':
        return 'bg-blue-500/15 border-blue-500/30 text-blue-400';
      case 'PROJECT':
        return 'bg-purple-500/15 border-purple-500/30 text-purple-400';
      case 'EXAM':
        return 'bg-red-500/15 border-red-500/30 text-red-400';
      case 'ACHIEVEMENT':
        return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400';
      default:
        return 'bg-slate-500/15 border-slate-500/30 text-slate-400';
    }
  };

  const getGoalTypeLabel = (type) => {
    switch (type) {
      case 'ASSIGNMENT':
        return isAr ? 'تكليف' : 'Assignment';
      case 'PROJECT':
        return isAr ? 'مشروع' : 'Project';
      case 'EXAM':
        return isAr ? 'اختبار' : 'Exam';
      case 'ACHIEVEMENT':
        return isAr ? 'إنجاز' : 'Achievement';
      default:
        return type;
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Focus Mode (Pomodoro) ── */}
      <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20 p-4 rounded-3xl mb-5 flex items-center justify-between relative overflow-hidden">
        <div className="absolute -left-5 -top-5 text-red-500/10 text-6xl"><i className="ph-fill ph-timer"></i></div>
        <div className="relative z-10">
          <h3 className="font-bold text-sm text-red-400 mb-1 flex items-center gap-1">
            <i className="ph-fill ph-brain"></i> {isAr ? 'وضع التركيز (بومودورو)' : 'Focus Mode (Pomodoro)'}
          </h3>
          <p className="text-[10px] text-[#94a3b8]">
            {focusActive 
              ? (isAr ? `⏱️ متبقي ${formatTime(timeLeft)} دقيقة` : `⏱️ ${formatTime(timeLeft)} remaining`)
              : (isAr ? 'اكتم الإشعارات وابدأ المذاكرة' : 'Mute notifications and start focusing')}
          </p>
        </div>
        <button 
          onClick={handleToggleFocus}
          className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-[0_0_15px_rgba(239,68,68,0.2)] active:scale-90 transition-transform ${
            focusActive 
              ? 'bg-red-500 text-white border border-red-400' 
              : 'bg-red-500/20 text-red-400 border border-red-500/50'
          }`}
        >
          <i className={`ph-fill ${focusActive ? 'ph-square' : 'ph-play'}`}></i>
        </button>
      </div>

      {/* ── 1. Progress Metric Card ── */}
      <div 
        className="relative overflow-hidden rounded-[24px] p-5 border border-white/5 bg-slate-900/60 shadow-xl"
        style={{ borderColor: 'var(--accent-glow)' }}
      >
        <div className="absolute top-0 right-0 w-28 h-28 bg-[var(--accent)]/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              {isAr ? 'معدل إنجاز المهام' : 'Task Completion Rate'}
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5">
              {isAr 
                ? `تم إنجاز ${completedCount} من أصل ${totalCount} مهام` 
                : `Completed ${completedCount} out of ${totalCount} tasks`}
            </p>
          </div>
          <span className="text-3xl font-black text-emerald-400 font-mono">
            {completionRate}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-white/5">
          <motion.div 
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
            initial={{ width: 0 }}
            animate={{ width: `${completionRate}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>

        {/* Categories grid */}
        <div className="grid grid-cols-4 gap-2 mt-5 text-center">
          <div className="p-2 bg-white/3 border border-white/5 rounded-xl">
            <span className="text-base block">📝</span>
            <span className="text-[10px] text-slate-400 font-bold block mt-1">{isAr ? 'التكاليف' : 'Tasks'}</span>
            <span className="text-xs font-black text-blue-400 mt-0.5 block">{goals.filter(g => g.type === 'ASSIGNMENT' && g.completed).length}/{assignmentCount}</span>
          </div>
          <div className="p-2 bg-white/3 border border-white/5 rounded-xl">
            <span className="text-base block">📁</span>
            <span className="text-[10px] text-slate-400 font-bold block mt-1">{isAr ? 'المشاريع' : 'Projects'}</span>
            <span className="text-xs font-black text-purple-400 mt-0.5 block">{goals.filter(g => g.type === 'PROJECT' && g.completed).length}/{projectCount}</span>
          </div>
          <div className="p-2 bg-white/3 border border-white/5 rounded-xl">
            <span className="text-base block">📅</span>
            <span className="text-[10px] text-slate-400 font-bold block mt-1">{isAr ? 'الاختبارات' : 'Exams'}</span>
            <span className="text-xs font-black text-red-400 mt-0.5 block">{goals.filter(g => g.type === 'EXAM' && g.completed).length}/{examCount}</span>
          </div>
          <div className="p-2 bg-white/3 border border-white/5 rounded-xl">
            <span className="text-base block">🎉</span>
            <span className="text-[10px] text-slate-400 font-bold block mt-1">{isAr ? 'الإنجازات' : 'Goals'}</span>
            <span className="text-xs font-black text-emerald-400 mt-0.5 block">{goals.filter(g => g.type === 'ACHIEVEMENT' && g.completed).length}/{achievementCount}</span>
          </div>
        </div>
      </div>

      {/* ── 2. Category Filters ── */}
      <div className="flex gap-2 border-b border-slate-850 pb-3 overflow-x-auto no-scrollbar">
        {[
          { id: 'ALL', label: isAr ? 'الكل' : 'All', icon: '🎯' },
          { id: 'ASSIGNMENT', label: isAr ? 'التكاليف' : 'Tasks', icon: '📝' },
          { id: 'PROJECT', label: isAr ? 'المشاريع' : 'Projects', icon: '📁' },
          { id: 'EXAM', label: isAr ? 'الاختبارات' : 'Exams', icon: '📅' },
          { id: 'ACHIEVEMENT', label: isAr ? 'الإنجازات' : 'Goals', icon: '🎉' }
        ].map(tab => {
          const active = filterType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-200 border shrink-0 ${
                active
                  ? 'bg-slate-800 text-white border-slate-700 shadow-md scale-105'
                  : 'bg-white/5 border-transparent text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Add Personal Task Button ── */}
      <button 
        onClick={() => setIsAddModalOpen(true)}
        className="w-full bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/30 border-dashed rounded-2xl py-3 flex items-center justify-center gap-2 mb-4 active:scale-95 transition-transform hover:bg-[#f59e0b]/20"
      >
        <i className="ph-bold ph-plus"></i> {isAr ? 'إضافة مهمة شخصية' : 'Add Personal Task'}
      </button>

      {/* ── 3. Goals Checklist ── */}
      <div className="space-y-3">
        {goalsLoading ? (
          <div className="flex justify-center py-20">
            <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredGoals.length === 0 ? (
          <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-10 text-center text-slate-600 text-xs font-bold">
            🎯 {isAr ? 'لا توجد مهام نشطة حالياً في هذا القسم.' : 'No active tasks at the moment.'}
          </div>
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence>
              {filteredGoals.map(goal => {
                const badgeStyle = getBadgeStyles(goal.type);
                const isOverdue = goal.dueDate && new Date(goal.dueDate) < new Date() && !goal.completed;

                return (
                  <motion.div
                    layout
                    key={goal.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`p-4 rounded-2xl border transition-all duration-300 relative flex items-start gap-4 ${
                      goal.completed
                        ? 'border-slate-850 bg-slate-950/20 opacity-60'
                        : isOverdue
                          ? 'border-red-500/20 bg-red-950/5 hover:border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.05)]'
                          : 'border-slate-800/80 bg-slate-900/40 hover:border-slate-700/80'
                    }`}
                  >
                    {/* Interactive Custom Checkbox */}
                    <div className="shrink-0 mt-0.5">
                      <label className="relative flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={goal.completed}
                          onChange={() => onToggleGoal(goal.id)}
                          className="sr-only"
                        />
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                          goal.completed
                            ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                            : isOverdue
                              ? 'border-red-500/40 bg-red-500/5 hover:bg-red-500/10'
                              : 'border-slate-650 bg-slate-950 hover:border-slate-500'
                        }`}>
                          {goal.completed && (
                            <svg className="w-4 h-4 font-black" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </div>
                      </label>
                    </div>

                    {/* Task details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border tracking-wider ${badgeStyle}`}>
                          {getGoalTypeLabel(goal.type)}
                        </span>
                        <span className="text-[9px] text-amber-400 font-black">
                          {goal.subject?.name}
                        </span>
                        {goal.weekNumber && (
                          <span className="text-[9px] bg-white/10 text-slate-400 px-1.5 py-0.5 rounded font-mono font-bold">
                            W{goal.weekNumber}
                          </span>
                        )}
                        {isOverdue && (
                          <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-[8px] font-black uppercase tracking-wider">
                            {isAr ? 'متأخر' : 'Overdue'}
                          </span>
                        )}
                      </div>

                      <h4 className={`font-extrabold text-sm text-white leading-tight mt-1.5 ${
                        goal.completed ? 'line-through text-slate-500' : ''
                      }`}>
                        {goal.title}
                      </h4>

                      {goal.description && (
                        <p className={`text-[10.5px] leading-relaxed mt-1 font-semibold ${
                          goal.completed ? 'text-slate-600' : 'text-slate-400'
                        }`}>
                          {goal.description}
                        </p>
                      )}

                      {/* Dates footer */}
                      <div className="mt-3 flex justify-between items-center text-[9px] font-mono text-slate-500 font-bold">
                        <span>
                          📅 {isAr ? 'تاريخ التسليم:' : 'Due Date:'} {goal.dueDate ? new Date(goal.dueDate).toLocaleDateString() : (isAr ? 'مفتوح' : 'Open')}
                        </span>
                        {goal.isPersonal && (
                          <button
                            type="button"
                            onClick={() => onDeletePersonalTask(goal.id)}
                            className="p-1 text-red-400 hover:text-red-300 transition-colors"
                            title={isAr ? 'حذف المهمة' : 'Delete Task'}
                          >
                            <i className="ph ph-trash text-sm"></i>
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Add Personal Task Modal ── */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#1e293b] border border-slate-700/50 rounded-3xl p-6 w-full max-w-sm text-white shadow-2xl relative"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-1.5 font-sans">
                  📝 {isAr ? 'إضافة مهمة شخصية' : 'Add Personal Task'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleAddTaskSubmit} className="space-y-4 font-sans text-right">
                <div className="space-y-1">
                  <label className="block text-xs text-[#94a3b8]">
                    {isAr ? 'عنوان المهمة' : 'Task Title'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl p-3 text-xs text-white outline-none placeholder:text-slate-600 focus:border-amber-500 text-right"
                    placeholder={isAr ? 'مثال: تسليم بحث التفاعل البشري' : 'e.g. Turn in HCI Research'}
                  />
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[9px] text-slate-500 font-bold">{isAr ? 'تقسيم المهمة لخطوات أصغر؟' : 'Split this task?'}</span>
                    <button
                      type="button"
                      onClick={handleSmartSplit}
                      disabled={splitLoading}
                      className="text-amber-500 hover:text-amber-400 font-black text-[10px] flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-xl disabled:opacity-50 transition-all active:scale-95"
                    >
                      {splitLoading ? (
                        <div className="h-3 w-3 border border-amber-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>✨</span>
                          {isAr ? 'التقسيم الذكي' : 'Smart Split'}
                        </>
                      )}
                    </button>
                  </div>

                  {splitSubtasks.length > 0 && (
                    <div className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-3 mt-3.5 space-y-2 text-right">
                      <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-wider mb-2">
                        {isAr ? 'المهام الفرعية المقترحة:' : 'Suggested Subtasks:'}
                      </h4>
                      <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                        {splitSubtasks.map((subTitle, idx) => (
                          <label key={idx} className="flex items-center gap-2.5 text-[10px] cursor-pointer hover:text-white transition-colors justify-end">
                            <span className="text-slate-300 select-none">{subTitle}</span>
                            <input
                              type="checkbox"
                              checked={!!selectedSubtasks[idx]}
                              onChange={(e) => setSelectedSubtasks({ ...selectedSubtasks, [idx]: e.target.checked })}
                              className="rounded bg-slate-900 border-slate-800 text-amber-550 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
                            />
                          </label>
                        ))}
                      </div>
                      <p className="text-[8.5px] text-slate-500 leading-normal font-bold">
                        {isAr 
                          ? '* سيتم إضافة المهام الفرعية المحددة كمهام شخصية مستقلة عند الحفظ.'
                          : '* Checked subtasks will be created as separate personal tasks.'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-xs text-[#94a3b8]">
                    {isAr ? 'تاريخ التسليم (اختياري)' : 'Due Date (Optional)'}
                  </label>
                  <input
                    type="date"
                    value={newTaskDueDate}
                    onChange={(e) => setNewTaskDueDate(e.target.value)}
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs text-[#94a3b8]">
                    {isAr ? 'الفئة' : 'Category'}
                  </label>
                  <select
                    value={newTaskCategory}
                    onChange={(e) => setNewTaskCategory(e.target.value)}
                    className="w-full bg-[#0b1120] border border-slate-700 rounded-xl p-3 text-xs text-white outline-none focus:border-amber-500 text-right"
                  >
                    <option value="PERSONAL">{isAr ? 'شخصية' : 'Personal'}</option>
                    <option value="ASSIGNMENT">{isAr ? 'تكليف' : 'Assignment'}</option>
                    <option value="PROJECT">{isAr ? 'مشروع' : 'Project'}</option>
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={addingTask}
                  className="w-full bg-[#f59e0b] hover:bg-[#f59e0b]/90 text-[#0b1120] py-3 rounded-xl text-xs font-bold transition-all disabled:opacity-50 mt-2"
                >
                  {addingTask 
                    ? (isAr ? 'جاري الإضافة...' : 'Adding...') 
                    : (isAr ? 'إضافة المهمة' : 'Add Task')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
