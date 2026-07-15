import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// ── Recursive Tree Node ──────────────────────────────────────────────────────
function BranchNode({ node, level, API_URL, token, isAr, onAction }) {
  const [open, setOpen] = useState(level === 0);
  const [actionLoading, setActionLoading] = useState({});
  const indent = level * 16;

  const nodeTypeColors = {
    university: { border: 'border-blue-500/30', bg: 'bg-blue-500/5',  icon: '🏛️', badge: 'text-blue-400' },
    college:    { border: 'border-teal-500/30',  bg: 'bg-teal-500/5',  icon: '🏫', badge: 'text-teal-400' },
    group:      { border: 'border-purple-500/30', bg: 'bg-purple-500/5', icon: '👥', badge: 'text-purple-400' },
  };
  const colors = nodeTypeColors[node.type] || nodeTypeColors.group;

  const executeAction = async (actionKey, payload) => {
    setActionLoading(prev => ({ ...prev, [actionKey]: true }));
    try {
      await onAction(node, actionKey, payload);
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  return (
    <div style={{ marginLeft: `${indent}px` }} className="relative">
      {/* Vertical connector line */}
      {level > 0 && (
        <div
          className="absolute border-l border-slate-700/50"
          style={{ left: '-12px', top: 0, bottom: 0 }}
        />
      )}

      <div className={`mb-2 border ${colors.border} ${colors.bg} rounded-xl p-3 transition hover:brightness-110`}>
        <div className="flex items-center justify-between gap-2">
          {/* Expand toggle + label */}
          <div className="flex items-center gap-2 min-w-0">
            {node.children?.length > 0 && (
              <button
                onClick={() => setOpen(o => !o)}
                className="w-5 h-5 rounded flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] shrink-0 transition"
              >
                {open ? '▼' : '▶'}
              </button>
            )}
            {!node.children?.length && <span className="w-5 h-5 shrink-0" />}
            <span className="text-sm shrink-0">{colors.icon}</span>
            <div className="min-w-0">
              <span className="text-xs font-bold text-white truncate block">{node.name}</span>
              <span className={`text-[9px] font-mono uppercase ${colors.badge}`}>{node.type}</span>
            </div>
          </div>

          {/* Action switches */}
          <div className="flex items-center gap-1.5 shrink-0">
            {node.type === 'group' && (
              <>
                <ActionSwitch
                  label={isAr ? 'إيقاف' : 'Suspend'}
                  activeColor="bg-red-600"
                  active={node.suspended}
                  loading={actionLoading['suspend']}
                  onClick={() => executeAction('suspend', { suspended: !node.suspended })}
                />
                <ActionSwitch
                  label={isAr ? 'صيانة' : 'Maint.'}
                  activeColor="bg-amber-600"
                  active={node.maintenance}
                  loading={actionLoading['maintenance']}
                  onClick={() => executeAction('maintenance', { maintenance: !node.maintenance })}
                />
              </>
            )}
            {node.type === 'college' && (
              <ActionSwitch
                label={isAr ? 'صيانة الكلية' : 'College Maint.'}
                activeColor="bg-amber-600"
                active={node.maintenance}
                loading={actionLoading['maintenance']}
                onClick={() => executeAction('maintenance', { maintenance: !node.maintenance })}
              />
            )}
            {node.type === 'university' && (
              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${colors.badge} bg-blue-500/10 border border-blue-500/20`}>
                {node.collegeCount ?? 0} {isAr ? 'كلية' : 'colleges'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Children */}
      <AnimatePresence>
        {open && node.children?.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            {node.children.map(child => (
              <BranchNode
                key={`${child.type}-${child.id}`}
                node={child}
                level={level + 1}
                API_URL={API_URL}
                token={token}
                isAr={isAr}
                onAction={onAction}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ActionSwitch({ label, active, loading, onClick, activeColor }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title={label}
      className={`relative w-10 h-5 rounded-full transition-all duration-300 border focus:outline-none ${
        active
          ? `${activeColor} border-transparent shadow-lg`
          : 'bg-slate-800 border-slate-700'
      } ${loading ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:opacity-90'}`}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${
          active ? 'left-5' : 'left-0.5'
        }`}
      />
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function DeepBranchManager({ API_URL, token, isAr, tenantFilter }) {
  const [tree, setTree]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch]   = useState('');

  const fetchTree = useCallback(async () => {
    setLoading(true);
    try {
      const params = tenantFilter?.universityId ? `?universityId=${tenantFilter.universityId}` : '';
      const res = await axios.get(`${API_URL}/api/admin/dev/branch-tree${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setTree(res.data.data);
      }
    } catch (err) {
      toast.error(isAr ? 'فشل تحميل هيكل الشعب' : 'Failed to load branch structure');
    } finally {
      setLoading(false);
    }
  }, [API_URL, token, tenantFilter]);

  useEffect(() => { fetchTree(); }, [fetchTree]);

  const handleAction = async (node, actionKey, payload) => {
    try {
      const endpoint = `${API_URL}/api/admin/dev/branch/${node.type}/${node.id}/${actionKey}`;
      const res = await axios.post(endpoint, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        toast.success(
          isAr
            ? `تم تطبيق الإجراء على ${node.name}`
            : `Action applied to ${node.name}`
        );
        fetchTree();
      }
    } catch (err) {
      toast.error(
        err.response?.data?.error ||
        (isAr ? 'فشل تنفيذ الإجراء' : 'Action failed')
      );
    }
  };

  const filterTree = (nodes, q) => {
    if (!q) return nodes;
    return nodes
      .map(n => ({
        ...n,
        children: filterTree(n.children || [], q)
      }))
      .filter(n =>
        n.name.toLowerCase().includes(q.toLowerCase()) || n.children?.length
      );
  };

  const filtered = filterTree(tree, search);

  return (
    <div className="bg-slate-900/60 backdrop-blur-xl border border-indigo-500/20 rounded-2xl p-6 shadow-2xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="text-indigo-400">🌳</span>
            {isAr ? 'تحكم الشعب العميق' : 'Deep Branch Control Tree'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {isAr
              ? 'تنقل: جامعة → كلية → شعبة. تحكم فوري بكل مستوى بضغطة زر.'
              : 'Navigate: University → College → Group. Instant control at every level.'}
          </p>
        </div>
        <button
          onClick={fetchTree}
          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-lg text-xs font-bold transition shrink-0"
        >
          🔄 {isAr ? 'تحديث' : 'Refresh'}
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder={isAr ? 'ابحث عن جامعة، كلية، أو شعبة...' : 'Search university, college, or group...'}
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500/40 transition mb-6"
      />

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span>🏛️</span> {isAr ? 'جامعة' : 'University'}</span>
        <span className="flex items-center gap-1"><span>🏫</span> {isAr ? 'كلية' : 'College'}</span>
        <span className="flex items-center gap-1"><span>👥</span> {isAr ? 'شعبة' : 'Group'}</span>
        <span className="flex items-center gap-1 ml-auto">
          <span className="text-red-400 font-bold">{isAr ? 'إيقاف' : 'Suspend'}</span>
          <span>·</span>
          <span className="text-amber-400 font-bold">{isAr ? 'صيانة' : 'Maint.'}</span>
        </span>
      </div>

      {/* Tree */}
      <div className="space-y-1 max-h-[600px] overflow-y-auto pr-1">
        {loading ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            <span className="animate-pulse">{isAr ? 'جاري تحميل هيكل الشعب...' : 'Loading branch tree...'}</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-600 text-xs">
            {isAr ? 'لا توجد بيانات مطابقة' : 'No matching branches found'}
          </div>
        ) : filtered.map(uni => (
          <BranchNode
            key={`university-${uni.id}`}
            node={uni}
            level={0}
            API_URL={API_URL}
            token={token}
            isAr={isAr}
            onAction={handleAction}
          />
        ))}
      </div>
    </div>
  );
}
