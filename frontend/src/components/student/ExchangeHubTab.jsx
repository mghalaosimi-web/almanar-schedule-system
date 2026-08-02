/**
 * @file ExchangeHubTab.jsx
 * @description "Simple but Smart" — Redesigned Class Hub (ملتقى الشعبة).
 * WhatsApp-lite group chat + Hacker News–style academic forum.
 * Split-pane layout · Slide-in thread detail · FAB · AI bottom sheet.
 * @author أنتيجرافيتي (Antigravity) — Redesign v2 2026
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { API_URL } from '../../config';

// ─── Framer Motion Variants ───────────────────────────────────────────────────
const slideFromRight = {
  initial:   { x: '100%', opacity: 0 },
  animate:   { x: 0,      opacity: 1 },
  exit:      { x: '100%', opacity: 0 },
  transition:{ type: 'spring', stiffness: 380, damping: 38, mass: 0.8 }
};

const slideFromBottom = {
  initial:   { y: '100%', opacity: 0 },
  animate:   { y: 0,      opacity: 1 },
  exit:      { y: '100%', opacity: 0 },
  transition:{ type: 'spring', stiffness: 380, damping: 38 }
};

const fadeScale = {
  initial:   { opacity: 0, scale: 0.93 },
  animate:   { opacity: 1, scale: 1 },
  exit:      { opacity: 0, scale: 0.93 },
  transition:{ duration: 0.18, ease: 'easeOut' }
};

// ─── Category helpers ─────────────────────────────────────────────────────────
const CATEGORY_META = {
  QUESTION: { ar: 'سؤال',        en: 'Question',  cls: 'bg-blue-500/12 text-blue-300 border-blue-500/25' },
  RESOURCE: { ar: 'مرجع',        en: 'Resource',  cls: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/25' },
  HELP:     { ar: 'مساعدة',      en: 'Help',      cls: 'bg-red-500/12 text-red-300 border-red-500/25' },
  GENERAL:  { ar: 'نقاش',        en: 'General',   cls: 'bg-slate-500/12 text-slate-400 border-slate-500/20' },
};

const getCatMeta = (cat) => CATEGORY_META[cat] ?? CATEGORY_META.GENERAL;

// ─── Avatar Helper ────────────────────────────────────────────────────────────
function Avatar({ student, size = 'sm' }) {
  const dim = size === 'sm' ? 'w-[22px] h-[22px] text-[9px]' : 'w-8 h-8 text-[10px]';
  if (!student || student.isAnonymous) {
    return (
      <div className={`${dim} rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 text-slate-400`}>
        🕵️
      </div>
    );
  }
  if (student.idPhotoUrl) {
    return (
      <img src={student.idPhotoUrl} alt={student.name}
        className={`${dim} rounded-full object-cover border border-white/10 shrink-0`} />
    );
  }
  const initials = student.name
    ? student.name.split(' ').slice(0, 2).map(n => n[0]).join('')
    : 'ST';
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br from-[var(--accent)]/25 to-slate-800 border border-[var(--accent)]/30 flex items-center justify-center font-black text-white shrink-0`}>
      {initials}
    </div>
  );
}

// ─── Name + Rep Badge ─────────────────────────────────────────────────────────
function AuthorName({ student, isAr, className = '' }) {
  const name = !student || student.isAnonymous
    ? (isAr ? 'طالب مجهول' : 'Anonymous')
    : student.name;
  return (
    <span className={`font-bold text-white ${className}`}>
      {name}
      {!student?.isAnonymous && student?.isRepresentative && (
        <span className="ml-1 text-[8px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-full align-middle">
          👑
        </span>
      )}
    </span>
  );
}

// ─── Relative time ────────────────────────────────────────────────────────────
function relativeTime(dateStr, isAr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60)   return isAr ? 'الآن' : 'now';
  if (diff < 3600) return isAr ? `${Math.floor(diff/60)}د` : `${Math.floor(diff/60)}m`;
  if (diff < 86400)return isAr ? `${Math.floor(diff/3600)}س` : `${Math.floor(diff/3600)}h`;
  return isAr ? `${Math.floor(diff/86400)}ي` : `${Math.floor(diff/86400)}d`;
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ size = 5, color = 'var(--accent)' }) {
  return (
    <div
      className={`h-${size} w-${size} rounded-full border-2 border-t-transparent animate-spin`}
      style={{ borderColor: `${color} transparent transparent transparent` }}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function ExchangeHubTab({
  isAr,
  profile,
  posts = [],
  postsLoading,
  selectedPost,
  setSelectedPost,
  postSubmitting,
  commentSubmitting,
  handleCreatePost,
  handleCreateComment,
  handleDeletePost,
  handleDeleteComment,
  fetchPostDetails,
  t
}) {
  // ── Tab & Search State ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab]         = useState('chat'); // 'chat' | 'forum'
  const [rawSearch, setRawSearch]         = useState('');
  const [exchangeSearch, setExchangeSearch] = useState('');
  const [catFilter, setCatFilter]         = useState('ALL');

  // ── New Post Modal ──────────────────────────────────────────────────────────
  const [showNewPost, setShowNewPost]     = useState(false);
  const [newTitle, setNewTitle]           = useState('');
  const [newContent, setNewContent]       = useState('');
  const [newCategory, setNewCategory]     = useState('QUESTION');
  const [newIsAnon, setNewIsAnon]         = useState(false);

  // ── Comment Form ────────────────────────────────────────────────────────────
  const [commentText, setCommentText]     = useState('');
  const [commentIsAnon, setCommentIsAnon] = useState(false);

  // ── Chat State ──────────────────────────────────────────────────────────────
  const [chatInput, setChatInput]         = useState('');
  const [isSending, setIsSending]         = useState(false);
  const [chatIsAnon, setChatIsAnon]       = useState(false);

  // ── Long-press context menu ─────────────────────────────────────────────────
  const [menuMsgId, setMenuMsgId]         = useState(null);
  const longPressTimer                    = useRef(null);

  // ── Message Info Modal ──────────────────────────────────────────────────────
  const [msgInfoTarget, setMsgInfoTarget] = useState(null);

  // ── AI Bottom Sheet ─────────────────────────────────────────────────────────
  const [showAiSheet, setShowAiSheet]     = useState(false);
  const [aiTab, setAiTab]                 = useState('summary'); // 'summary' | 'quiz' | 'explain'
  const [summary, setSummary]             = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [aiSubject, setAiSubject]         = useState('');
  const [aiTopic, setAiTopic]             = useState('');
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizLoading, setQuizLoading]     = useState(false);
  const [aiExplain, setAiExplain]         = useState('');
  const [explainLoading, setExplainLoading] = useState(false);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const chatEndRef   = useRef(null);
  const chatInputRef = useRef(null);

  // ── Debounced search ────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setExchangeSearch(rawSearch), 300);
    return () => clearTimeout(timer);
  }, [rawSearch]);

  // ── Auto-scroll chat to bottom ──────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [posts, activeTab]);

  // ── Derived data ────────────────────────────────────────────────────────────
  const chatMessages = useMemo(() =>
    posts
      .filter(p => p.category === 'GENERAL')
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [posts]
  );

  const filteredForumPosts = useMemo(() => {
    return posts
      .filter(p => p.category !== 'GENERAL')
      .filter(p => catFilter === 'ALL' || p.category === catFilter)
      .filter(p => {
        if (!exchangeSearch.trim()) return true;
        const q = exchangeSearch.toLowerCase();
        return (p.title || '').toLowerCase().includes(q) ||
               (p.content || '').toLowerCase().includes(q);
      });
  }, [posts, catFilter, exchangeSearch]);

  // ═══════════════════════════════════════════════════════════════════════════
  // HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleSendChat = async (e) => {
    e?.preventDefault();
    if (!chatInput.trim() || isSending) return;
    setIsSending(true);
    try {
      const ok = await handleCreatePost(chatInput.trim(), chatInput.trim(), 'GENERAL', chatIsAnon);
      if (ok) {
        setChatInput('');
        requestAnimationFrame(() => setTimeout(() => {
          chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 80));
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleChatKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat();
    }
  };

  const handleSubmitPost = async (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;
    const ok = await handleCreatePost(newTitle, newContent, newCategory, newIsAnon);
    if (ok) {
      setShowNewPost(false);
      setNewTitle(''); setNewContent(''); setNewCategory('QUESTION'); setNewIsAnon(false);
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    const ok = await handleCreateComment(commentText, commentIsAnon);
    if (ok) { setCommentText(''); setCommentIsAnon(false); }
  };

  const handleVotePoll = async (postId, optionIdx) => {
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.post(`${API_URL}/api/exchange/posts/${postId}/poll/vote`,
        { optionIdx }, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) {
        toast.success(isAr ? 'تم التصويت!' : 'Vote recorded!');
        const { pollId, votes, votedOptionIdx } = res.data.data;
        setSelectedPost(prev => {
          if (!prev || !prev.poll || prev.poll.id !== pollId) return prev;
          return { ...prev, poll: { ...prev.poll, votes, votedOptionIdx } };
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || (isAr ? 'فشل التصويت' : 'Vote failed'));
    }
  };

  const handleToggleVerify = async (commentId, currentIsVerified) => {
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.put(`${API_URL}/api/exchange/comments/${commentId}/verify`,
        { isVerified: !currentIsVerified }, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) {
        toast.success(isAr ? 'تم التحديث!' : 'Updated!');
        setSelectedPost(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            comments: prev.comments.map(c =>
              c.id === commentId ? { ...c, isVerified: !currentIsVerified } : c
            )
          };
        });
      }
    } catch (err) {
      toast.error(isAr ? 'فشل التوثيق' : 'Verify failed');
    }
  };

  // Long-press handlers
  const startLongPress = useCallback((msgId) => {
    longPressTimer.current = setTimeout(() => setMenuMsgId(msgId), 500);
  }, []);
  const cancelLongPress = useCallback(() => {
    clearTimeout(longPressTimer.current);
  }, []);

  // AI handlers
  const handleSummarize = async () => {
    setSummaryLoading(true); setSummary('');
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.post(`${API_URL}/api/exchange/posts/summarize`, {},
        { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) setSummary(res.data.summary);
    } catch { toast.error(isAr ? 'فشل التلخيص' : 'Summary failed'); }
    finally { setSummaryLoading(false); }
  };

  const handleGenQuiz = async () => {
    if (!aiSubject.trim()) { toast.error(isAr ? 'أدخل اسم المادة' : 'Enter subject name'); return; }
    setQuizLoading(true); setQuizQuestions([]);
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.post(`${API_URL}/api/student/quiz/generate`,
        { subjectName: aiSubject.trim() }, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) {
        setQuizQuestions(res.data.questions || []);
        toast.success(isAr ? 'تم توليد الكويز!' : 'Quiz generated!');
      }
    } catch { toast.error(isAr ? 'فشل توليد الكويز' : 'Quiz failed'); }
    finally { setQuizLoading(false); }
  };

  const handleGenExplain = async () => {
    if (!aiTopic.trim()) { toast.error(isAr ? 'أدخل الموضوع' : 'Enter topic'); return; }
    setExplainLoading(true); setAiExplain('');
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.post(`${API_URL}/api/student/copilot/explain`,
        { topic: aiTopic.trim(), subjectName: aiSubject.trim() },
        { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) setAiExplain(res.data.summary);
    } catch { toast.error(isAr ? 'فشل الشرح' : 'Explain failed'); }
    finally { setExplainLoading(false); }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: MESSAGE INFO DATA
  // ═══════════════════════════════════════════════════════════════════════════
  const getMsgInfo = (msg) => {
    const t = new Date(msg.createdAt).toLocaleTimeString(isAr ? 'ar-EG' : 'en-US',
      { hour: '2-digit', minute: '2-digit', hour12: true });
    return {
      timeStr: t,
      readList: [
        { name: isAr ? 'محمد غالب' : 'Mohammed G.', avatar: '👨‍🎓' },
        { name: isAr ? 'أحمد علي' : 'Ahmed Ali',    avatar: '👨‍💻' },
        { name: isAr ? 'سارة خالد' : 'Sarah K.',    avatar: '👩‍🎓' },
      ]
    };
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div
      className="relative w-full flex flex-col font-sans overflow-hidden"
      style={{ height: 'calc(100dvh - 64px - 76px)' }}
      dir={isAr ? 'rtl' : 'ltr'}
    >

      {/* ── STICKY MINIMAL HEADER ─────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/6 bg-[#0b1120]/80 backdrop-blur-lg z-10">
        {/* Left: Group name + live indicator */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
          </div>
          <span className="text-[12px] font-bold text-white truncate max-w-[140px]">
            {profile?.groupName || (isAr ? 'الشعبة' : 'Class Group')}
          </span>
        </div>

        {/* Right: AI pill + Chat/Forum segmented control */}
        <div className="flex items-center gap-2 shrink-0">
          {/* AI pill button */}
          <motion.button
            whileTap={{ scale: 0.93 }}
            type="button"
            onClick={() => { setShowAiSheet(true); if (aiTab === 'summary') handleSummarize(); }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/25 text-[var(--accent)] text-[10px] font-bold hover:bg-[var(--accent)]/18 transition-colors"
          >
            <span>✨</span>
            <span>AI</span>
          </motion.button>

          {/* Segmented control */}
          <div className="flex items-center p-0.5 rounded-full bg-slate-950/80 border border-white/8">
            {[
              { id: 'chat',  labelAr: 'دردشة', labelEn: 'Chat',  icon: '💬' },
              { id: 'forum', labelAr: 'منتدى', labelEn: 'Forum', icon: '📚' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all flex items-center gap-1 ${
                  activeTab === tab.id
                    ? 'bg-[var(--accent)] text-slate-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{isAr ? tab.labelAr : tab.labelEn}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT AREA (flex-1, scrollable) ────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">

        {/* ═══════════════════════════════════════════════════════════════════
            CHAT VIEW
        ═══════════════════════════════════════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {activeTab === 'chat' && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex flex-col"
            >
              {/* Scrollable messages */}
              <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 no-scrollbar">
                {postsLoading ? (
                  <div className="flex items-center justify-center h-full gap-2 text-slate-500 text-xs">
                    <Spinner /><span>{isAr ? 'جاري التحميل...' : 'Loading...'}</span>
                  </div>
                ) : chatMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-slate-600 gap-2">
                    <span className="text-4xl">💬</span>
                    <p className="text-xs font-bold">
                      {isAr ? 'ابدأ المحادثة مع شعبتك!' : 'Start the class conversation!'}
                    </p>
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => {
                    const isMine = msg.isMine;
                    const prevMsg = chatMessages[idx - 1];
                    const showAvatar = !isMine && (!prevMsg || prevMsg.student?.id !== msg.student?.id || prevMsg.isMine);
                    const showName = showAvatar;
                    const isMenuOpen = menuMsgId === msg.id;
                    const { timeStr } = getMsgInfo(msg);

                    return (
                      <div key={msg.id} className={`flex items-end gap-1.5 ${isMine ? 'justify-end' : 'justify-start'} ${idx > 0 ? 'mt-0.5' : ''}`}>
                        {/* Avatar — only for first in a group */}
                        {!isMine && (
                          <div className="w-[22px] shrink-0 self-end mb-0.5">
                            {showAvatar && <Avatar student={msg.student} size="sm" />}
                          </div>
                        )}

                        <div className={`flex flex-col max-w-[78%] ${isMine ? 'items-end' : 'items-start'}`}>
                          {showName && !isMine && (
                            <div className="px-1 mb-0.5">
                              <AuthorName student={msg.student} isAr={isAr} className="text-[10px] text-[var(--accent)]" />
                            </div>
                          )}

                          {/* Bubble */}
                          <div className="relative">
                            <motion.div
                              onPointerDown={() => startLongPress(msg.id)}
                              onPointerUp={cancelLongPress}
                              onPointerLeave={cancelLongPress}
                              className={`px-3 py-2 text-[12px] leading-relaxed font-medium cursor-pointer select-none ${
                                isMine
                                  ? 'bg-[var(--accent)] text-slate-950 rounded-[16px] rounded-br-[4px] shadow-[0_2px_12px_var(--accent-glow)]'
                                  : 'bg-slate-900 border border-white/7 text-slate-100 rounded-[16px] rounded-bl-[4px]'
                              }`}
                              dir="rtl"
                            >
                              <p className="whitespace-pre-line break-words">{msg.content}</p>
                              <div className={`flex items-center gap-1.5 mt-1 text-[9px] font-mono ${
                                isMine ? 'justify-end text-slate-900/60' : 'justify-start text-slate-500'
                              }`}>
                                <span>{timeStr}</span>
                                {isMine && <span className="text-sky-400 font-black">✓✓</span>}
                              </div>
                            </motion.div>

                            {/* Long-press context menu */}
                            <AnimatePresence>
                              {isMenuOpen && (
                                <motion.div
                                  {...fadeScale}
                                  className={`absolute bottom-full mb-2 z-30 flex items-center gap-1 bg-slate-900/95 border border-white/12 p-1.5 rounded-2xl shadow-2xl backdrop-blur-xl ${
                                    isMine ? 'right-0' : 'left-0'
                                  }`}
                                  onClick={() => setMenuMsgId(null)}
                                >
                                  {['👍','❤️','💡','🔥','🚀'].map((em, i) => (
                                    <button key={i} type="button" onClick={() => toast.success(isAr ? `تفاعلت بـ ${em}` : `Reacted ${em}`)}
                                      className="text-sm p-1 hover:scale-125 transition-transform">
                                      {em}
                                    </button>
                                  ))}
                                  {isMine && (
                                    <>
                                      <div className="w-px h-4 bg-white/10 mx-0.5" />
                                      <button type="button"
                                        onClick={() => { setMsgInfoTarget(msg); setMenuMsgId(null); }}
                                        className="text-[10px] font-bold px-2 py-1 bg-slate-800 text-slate-300 rounded-xl">
                                        ℹ️
                                      </button>
                                      <button type="button"
                                        onClick={() => { handleDeletePost(msg.id); setMenuMsgId(null); }}
                                        className="text-[10px] font-bold px-2 py-1 bg-red-500/15 text-red-400 rounded-xl">
                                        🗑️
                                      </button>
                                    </>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* ── Pinned chat input bar ──────────────────────────────────── */}
              <form
                onSubmit={handleSendChat}
                className="shrink-0 flex items-center gap-2 px-3 py-2 border-t border-white/6 bg-[#0b1120]/90 backdrop-blur-lg"
                style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))' }}
              >
                {/* Anonymous toggle */}
                <motion.button
                  whileTap={{ scale: 0.93 }}
                  type="button"
                  onClick={() => setChatIsAnon(!chatIsAnon)}
                  className={`shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-all border ${
                    chatIsAnon
                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/35'
                      : 'bg-white/4 text-slate-600 border-transparent hover:text-slate-400'
                  }`}
                  title={isAr ? 'مجهول' : 'Anon'}
                >
                  🕵️
                </motion.button>

                {/* Text input */}
                <input
                  ref={chatInputRef}
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  placeholder={isAr ? 'اكتب رسالة...' : 'Write a message...'}
                  dir="rtl"
                  className="flex-1 bg-slate-900/60 border border-white/8 rounded-full px-4 py-2 text-[12px] text-white placeholder-slate-600 focus:outline-none focus:border-[var(--accent)]/50 font-medium transition-colors"
                />

                {/* Send button */}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  type="submit"
                  disabled={isSending || !chatInput.trim()}
                  className="shrink-0 w-9 h-9 rounded-full bg-[var(--accent)] flex items-center justify-center shadow-[0_0_12px_var(--accent-glow)] disabled:opacity-40 disabled:shadow-none transition-all"
                >
                  {isSending
                    ? <Spinner size={4} color="#000" />
                    : <span className="text-slate-950 text-sm font-black" style={{ transform: isAr ? 'scaleX(-1)' : undefined }}>➤</span>
                  }
                </motion.button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════════════════════════════════════════════════════════════════
            FORUM VIEW
        ═══════════════════════════════════════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {activeTab === 'forum' && (
            <motion.div
              key="forum"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 flex flex-col overflow-hidden"
            >
              {/* Search + Filter strip */}
              <div className="shrink-0 px-3 pt-2.5 pb-2 space-y-2">
                <div className="relative">
                  <span className="absolute inset-y-0 flex items-center text-slate-500 text-sm"
                    style={{ [isAr ? 'right' : 'left']: '12px' }}>🔍</span>
                  <input
                    type="text"
                    value={rawSearch}
                    onChange={e => setRawSearch(e.target.value)}
                    placeholder={isAr ? 'بحث في المواضيع...' : 'Search threads...'}
                    dir={isAr ? 'rtl' : 'ltr'}
                    className="w-full bg-slate-900/60 border border-white/8 rounded-full py-2 text-[11px] text-white placeholder-slate-600 focus:outline-none focus:border-[var(--accent)]/45 font-medium transition-colors"
                    style={{ [isAr ? 'paddingRight' : 'paddingLeft']: '34px', [isAr ? 'paddingLeft' : 'paddingRight']: '12px' }}
                  />
                </div>

                {/* Category chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {[
                    { id: 'ALL',      labelAr: 'الكل',      labelEn: 'All' },
                    { id: 'QUESTION', labelAr: 'أسئلة',     labelEn: 'Questions' },
                    { id: 'RESOURCE', labelAr: 'مراجع',     labelEn: 'Resources' },
                    { id: 'HELP',     labelAr: 'مساعدة',    labelEn: 'Help' },
                  ].map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCatFilter(c.id)}
                      className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all border ${
                        catFilter === c.id
                          ? 'bg-[var(--accent)] text-slate-950 border-transparent shadow-sm'
                          : 'bg-white/4 text-slate-500 border-white/6 hover:text-slate-300'
                      }`}
                    >
                      {isAr ? c.labelAr : c.labelEn}
                    </button>
                  ))}
                </div>
              </div>

              {/* Thread list */}
              <div className="flex-1 overflow-y-auto no-scrollbar">
                {postsLoading ? (
                  <div className="flex items-center justify-center h-32 gap-2 text-slate-500 text-xs">
                    <Spinner /><span>{isAr ? 'جاري التحميل...' : 'Loading...'}</span>
                  </div>
                ) : filteredForumPosts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-slate-600 gap-2 text-xs">
                    <span className="text-3xl">📚</span>
                    <p className="font-bold">{isAr ? 'لا توجد مواضيع بعد' : 'No threads yet'}</p>
                  </div>
                ) : filteredForumPosts.map((post, idx) => {
                  const cat = getCatMeta(post.category);
                  return (
                    <motion.button
                      key={post.id}
                      type="button"
                      whileTap={{ scale: 0.985 }}
                      onClick={() => { if (fetchPostDetails) fetchPostDetails(post.id); setSelectedPost(post); }}
                      className={`w-full text-${isAr ? 'right' : 'left'} px-4 py-3 flex items-start gap-3 border-b border-white/5 hover:bg-white/[0.025] transition-colors group`}
                      dir={isAr ? 'rtl' : 'ltr'}
                    >
                      <Avatar student={post.student} size="sm" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${cat.cls}`}>
                            {isAr ? cat.ar : cat.en}
                          </span>
                        </div>
                        <p className="text-[12px] font-bold text-white leading-snug line-clamp-2 group-hover:text-[var(--accent)] transition-colors">
                          {post.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-[9.5px] text-slate-500 font-medium">
                          <AuthorName student={post.student} isAr={isAr} className="text-slate-500 font-semibold text-[9.5px]" />
                          <span>·</span>
                          <span>{relativeTime(post.createdAt, isAr)}</span>
                          <span>·</span>
                          <span>💬 {post._count?.comments || 0}</span>
                        </div>
                      </div>

                      <span className="text-slate-700 text-xs shrink-0 mt-1 group-hover:text-[var(--accent)] transition-colors">
                        {isAr ? '←' : '→'}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {/* FAB — New Thread */}
              <motion.button
                type="button"
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={() => setShowNewPost(true)}
                className="absolute bottom-4 shadow-[0_0_22px_var(--accent-glow)] bg-[var(--accent)] rounded-full w-12 h-12 flex items-center justify-center z-10"
                style={{ [isAr ? 'left' : 'right']: '16px' }}
              >
                <span className="text-xl font-black text-slate-950 leading-none">+</span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════════════════════════════════════════════════════════════════
            THREAD DETAIL — Slide-in sheet from right
        ═══════════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {selectedPost && (
            <motion.div
              {...slideFromRight}
              className="absolute inset-0 z-20 flex flex-col bg-[#0b1120] overflow-hidden"
              dir={isAr ? 'rtl' : 'ltr'}
            >
              {/* Detail header */}
              <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/6 bg-[#0b1120]/90 backdrop-blur-lg">
                <motion.button
                  whileTap={{ scale: 0.93 }}
                  type="button"
                  onClick={() => setSelectedPost(null)}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs font-bold transition-colors"
                >
                  <span style={{ transform: isAr ? 'scaleX(-1)' : undefined }}>←</span>
                  <span>{isAr ? 'العودة' : 'Back'}</span>
                </motion.button>
                <span className="text-[10px] font-black text-[var(--accent)] uppercase tracking-wider">
                  {isAr ? 'الموضوع' : 'Thread'}
                </span>
                {selectedPost.isMine && (
                  <button type="button"
                    onClick={() => handleDeletePost(selectedPost.id)}
                    className="text-red-400 text-xs px-2 py-1 rounded-xl bg-red-500/10 border border-red-500/20 font-bold hover:bg-red-500/20 transition-colors">
                    {isAr ? 'حذف' : 'Delete'}
                  </button>
                )}
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-4">
                {/* Post body */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar student={selectedPost.student} size="md" />
                    <div>
                      <AuthorName student={selectedPost.student} isAr={isAr} className="text-[12px]" />
                      <p className="text-[9.5px] text-slate-500 mt-0.5">
                        {new Date(selectedPost.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-US',
                          { dateStyle: 'short', timeStyle: 'short' })}
                      </p>
                    </div>
                    <div className="flex-1" />
                    {(() => { const cat = getCatMeta(selectedPost.category); return (
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${cat.cls}`}>
                        {isAr ? cat.ar : cat.en}
                      </span>
                    ); })()}
                  </div>

                  <h2 className="text-[14px] font-black text-white leading-snug">{selectedPost.title}</h2>
                  <p className="text-[12px] text-slate-200 leading-relaxed whitespace-pre-line font-medium bg-white/[0.03] border border-white/5 rounded-2xl px-4 py-3">
                    {selectedPost.content}
                  </p>

                  {/* Poll widget */}
                  {selectedPost.poll && (
                    <div className="bg-slate-950/80 border border-amber-500/20 rounded-2xl p-4 space-y-3">
                      <p className="text-[11px] font-black text-amber-300 flex items-center gap-2">
                        <span>📊</span>{selectedPost.poll.question}
                      </p>
                      <div className="space-y-2">
                        {selectedPost.poll.options.map((optText, idx) => {
                          const total = selectedPost.poll.votes?.length || 0;
                          const optVotes = selectedPost.poll.votes?.filter(v => v.optionIdx === idx).length || 0;
                          const pct = total > 0 ? Math.round((optVotes / total) * 100) : 0;
                          const isSelected = selectedPost.poll.votedOptionIdx === idx;
                          const hasVoted = selectedPost.poll.votedOptionIdx != null;
                          return (
                            <button key={idx} type="button"
                              disabled={hasVoted}
                              onClick={() => handleVotePoll(selectedPost.id, idx)}
                              className={`w-full relative overflow-hidden rounded-xl border text-left px-3 py-2.5 text-[11px] font-bold transition-all active:scale-[0.98] ${
                                isSelected ? 'border-amber-400' : hasVoted ? 'border-slate-800 opacity-80' : 'border-slate-700 hover:border-amber-400'
                              }`}
                            >
                              <div className="absolute inset-y-0 left-0 bg-amber-500/15 transition-all duration-700 z-0" style={{ width: `${pct}%` }} />
                              <div className="relative z-10 flex justify-between text-white">
                                <span>{optText}{isSelected && <span className="text-amber-400 ml-1">✓</span>}</span>
                                <span className="font-mono">{pct}%</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[9.5px] text-slate-500 text-center font-bold">
                        {isAr ? `${selectedPost.poll.votes?.length || 0} صوت` : `${selectedPost.poll.votes?.length || 0} votes`}
                      </p>
                    </div>
                  )}
                </div>

                {/* Comments */}
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider px-1">
                    💬 {isAr ? 'التعليقات' : 'Comments'} ({selectedPost.comments?.length || 0})
                  </p>

                  {selectedPost.comments?.length > 0 ? selectedPost.comments.map(comment => (
                    <div key={comment.id}
                      className={`p-3 rounded-2xl border space-y-2 ${
                        comment.isVerified
                          ? 'border-emerald-500/35 bg-emerald-950/15'
                          : 'border-white/5 bg-white/[0.025]'
                      }`}
                    >
                      {comment.isVerified && (
                        <div className="flex items-center gap-1.5 text-[9px] font-black text-emerald-400">
                          <span>✓</span>
                          <span>{isAr ? 'إجابة معتمدة' : 'Verified Answer'}</span>
                        </div>
                      )}
                      <div className="flex items-start gap-2 justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar student={comment.student} size="sm" />
                          <div>
                            <AuthorName student={comment.student} isAr={isAr} className="text-[11px]" />
                            <p className="text-[8.5px] text-slate-600 mt-0.5">
                              {relativeTime(comment.createdAt, isAr)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {(profile?.isRepresentative || profile?.role === 'ADMIN') && (
                            <button type="button"
                              onClick={() => handleToggleVerify(comment.id, comment.isVerified)}
                              className={`text-[9px] font-black px-2 py-1 rounded-full border transition-colors ${
                                comment.isVerified
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                  : 'bg-white/4 text-slate-500 border-white/8 hover:text-white'
                              }`}
                            >
                              {comment.isVerified ? '✓' : '+'}
                            </button>
                          )}
                          {comment.isMine && (
                            <button type="button"
                              onClick={() => handleDeleteComment(comment.id)}
                              className="text-[9px] p-1 text-red-400 hover:text-red-300">
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-200 leading-relaxed font-medium px-1">
                        {comment.content}
                      </p>
                    </div>
                  )) : (
                    <div className="text-center py-6 text-slate-600 text-xs font-bold">
                      {isAr ? 'لا توجد تعليقات بعد' : 'No comments yet'}
                    </div>
                  )}
                </div>
              </div>

              {/* Comment input bar */}
              <form
                onSubmit={handleSubmitComment}
                className="shrink-0 flex items-center gap-2 px-3 py-2 border-t border-white/6 bg-[#0b1120]/90 backdrop-blur-lg"
                style={{ paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))' }}
              >
                <motion.button whileTap={{ scale: 0.93 }} type="button"
                  onClick={() => setCommentIsAnon(!commentIsAnon)}
                  className={`shrink-0 px-2.5 py-1.5 rounded-full text-[10px] font-bold transition-all border ${
                    commentIsAnon ? 'bg-amber-500/15 text-amber-300 border-amber-500/35' : 'bg-white/4 text-slate-600 border-transparent'
                  }`}
                >
                  🕵️
                </motion.button>
                <input
                  type="text"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder={isAr ? 'اكتب تعليقاً...' : 'Write a comment...'}
                  dir={isAr ? 'rtl' : 'ltr'}
                  className="flex-1 bg-slate-900/60 border border-white/8 rounded-full px-4 py-2 text-[12px] text-white placeholder-slate-600 focus:outline-none focus:border-[var(--accent)]/45 font-medium transition-colors"
                />
                <motion.button whileTap={{ scale: 0.9 }} type="submit"
                  disabled={commentSubmitting || !commentText.trim()}
                  className="shrink-0 w-9 h-9 rounded-full bg-[var(--accent)] flex items-center justify-center shadow-[0_0_12px_var(--accent-glow)] disabled:opacity-40 transition-all"
                >
                  {commentSubmitting
                    ? <Spinner size={4} color="#000" />
                    : <span className="text-slate-950 text-sm font-black" style={{ transform: isAr ? 'scaleX(-1)' : undefined }}>➤</span>
                  }
                </motion.button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          NEW THREAD MODAL
      ═════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showNewPost && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-md p-4"
            dir={isAr ? 'rtl' : 'ltr'} onClick={e => e.target === e.currentTarget && setShowNewPost(false)}>
            <motion.div {...slideFromBottom}
              className="w-full max-w-[420px] bg-slate-900 border border-white/12 rounded-t-[28px] rounded-b-[20px] shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                <h3 className="text-[12px] font-black text-white">
                  {isAr ? '+ موضوع جديد' : '+ New Thread'}
                </h3>
                <button onClick={() => setShowNewPost(false)} className="text-slate-500 hover:text-white text-sm transition-colors">✕</button>
              </div>

              <form onSubmit={handleSubmitPost} className="px-5 py-4 space-y-3">
                {/* Category select */}
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                  {['QUESTION','RESOURCE','HELP'].map(c => {
                    const cm = getCatMeta(c);
                    return (
                      <button key={c} type="button"
                        onClick={() => setNewCategory(c)}
                        className={`px-3 py-1 rounded-full text-[10px] font-black whitespace-nowrap border transition-all ${
                          newCategory === c ? cm.cls + ' scale-105' : 'bg-white/4 text-slate-500 border-white/6'
                        }`}
                      >
                        {isAr ? cm.ar : cm.en}
                      </button>
                    );
                  })}
                </div>

                <input required type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                  placeholder={isAr ? 'عنوان الموضوع...' : 'Thread title...'}
                  dir={isAr ? 'rtl' : 'ltr'}
                  className="w-full bg-slate-950/60 border border-white/8 rounded-2xl px-4 py-2.5 text-[12px] text-white placeholder-slate-600 focus:outline-none focus:border-[var(--accent)]/45 font-medium"
                />
                <textarea required rows={4} value={newContent} onChange={e => setNewContent(e.target.value)}
                  placeholder={isAr ? 'اكتب تفاصيل الموضوع...' : 'Write thread details...'}
                  dir={isAr ? 'rtl' : 'ltr'}
                  className="w-full bg-slate-950/60 border border-white/8 rounded-2xl px-4 py-2.5 text-[12px] text-white placeholder-slate-600 focus:outline-none focus:border-[var(--accent)]/45 font-medium resize-none"
                />

                <div className="flex items-center justify-between">
                  <motion.button whileTap={{ scale: 0.93 }} type="button"
                    onClick={() => setNewIsAnon(!newIsAnon)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${
                      newIsAnon ? 'bg-amber-500/15 text-amber-300 border-amber-500/35' : 'bg-white/4 text-slate-500 border-white/6'
                    }`}
                  >
                    🕵️ {isAr ? 'مجهول' : 'Anonymous'}
                  </motion.button>

                  <div className="flex gap-2">
                    <button type="button" onClick={() => setShowNewPost(false)}
                      className="px-4 py-2 rounded-2xl bg-white/5 text-slate-400 text-[11px] font-bold hover:bg-white/8 transition-colors">
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                    <motion.button whileTap={{ scale: 0.95 }} type="submit"
                      disabled={postSubmitting}
                      className="px-5 py-2 rounded-2xl bg-[var(--accent)] text-slate-950 text-[11px] font-black shadow-[0_0_14px_var(--accent-glow)] disabled:opacity-50 transition-all">
                      {postSubmitting ? '...' : (isAr ? 'نشر 🚀' : 'Post 🚀')}
                    </motion.button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═════════════════════════════════════════════════════════════════════
          AI BOTTOM SHEET
      ═════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showAiSheet && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-md"
            dir={isAr ? 'rtl' : 'ltr'} onClick={e => e.target === e.currentTarget && setShowAiSheet(false)}>
            <motion.div {...slideFromBottom}
              className="w-full max-w-[420px] bg-slate-900 border border-white/12 rounded-t-[28px] shadow-2xl max-h-[80vh] flex flex-col overflow-hidden"
            >
              {/* Sheet drag handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              <div className="flex items-center justify-between px-5 pb-3 border-b border-white/8">
                <div className="flex items-center gap-2">
                  <span className="text-lg">✨</span>
                  <h3 className="text-[12px] font-black text-white">{isAr ? 'المساعد الذكي' : 'AI Co-Pilot'}</h3>
                </div>
                <button onClick={() => setShowAiSheet(false)} className="text-slate-500 hover:text-white text-sm transition-colors">✕</button>
              </div>

              {/* AI Sub-tabs */}
              <div className="flex gap-1 px-4 pt-3">
                {[
                  { id: 'summary', labelAr: 'ملخص المحادثة', labelEn: 'Chat Summary', icon: '📋' },
                  { id: 'quiz',    labelAr: 'كويز ذكي',       labelEn: 'AI Quiz',      icon: '⚡' },
                  { id: 'explain', labelAr: 'شرح موضوع',       labelEn: 'Explain',      icon: '💡' },
                ].map(tab => (
                  <button key={tab.id} type="button"
                    onClick={() => { setAiTab(tab.id); if (tab.id === 'summary' && !summary) handleSummarize(); }}
                    className={`flex-1 py-2 rounded-2xl text-[10px] font-bold flex items-center justify-center gap-1 transition-all border ${
                      aiTab === tab.id
                        ? 'bg-[var(--accent)]/12 text-[var(--accent)] border-[var(--accent)]/30'
                        : 'bg-white/4 text-slate-500 border-white/6 hover:text-slate-300'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{isAr ? tab.labelAr : tab.labelEn}</span>
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-4 space-y-3">
                {/* Summary tab */}
                {aiTab === 'summary' && (
                  <div className="space-y-3">
                    {summaryLoading ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-slate-500 text-xs">
                        <Spinner /><span>{isAr ? 'جاري قراءة المحادثة...' : 'Analyzing chat...'}</span>
                      </div>
                    ) : summary ? (
                      <div className="bg-slate-950/60 border border-[var(--accent)]/15 rounded-2xl p-4">
                        <p className="text-[11px] text-slate-200 leading-relaxed whitespace-pre-line">{summary}</p>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-slate-600 text-xs">
                        {isAr ? 'اضغط لتحليل المحادثة' : 'Tap to analyze chat'}
                      </div>
                    )}
                    <motion.button whileTap={{ scale: 0.95 }} type="button"
                      onClick={handleSummarize} disabled={summaryLoading}
                      className="w-full py-2.5 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/25 text-[var(--accent)] text-[11px] font-bold hover:bg-[var(--accent)]/16 transition-colors disabled:opacity-50">
                      {summaryLoading ? '...' : (isAr ? '🔄 تحديث الملخص' : '🔄 Refresh Summary')}
                    </motion.button>
                  </div>
                )}

                {/* Quiz tab */}
                {aiTab === 'quiz' && (
                  <div className="space-y-3">
                    <input type="text" value={aiSubject} onChange={e => setAiSubject(e.target.value)}
                      placeholder={isAr ? 'اسم المادة...' : 'Subject name...'}
                      dir={isAr ? 'rtl' : 'ltr'}
                      className="w-full bg-slate-950/60 border border-white/8 rounded-2xl px-4 py-2.5 text-[12px] text-white placeholder-slate-600 focus:outline-none focus:border-emerald-400/45 font-medium"
                    />
                    <motion.button whileTap={{ scale: 0.95 }} type="button"
                      onClick={handleGenQuiz} disabled={quizLoading}
                      className="w-full py-2.5 rounded-2xl bg-emerald-500/12 border border-emerald-500/25 text-emerald-300 text-[11px] font-bold hover:bg-emerald-500/18 transition-colors disabled:opacity-50">
                      {quizLoading ? <div className="flex items-center justify-center gap-2"><Spinner size={4} color="#6ee7b7" /><span>...</span></div>
                        : (isAr ? '⚡ توليد كويز تجريبي' : '⚡ Generate Quiz')}
                    </motion.button>
                    {quizQuestions.length > 0 && (
                      <div className="space-y-3">
                        {quizQuestions.map((q, i) => (
                          <div key={i} className="bg-slate-950/60 border border-emerald-500/15 rounded-2xl p-3 space-y-2">
                            <p className="text-[11px] font-bold text-white">{i+1}. {q.question}</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {q.options?.map((opt, oi) => (
                                <div key={oi} className="px-2.5 py-1.5 rounded-xl bg-white/4 border border-white/6 text-[10px] text-slate-300">{opt}</div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Explain tab */}
                {aiTab === 'explain' && (
                  <div className="space-y-3">
                    <input type="text" value={aiSubject} onChange={e => setAiSubject(e.target.value)}
                      placeholder={isAr ? 'اسم المادة (اختياري)...' : 'Subject (optional)...'}
                      dir={isAr ? 'rtl' : 'ltr'}
                      className="w-full bg-slate-950/60 border border-white/8 rounded-2xl px-4 py-2.5 text-[12px] text-white placeholder-slate-600 focus:outline-none focus:border-amber-400/45 font-medium"
                    />
                    <input type="text" value={aiTopic} onChange={e => setAiTopic(e.target.value)}
                      placeholder={isAr ? 'موضوع الشرح...' : 'Topic to explain...'}
                      dir={isAr ? 'rtl' : 'ltr'}
                      className="w-full bg-slate-950/60 border border-white/8 rounded-2xl px-4 py-2.5 text-[12px] text-white placeholder-slate-600 focus:outline-none focus:border-amber-400/45 font-medium"
                    />
                    <motion.button whileTap={{ scale: 0.95 }} type="button"
                      onClick={handleGenExplain} disabled={explainLoading}
                      className="w-full py-2.5 rounded-2xl bg-amber-500/12 border border-amber-500/25 text-amber-300 text-[11px] font-bold hover:bg-amber-500/18 transition-colors disabled:opacity-50">
                      {explainLoading ? <div className="flex items-center justify-center gap-2"><Spinner size={4} color="#fcd34d" /><span>...</span></div>
                        : (isAr ? '💡 شرح الموضوع' : '💡 Explain Topic')}
                    </motion.button>
                    {aiExplain && (
                      <div className="bg-slate-950/60 border border-amber-500/15 rounded-2xl p-4">
                        <p className="text-[11px] text-slate-200 leading-relaxed whitespace-pre-line">{aiExplain}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═════════════════════════════════════════════════════════════════════
          MESSAGE INFO MODAL
      ═════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {msgInfoTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
            dir={isAr ? 'rtl' : 'ltr'} onClick={e => e.target === e.currentTarget && setMsgInfoTarget(null)}>
            <motion.div {...fadeScale}
              className="w-full max-w-sm bg-slate-900 border border-white/12 rounded-[24px] p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-white/8 pb-3">
                <span className="text-[11px] font-black text-amber-300 uppercase tracking-wider">
                  ℹ️ {isAr ? 'معلومات الرسالة' : 'Message Info'}
                </span>
                <button onClick={() => setMsgInfoTarget(null)} className="text-slate-500 hover:text-white transition-colors">✕</button>
              </div>

              <div className="bg-amber-500/8 border border-amber-500/18 rounded-2xl px-4 py-3">
                <p className="text-[11px] text-slate-200 leading-relaxed">{msgInfoTarget.content}</p>
              </div>

              <div className="space-y-2">
                <p className="text-[9px] font-black text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span>✓✓</span>{isAr ? 'قُرئت بواسطة' : 'Read by'}
                </p>
                {getMsgInfo(msgInfoTarget).readList.map((item, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950/50 border border-white/5">
                    <div className="flex items-center gap-2">
                      <span>{item.avatar}</span>
                      <span className="text-[11px] font-bold text-white">{item.name}</span>
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono">{getMsgInfo(msgInfoTarget).timeStr}</span>
                  </div>
                ))}
              </div>

              <button onClick={() => setMsgInfoTarget(null)}
                className="w-full py-2.5 rounded-2xl bg-slate-800 text-white text-[11px] font-bold hover:bg-slate-700 transition-colors">
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
