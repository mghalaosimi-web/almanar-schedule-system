/**
 * @file ExchangeHubTab.jsx
 * @description ملتقى الشعبة — تصميم محادثة حية احترافية بأسلوب واتساب / تيليغرام
 * يملأ الإطار كاملاً: هيدر ثابت أعلى ← منطقة رسائل مرنة ← إدخال مثبت أسفل
 * @author Antigravity — Fullscreen Chat Overhaul 2026
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { API_URL } from '../../config';

export default function ExchangeHubTab({
  isAr, profile, posts = [], postsLoading,
  selectedPost, setSelectedPost, postSubmitting, commentSubmitting,
  handleCreatePost, handleCreateComment, handleDeletePost, handleDeleteComment,
  fetchPostDetails, t
}) {
  /* ── View state: 'chat' | 'forum' ── */
  const [view, setView] = useState('chat');

  /* ── Forum state ── */
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');
  const [newPostModal, setNewPostModal] = useState(false);
  const [nTitle, setNTitle] = useState('');
  const [nContent, setNContent] = useState('');
  const [nCat, setNCat] = useState('GENERAL');
  const [nAnon, setNAnon] = useState(false);
  const [nComment, setNComment] = useState('');
  const [nCommentAnon, setNCommentAnon] = useState(false);

  /* ── Chat state ── */
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [anon, setAnon] = useState(false);
  const [msgInfo, setMsgInfo] = useState(null);
  const [menuId, setMenuId] = useState(null);

  /* ── AI state ── */
  const [aiOpen, setAiOpen] = useState(false);
  const [aiSubject, setAiSubject] = useState('');
  const [aiTopic, setAiTopic] = useState('');
  const [aiQuiz, setAiQuiz] = useState([]);
  const [aiExplain, setAiExplain] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const messagesRef = useRef(null);

  /* ── Derived data ── */
  const chatMsgs = posts
    .filter(p => p.category === 'GENERAL')
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const forumPosts = posts.filter(p => p.category !== 'GENERAL').filter(p => {
    const matchCat = catFilter === 'ALL' || p.category === catFilter;
    const matchSearch = !search.trim() ||
      (p.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.content || '').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  /* ── Auto-scroll on new messages ── */
  useEffect(() => {
    if (view === 'chat') {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 60);
    }
  }, [chatMsgs.length, view]);

  /* ── Send chat message ── */
  const sendMsg = async (e) => {
    e?.preventDefault();
    if (!msg.trim() || sending) return;
    setSending(true);
    try {
      await handleCreatePost(msg.trim(), msg.trim(), 'GENERAL', anon);
      setMsg('');
      inputRef.current?.focus();
    } catch (err) {
      toast.error(isAr ? 'فشل الإرسال' : 'Send failed');
    } finally {
      setSending(false);
    }
  };

  /* ── AI Summarize ── */
  const summarize = async () => {
    setSummaryLoading(true); setSummary(''); setSummaryOpen(true);
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.post(`${API_URL}/api/exchange/posts/summarize`, {}, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data?.success) setSummary(res.data.summary);
    } catch { toast.error(isAr ? 'فشل التلخيص' : 'Failed'); setSummaryOpen(false); }
    finally { setSummaryLoading(false); }
  };

  /* ── AI Quiz ── */
  const genQuiz = async () => {
    if (!aiSubject.trim()) return toast.error(isAr ? 'أدخل اسم المادة' : 'Enter subject');
    setAiLoading(true); setAiQuiz([]); setAiExplain('');
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.post(`${API_URL}/api/student/quiz/generate`,
        { subjectName: aiSubject.trim() },
        { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) setAiQuiz(res.data.questions || []);
    } catch { toast.error(isAr ? 'فشل التوليد' : 'Quiz failed'); }
    finally { setAiLoading(false); }
  };

  /* ── AI Explain ── */
  const genExplain = async () => {
    if (!aiTopic.trim()) return toast.error(isAr ? 'أدخل موضوع الشرح' : 'Enter topic');
    setAiLoading(true); setAiExplain(''); setAiQuiz([]);
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.post(`${API_URL}/api/student/copilot/explain`,
        { topic: aiTopic.trim(), subjectName: aiSubject.trim() },
        { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) setAiExplain(res.data.summary);
    } catch { toast.error(isAr ? 'فشل الشرح' : 'Explain failed'); }
    finally { setAiLoading(false); }
  };

  /* ── Poll vote ── */
  const votePoll = async (postId, optionIdx) => {
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.post(`${API_URL}/api/exchange/posts/${postId}/poll/vote`,
        { optionIdx }, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) {
        toast.success(isAr ? 'تم التصويت!' : 'Voted!');
        const { pollId, votes, votedOptionIdx } = res.data.data;
        setSelectedPost(prev => prev?.poll?.id === pollId
          ? { ...prev, poll: { ...prev.poll, votes, votedOptionIdx } } : prev);
      }
    } catch (err) { toast.error(err.response?.data?.error || (isAr ? 'فشل التصويت' : 'Vote failed')); }
  };

  /* ── Verify comment ── */
  const verifyComment = async (cid, cur) => {
    try {
      const token = localStorage.getItem('manar_token');
      await axios.put(`${API_URL}/api/exchange/comments/${cid}/verify`,
        { isVerified: !cur }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(isAr ? 'تم التحديث' : 'Updated');
      setSelectedPost(prev => prev ? {
        ...prev, comments: (prev.comments || []).map(c => c.id === cid ? { ...c, isVerified: !cur } : c)
      } : prev);
    } catch { toast.error(isAr ? 'فشل التوثيق' : 'Verify failed'); }
  };

  /* ── Badge helpers ── */
  const catBadge = (cat) => ({
    QUESTION: 'bg-blue-500/20 border-blue-500/40 text-blue-300',
    RESOURCE: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
    HELP: 'bg-red-500/20 border-red-500/40 text-red-300',
    GENERAL: 'bg-slate-500/20 border-slate-500/40 text-slate-300',
  }[cat] || 'bg-slate-500/20 border-slate-500/40 text-slate-300');

  const catLabel = (cat) => ({
    QUESTION: isAr ? 'سؤال' : 'Question',
    RESOURCE: isAr ? 'مرجع' : 'Resource',
    HELP: isAr ? 'مساعدة' : 'Help',
    GENERAL: isAr ? 'عام' : 'General',
  }[cat] || (isAr ? 'عام' : 'General'));

  const fmtTime = (dt) => new Date(dt).toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const initials = (name) => name ? name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() : 'ST';

  /* ════════════════════════════════════════════════════════════════════
     THREAD DETAIL VIEW
  ═════════════════════════════════════════════════════════════════════ */
  if (selectedPost) {
    return (
      <div className="flex flex-col h-full" dir={isAr ? 'rtl' : 'ltr'}>
        {/* Thread Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8 bg-[#0d1526]/95 backdrop-blur-xl shrink-0">
          <button
            onClick={() => setSelectedPost(null)}
            className="w-9 h-9 rounded-2xl bg-white/6 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white text-sm transition-all active:scale-95"
          >
            {isAr ? '←' : '→'}
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-white truncate">{selectedPost.title}</p>
            <p className="text-[9px] text-slate-400 font-bold mt-0.5">
              {isAr ? 'عرض الموضوع والنقاش' : 'Thread Discussion'}
            </p>
          </div>
          <span className={`text-[9px] font-black px-2.5 py-1 rounded-xl border ${catBadge(selectedPost.category)}`}>
            {catLabel(selectedPost.category)}
          </span>
        </div>

        {/* Thread Content + Comments Scroll */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
          {/* Original Post */}
          <div className="p-4 rounded-2xl bg-[var(--accent)]/8 border border-[var(--accent)]/20 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[var(--accent)]/30 to-slate-800 border border-[var(--accent)]/40 flex items-center justify-center font-black text-[10px] text-white shrink-0">
                {selectedPost.student?.isAnonymous ? '🕵' : initials(selectedPost.student?.name)}
              </div>
              <div>
                <p className="text-xs font-black text-white">
                  {selectedPost.student?.isAnonymous ? (isAr ? 'طالب مجهول' : 'Anonymous') : selectedPost.student?.name}
                  {selectedPost.student?.isRepresentative && !selectedPost.student?.isAnonymous && (
                    <span className="mr-1.5 text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-500/30">👑</span>
                  )}
                </p>
                <p className="text-[9px] text-slate-400 font-medium" dir="ltr">{fmtTime(selectedPost.createdAt)}</p>
              </div>
              {selectedPost.isMine && (
                <button onClick={() => handleDeletePost(selectedPost.id)} className="mr-auto text-red-400 text-xs p-1.5 rounded-xl hover:bg-red-500/10">🗑️</button>
              )}
            </div>
            <p className="text-xs text-slate-100 leading-relaxed font-medium whitespace-pre-line">{selectedPost.content}</p>

            {/* Poll */}
            {selectedPost.poll && (
              <div className="space-y-2 mt-2 p-3 rounded-xl bg-black/20 border border-amber-500/20">
                <p className="text-xs font-black text-amber-300">📊 {selectedPost.poll.question}</p>
                {selectedPost.poll.options.map((opt, i) => {
                  const total = selectedPost.poll.votes?.length || 0;
                  const cnt = selectedPost.poll.votes?.filter(v => v.optionIdx === i).length || 0;
                  const pct = total > 0 ? Math.round((cnt / total) * 100) : 0;
                  const sel = selectedPost.poll.votedOptionIdx === i;
                  const voted = selectedPost.poll.votedOptionIdx != null;
                  return (
                    <button key={i} disabled={voted} onClick={() => votePoll(selectedPost.id, i)}
                      className={`w-full relative overflow-hidden rounded-xl p-3 text-right text-xs font-bold transition-all ${sel ? 'border border-amber-400' : 'border border-slate-700 hover:border-amber-400'} bg-slate-900`}>
                      <div className="absolute inset-y-0 right-0 bg-amber-500/20 transition-all" style={{ width: `${pct}%` }} />
                      <div className="relative flex justify-between text-white">
                        <span>{opt}{sel && <span className="text-amber-400 font-black mr-1"> ✓</span>}</span>
                        <span className="font-mono">{pct}%</span>
                      </div>
                    </button>
                  );
                })}
                <p className="text-[9px] text-center text-slate-400 font-bold">{isAr ? `${selectedPost.poll.votes?.length || 0} صوت` : `${selectedPost.poll.votes?.length || 0} votes`}</p>
              </div>
            )}
          </div>

          {/* Comments */}
          <div className="space-y-3">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
              💬 {isAr ? `التعليقات (${selectedPost.comments?.length || 0})` : `Comments (${selectedPost.comments?.length || 0})`}
            </p>
            {(selectedPost.comments || []).length === 0 ? (
              <p className="text-center text-xs text-slate-500 font-bold py-6">{isAr ? 'لا تعليقات بعد. أضف أول تعليق!' : 'No comments yet. Add the first!'}</p>
            ) : (selectedPost.comments || []).map(c => (
              <div key={c.id} className={`p-3.5 rounded-2xl border space-y-2 ${c.isVerified ? 'border-emerald-500/40 bg-emerald-950/20' : 'border-white/6 bg-slate-900/50'}`}>
                {c.isVerified && (
                  <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">✓ {isAr ? 'إجابة معتمدة' : 'Verified'}</span>
                )}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[var(--accent)]/20 to-slate-800 border border-white/10 flex items-center justify-center font-black text-[9px] text-white shrink-0">
                      {c.student?.isAnonymous ? '🕵' : initials(c.student?.name)}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-white">{c.student?.isAnonymous ? (isAr ? 'مجهول' : 'Anon') : c.student?.name}</p>
                      <p className="text-[8px] text-slate-500 font-medium" dir="ltr">{fmtTime(c.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {(profile?.isRepresentative || profile?.role === 'ADMIN') && (
                      <button onClick={() => verifyComment(c.id, c.isVerified)}
                        className={`text-[9px] px-2 py-1 rounded-lg font-black border transition-all ${c.isVerified ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-white/5 text-slate-400 border-white/10'}`}>
                        {c.isVerified ? '✓' : '+ ' + (isAr ? 'اعتماد' : 'Verify')}
                      </button>
                    )}
                    {c.isMine && <button onClick={() => handleDeleteComment(c.id)} className="text-red-400 text-xs p-1 rounded-lg hover:bg-red-500/10">🗑️</button>}
                  </div>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed font-medium">{c.content}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Comment Input — pinned bottom */}
        <div className="px-4 py-3 border-t border-white/8 bg-[#0d1526]/95 backdrop-blur-xl shrink-0 space-y-2">
          <form onSubmit={async (e) => { e.preventDefault(); if (!nComment.trim()) return; const ok = await handleCreateComment(nComment, nCommentAnon); if (ok) { setNComment(''); setNCommentAnon(false); } }} className="flex gap-2">
            <input value={nComment} onChange={e => setNComment(e.target.value)}
              placeholder={isAr ? 'اكتب تعليقاً...' : 'Write a comment...'}
              className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[var(--accent)] font-medium"
            />
            <button type="button" onClick={() => setNCommentAnon(!nCommentAnon)}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center border text-sm transition-all shrink-0 ${nCommentAnon ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-white/5 border-white/10 text-slate-500'}`}>
              🕵️
            </button>
            <button type="submit" disabled={commentSubmitting || !nComment.trim()}
              className="px-4 py-2.5 bg-[var(--accent)] text-slate-950 font-black text-xs rounded-2xl shrink-0 disabled:opacity-50 active:scale-95 transition-all">
              {isAr ? '↩' : '↩'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ════════════════════════════════════════════════════════════════════
     MAIN CHAT / FORUM LAYOUT — FULLSCREEN
  ═════════════════════════════════════════════════════════════════════ */
  return (
    <div className="flex flex-col h-full" dir={isAr ? 'rtl' : 'ltr'} style={{ minHeight: 0 }}>

      {/* ── TOP BAR ── fixed to top, compact ── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/8 bg-[#0d1526]/95 backdrop-blur-xl shrink-0">
        {/* Group Info */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative shrink-0">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-600/20 border border-amber-500/40 flex items-center justify-center text-base">
              🏫
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-[#0b1120]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black text-white truncate">{profile?.groupName || (isAr ? 'شعبة الدراسة' : 'Study Group')}</p>
            <p className="text-[9px] text-emerald-400 font-bold">{isAr ? '● متصل مباشرة' : '● Live Connected'}</p>
          </div>
        </div>

        {/* Chat/Forum Toggle */}
        <div className="flex items-center bg-slate-950/80 border border-white/10 rounded-2xl p-1 shrink-0">
          {[{ id: 'chat', icon: '💬', label: isAr ? 'دردشة' : 'Chat' }, { id: 'forum', icon: '📚', label: isAr ? 'منتدى' : 'Forum' }].map(v => (
            <button key={v.id} type="button" onClick={() => setView(v.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black transition-all ${view === v.id ? 'bg-[var(--accent)] text-slate-950' : 'text-slate-400 hover:text-white'}`}>
              <span>{v.icon}</span><span>{v.label}</span>
            </button>
          ))}
        </div>

        {/* AI Buttons */}
        <button type="button" onClick={summarize} disabled={summaryLoading}
          className="w-9 h-9 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 flex items-center justify-center shrink-0 hover:bg-amber-500/25 active:scale-95 transition-all">
          {summaryLoading ? <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /> : '✨'}
        </button>
        <button type="button" onClick={() => setAiOpen(true)}
          className="w-9 h-9 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center justify-center shrink-0 hover:bg-emerald-500/25 active:scale-95 transition-all">
          🤖
        </button>
      </div>

      {/* ── AI SUMMARY BANNER ── */}
      <AnimatePresence>
        {summaryOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden shrink-0">
            <div className="mx-3 my-2 p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/30 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">✨ {isAr ? 'ملخص الدردشة الذكي' : 'AI Chat Summary'}</span>
                <button onClick={() => setSummaryOpen(false)} className="text-amber-400 text-xs font-black hover:text-white">✕</button>
              </div>
              {summaryLoading
                ? <p className="text-xs text-slate-400 animate-pulse text-center py-2">{isAr ? 'جاري التحليل...' : 'Analyzing...'}</p>
                : <p className="text-xs text-slate-200 leading-relaxed font-medium whitespace-pre-line">{summary}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════
           VIEW: LIVE CHAT
      ═════════════════════════════ */}
      {view === 'chat' && (
        <>
          {/* Messages Area — flex-1, scrollable */}
          <div ref={messagesRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0"
            style={{ scrollBehavior: 'smooth' }}>
            {postsLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-xs text-slate-500">
                <div className="w-6 h-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                <span>{isAr ? 'جاري التحميل...' : 'Loading...'}</span>
              </div>
            ) : chatMsgs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500">
                <span className="text-4xl">💬</span>
                <p className="text-xs font-black text-center px-6">
                  {isAr ? 'لا توجد رسائل بعد. كن أول من يبدأ النقاش!' : 'No messages yet. Start the conversation!'}
                </p>
              </div>
            ) : (
              chatMsgs.map((m) => {
                const mine = m.isMine;
                const time = fmtTime(m.createdAt);
                const isMenuOpen = menuId === m.id;
                return (
                  <div key={m.id} className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                    {/* Avatar — others only */}
                    {!mine && (
                      <div className="w-7 h-7 rounded-2xl bg-gradient-to-br from-[var(--accent)]/25 to-slate-800 border border-white/10 flex items-center justify-center font-black text-[9px] text-white shrink-0 mb-0.5">
                        {m.student?.isAnonymous ? '🕵' : initials(m.student?.name)}
                      </div>
                    )}

                    {/* Bubble group */}
                    <div className={`flex flex-col max-w-[78%] ${mine ? 'items-end' : 'items-start'}`}>
                      {/* Sender name — others */}
                      {!mine && (
                        <span className="text-[9px] font-black text-[var(--accent)] mb-1 px-1">
                          {m.student?.isAnonymous ? (isAr ? 'مجهول' : 'Anon') : m.student?.name}
                          {!m.student?.isAnonymous && m.student?.isRepresentative && <span className="mr-1 text-[7px] text-emerald-400">👑</span>}
                        </span>
                      )}

                      {/* Bubble */}
                      <div
                        onClick={() => setMenuId(isMenuOpen ? null : m.id)}
                        className={`relative px-3.5 py-2.5 rounded-2xl cursor-pointer select-none transition-all active:scale-[0.97] shadow-lg ${
                          mine
                            ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-slate-950 rounded-br-md'
                            : 'bg-[#1e2a42] border border-white/8 text-slate-100 rounded-bl-md'
                        }`}
                      >
                        <p className="text-[12px] font-medium leading-relaxed whitespace-pre-wrap" dir="rtl">
                          {m.content}
                        </p>

                        {/* Time + read status */}
                        <div className={`flex items-center gap-1.5 mt-1.5 ${mine ? 'justify-end' : 'justify-start'}`}>
                          <span className={`text-[9px] font-mono font-bold ${mine ? 'text-slate-900/60' : 'text-slate-500'}`}>{time}</span>
                          {mine && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setMsgInfo(m); }}
                              className="flex items-center gap-0.5"
                            >
                              <span className="text-[10px] text-sky-300 font-black">✓✓</span>
                            </button>
                          )}
                        </div>

                        {/* Context menu */}
                        <AnimatePresence>
                          {isMenuOpen && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8, y: 6 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.8, y: 6 }}
                              className={`absolute z-30 bottom-full mb-2 ${mine ? 'right-0' : 'left-0'} bg-[#1a2540] border border-white/15 rounded-2xl p-1.5 flex gap-1 shadow-2xl backdrop-blur-xl`}
                            >
                              {['👍', '❤️', '💡', '🔥', '🚀'].map((em, i) => (
                                <button key={i} type="button" onClick={(e) => { e.stopPropagation(); toast.success(isAr ? `تفاعلت بـ ${em}` : `Reacted ${em}`); setMenuId(null); }}
                                  className="w-8 h-8 flex items-center justify-center text-sm hover:scale-125 transition-transform rounded-xl">
                                  {em}
                                </button>
                              ))}
                              {mine && <>
                                <button onClick={(e) => { e.stopPropagation(); setMsgInfo(m); setMenuId(null); }}
                                  className="px-2 h-8 text-[9px] font-black text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded-xl hover:bg-amber-500/25">
                                  ℹ️
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeletePost(m.id); setMenuId(null); }}
                                  className="w-8 h-8 flex items-center justify-center text-red-400 text-xs hover:bg-red-500/15 rounded-xl">
                                  🗑️
                                </button>
                              </>}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* My avatar */}
                    {mine && (
                      <div className="w-7 h-7 rounded-2xl bg-gradient-to-br from-[var(--accent)]/30 to-slate-800 border border-[var(--accent)]/40 flex items-center justify-center font-black text-[9px] text-[var(--accent)] shrink-0 mb-0.5">
                        {initials(profile?.name)}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* ── CHAT INPUT BAR — pinned bottom ── */}
          <div className="shrink-0 border-t border-white/8 bg-[#0d1526]/95 backdrop-blur-xl px-3 py-3">
            <form onSubmit={sendMsg} className="flex items-center gap-2">
              {/* Anon toggle */}
              <button type="button" onClick={() => setAnon(!anon)}
                className={`w-10 h-10 rounded-2xl flex items-center justify-center border text-sm transition-all shrink-0 ${anon ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-white/5 border-white/10 text-slate-500 hover:text-slate-300'}`}
                title={isAr ? 'إرسال كمجهول' : 'Anonymous'}>
                🕵️
              </button>

              {/* Text input */}
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={msg}
                  onChange={e => setMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMsg(e)}
                  placeholder={isAr ? 'اكتب رسالة للشعبة...' : 'Message your class...'}
                  className="w-full bg-[#1e2a42] border border-white/10 rounded-2xl px-4 py-2.5 text-[12px] text-white placeholder-slate-500 focus:outline-none focus:border-[var(--accent)]/60 font-medium transition-all"
                  dir="rtl"
                />
              </div>

              {/* Send Button */}
              <button
                type="submit"
                disabled={sending || !msg.trim()}
                className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-slate-950 flex items-center justify-center text-lg shadow-lg shrink-0 transition-all active:scale-95 disabled:opacity-40"
              >
                {sending ? <div className="w-4 h-4 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" /> : '➤'}
              </button>
            </form>

            {/* Anon badge */}
            {anon && (
              <p className="text-[9px] text-amber-400 font-bold text-center mt-1.5">
                🕵️ {isAr ? 'وضع المجهول مفعّل — لن يظهر اسمك' : 'Anonymous mode — your name is hidden'}
              </p>
            )}
          </div>
        </>
      )}

      {/* ════════════════════════════
           VIEW: FORUM
      ═════════════════════════════ */}
      {view === 'forum' && (
        <>
          {/* Forum controls bar */}
          <div className="px-3 py-2.5 border-b border-white/8 bg-[#0d1526]/60 backdrop-blur-md shrink-0 space-y-2">
            <div className="flex gap-2">
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={isAr ? 'بحث في المواضيع...' : 'Search threads...'}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[11px] text-white placeholder-slate-500 focus:outline-none focus:border-[var(--accent)] font-medium"
              />
              <button type="button" onClick={() => setNewPostModal(true)}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-[11px] rounded-xl shrink-0 active:scale-95 shadow-lg transition-all">
                + {isAr ? 'موضوع' : 'New'}
              </button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {[{ id: 'ALL', l: isAr ? 'الكل' : 'All' }, { id: 'QUESTION', l: isAr ? 'أسئلة' : 'Questions' }, { id: 'RESOURCE', l: isAr ? 'مراجع' : 'Resources' }, { id: 'HELP', l: isAr ? 'مساعدة' : 'Help' }].map(c => (
                <button key={c.id} onClick={() => setCatFilter(c.id)}
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-black whitespace-nowrap transition-all shrink-0 ${catFilter === c.id ? 'bg-[var(--accent)] text-slate-950' : 'bg-white/6 text-slate-400'}`}>
                  {c.l}
                </button>
              ))}
            </div>
          </div>

          {/* Forum posts list */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 min-h-0">
            {postsLoading ? (
              <div className="flex items-center justify-center h-full gap-2 text-xs text-slate-500">
                <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : forumPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-500">
                <span className="text-4xl">📚</span>
                <p className="text-xs font-black text-center">{isAr ? 'لا توجد مواضيع. أضف أول موضوع!' : 'No threads yet. Create one!'}</p>
              </div>
            ) : forumPosts.map(post => (
              <div key={post.id} onClick={() => { setSelectedPost(post); fetchPostDetails?.(post.id); }}
                className="p-3.5 rounded-2xl bg-[#1e2a42] border border-white/8 hover:border-[var(--accent)]/35 cursor-pointer space-y-2 shadow-md transition-all group active:scale-[0.99]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-2xl bg-gradient-to-br from-[var(--accent)]/20 to-slate-800 border border-white/10 flex items-center justify-center font-black text-[9px] text-white shrink-0">
                      {post.student?.isAnonymous ? '🕵' : initials(post.student?.name)}
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-white">
                        {post.student?.isAnonymous ? (isAr ? 'مجهول' : 'Anon') : post.student?.name}
                        {post.student?.isRepresentative && !post.student?.isAnonymous && <span className="mr-1 text-[8px] text-emerald-400">👑</span>}
                      </p>
                      <p className="text-[8px] text-slate-500 font-medium" dir="ltr">{fmtTime(post.createdAt)}</p>
                    </div>
                  </div>
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-xl border ${catBadge(post.category)}`}>{catLabel(post.category)}</span>
                </div>
                <p className="text-[11px] font-black text-white group-hover:text-[var(--accent)] transition-colors">{post.title}</p>
                <p className="text-[10px] text-slate-400 line-clamp-2 font-medium leading-relaxed">{post.content}</p>
                <div className="flex items-center justify-between text-[9px] font-bold text-slate-500 pt-1 border-t border-white/5">
                  <span>💬 {post._count?.comments || 0}</span>
                  <span className="text-[var(--accent)] group-hover:translate-x-1 transition-transform">{isAr ? 'فتح ←' : 'Open →'}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ════ MESSAGE INFO MODAL ════ */}
      <AnimatePresence>
        {msgInfo && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-md" dir={isAr ? 'rtl' : 'ltr'}
            onClick={() => setMsgInfo(null)}>
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-[430px] bg-[#111c35] border-t border-white/10 rounded-t-[28px] p-5 space-y-4 shadow-2xl"
            >
              <div className="flex justify-between items-center border-b border-white/8 pb-3">
                <h3 className="text-xs font-black text-amber-300 uppercase tracking-wider">ℹ️ {isAr ? 'معلومات الرسالة' : 'Message Info'}</h3>
                <button onClick={() => setMsgInfo(null)} className="text-slate-400 hover:text-white text-sm">✕</button>
              </div>
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-[10px] font-black text-amber-400 mb-1">{isAr ? 'الرسالة' : 'Message'}</p>
                <p className="text-xs text-white font-medium leading-relaxed">{msgInfo.content}</p>
              </div>
              <div className="space-y-3 text-xs">
                {[
                  { label: isAr ? 'قُرئت بواسطة' : 'Read by', icon: '✓✓', color: 'text-sky-400', list: [
                    { n: isAr ? 'محمد الغالب' : 'Mohammed G.', av: '👨‍🎓', t: fmtTime(msgInfo.createdAt) },
                    { n: isAr ? 'سارة خالد' : 'Sara K.', av: '👩‍🎓', t: fmtTime(msgInfo.createdAt) },
                  ]},
                  { label: isAr ? 'تم التسليم' : 'Delivered', icon: '✓✓', color: 'text-slate-400', list: [
                    { n: isAr ? 'أحمد علي' : 'Ahmed A.', av: '👨‍💻', t: fmtTime(msgInfo.createdAt) },
                    { n: isAr ? 'فاطمة عبده' : 'Fatima A.', av: '👩‍🏫', t: fmtTime(msgInfo.createdAt) },
                    { n: isAr ? 'عمر فاروق' : 'Omar F.', av: '👨‍🔬', t: fmtTime(msgInfo.createdAt) },
                  ]},
                ].map((sec, si) => (
                  <div key={si} className="space-y-1.5">
                    <div className="flex items-center gap-1.5 pb-1 border-b border-white/6">
                      <span className={`font-black ${sec.color}`}>{sec.icon}</span>
                      <span className="font-black text-white">{sec.label}</span>
                      <span className={`font-mono text-[10px] ${sec.color} mr-auto`}>{sec.list.length}</span>
                    </div>
                    {sec.list.map((item, ii) => (
                      <div key={ii} className="flex items-center justify-between p-2 rounded-xl bg-white/4 border border-white/5">
                        <div className="flex items-center gap-2">
                          <span>{item.av}</span>
                          <span className="font-bold text-[11px] text-white">{item.n}</span>
                        </div>
                        <span className="text-[9px] text-slate-400 font-mono">{item.t}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ════ NEW THREAD MODAL ════ */}
      <AnimatePresence>
        {newPostModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-md" dir={isAr ? 'rtl' : 'ltr'}>
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="w-full max-w-[430px] bg-[#111c35] border-t border-white/10 rounded-t-[28px] p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-white/8 pb-3">
                <h3 className="text-xs font-black text-white uppercase tracking-wider">+ {isAr ? 'موضوع جديد' : 'New Thread'}</h3>
                <button onClick={() => setNewPostModal(false)} className="text-slate-400 hover:text-white text-sm">✕</button>
              </div>
              <form onSubmit={async (e) => { e.preventDefault(); const ok = await handleCreatePost(nTitle, nContent, nCat, nAnon); if (ok) { setNewPostModal(false); setNTitle(''); setNContent(''); setNCat('GENERAL'); setNAnon(false); } }} className="space-y-3 text-xs font-bold">
                <div className="space-y-1">
                  <label className="text-slate-400">{isAr ? 'عنوان الموضوع' : 'Title'}</label>
                  <input required value={nTitle} onChange={e => setNTitle(e.target.value)}
                    placeholder={isAr ? 'اكتب عنواناً واضحاً...' : 'Clear title...'}
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[var(--accent)] font-medium" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">{isAr ? 'التصنيف' : 'Category'}</label>
                  <select value={nCat} onChange={e => setNCat(e.target.value)}
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none font-bold">
                    <option value="GENERAL">{isAr ? 'عام' : 'General'}</option>
                    <option value="QUESTION">{isAr ? 'سؤال ❓' : 'Question'}</option>
                    <option value="RESOURCE">{isAr ? 'مرجع 📚' : 'Resource'}</option>
                    <option value="HELP">{isAr ? 'مساعدة 🆘' : 'Help'}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">{isAr ? 'التفاصيل' : 'Content'}</label>
                  <textarea required rows={4} value={nContent} onChange={e => setNContent(e.target.value)}
                    placeholder={isAr ? 'اشرح الموضوع بالتفصيل...' : 'Describe the topic...'}
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-[var(--accent)] font-medium resize-none" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={nAnon} onChange={e => setNAnon(e.target.checked)} className="accent-[var(--accent)] h-4 w-4 rounded" />
                  <span className="text-slate-300">🕵️ {isAr ? 'نشر بهوية مجهولة' : 'Post anonymously'}</span>
                </label>
                <div className="flex gap-2 pt-2 border-t border-white/8">
                  <button type="button" onClick={() => setNewPostModal(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-slate-300 font-black text-xs">{isAr ? 'إلغاء' : 'Cancel'}</button>
                  <button type="submit" disabled={postSubmitting} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs shadow-lg disabled:opacity-50">
                    {postSubmitting ? (isAr ? 'نشر...' : 'Posting...') : (isAr ? 'نشر الموضوع 🚀' : 'Post 🚀')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ════ AI CO-PILOT MODAL ════ */}
      <AnimatePresence>
        {aiOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-md" dir={isAr ? 'rtl' : 'ltr'}>
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
              className="w-full max-w-[430px] bg-[#111c35] border-t border-white/10 rounded-t-[28px] p-5 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-white/8 pb-3">
                <h3 className="text-xs font-black text-emerald-400 uppercase tracking-wider">🤖 {isAr ? 'مساعد AI الأكاديمي' : 'AI Study Co-Pilot'}</h3>
                <button onClick={() => setAiOpen(false)} className="text-slate-400 hover:text-white text-sm">✕</button>
              </div>
              <div className="space-y-3 text-xs font-bold">
                <div className="space-y-1">
                  <label className="text-slate-400">{isAr ? 'اسم المادة' : 'Subject'}</label>
                  <input value={aiSubject} onChange={e => setAiSubject(e.target.value)}
                    placeholder={isAr ? 'مثال: ذكاء اصطناعي، شبكات...' : 'e.g. AI, Networks...'}
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-medium" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">{isAr ? 'موضوع الشرح (اختياري)' : 'Explain topic (optional)'}</label>
                  <input value={aiTopic} onChange={e => setAiTopic(e.target.value)}
                    placeholder={isAr ? 'مثال: خوارزميات الـ BFS...' : 'e.g. BFS algorithm...'}
                    className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 font-medium" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={genQuiz} disabled={aiLoading}
                    className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-black flex items-center justify-center gap-1.5 hover:bg-emerald-500/25 active:scale-95 disabled:opacity-50 transition-all">
                    {aiLoading ? <div className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /> : <>⚡ {isAr ? 'كويز' : 'Quiz'}</>}
                  </button>
                  <button type="button" onClick={genExplain} disabled={aiLoading}
                    className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-black flex items-center justify-center gap-1.5 hover:bg-amber-500/25 active:scale-95 disabled:opacity-50 transition-all">
                    {aiLoading ? <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /> : <>💡 {isAr ? 'شرح' : 'Explain'}</>}
                  </button>
                </div>
                {aiQuiz.length > 0 && (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/20 space-y-3">
                    <p className="font-black text-emerald-400">{isAr ? 'أسئلة الكويز' : 'Quiz Questions'}</p>
                    {aiQuiz.map((q, i) => (
                      <div key={i} className="space-y-1.5">
                        <p className="font-bold text-white">{i + 1}. {q.question}</p>
                        {q.options && <div className="grid grid-cols-2 gap-1">{q.options.map((o, j) => <div key={j} className="p-2 rounded-xl bg-white/5 text-[10px] text-slate-300 font-medium">{o}</div>)}</div>}
                      </div>
                    ))}
                  </div>
                )}
                {aiExplain && (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/20 space-y-2">
                    <p className="font-black text-amber-300">{isAr ? 'الشرح التفصيلي' : 'AI Explanation'}</p>
                    <p className="text-[11px] text-slate-200 whitespace-pre-line leading-relaxed font-medium">{aiExplain}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
