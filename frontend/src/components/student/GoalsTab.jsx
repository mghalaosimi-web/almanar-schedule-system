import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function GoalsTab({ isAr, goals, goalsLoading, onToggleGoal }) {
  const [filterType, setFilterType] = useState('ALL');

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
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
