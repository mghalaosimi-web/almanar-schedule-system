/**
 * @file ExchangeHubTab.jsx
 * @description تبويب ملتقى الدفعة (Class Exchange Hub) في بوابة الطالب.
 * يتيح للطلاب كتابة المنشورات وتصنيفها والمشاركة بالتعليقات وحل الأسئلة وتبادل المراجع الدراسية.
 * @author أنتيجرافيتي (Antigravity)
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { API_URL } from '../../config';

/**
 * مكون ملتقى الدفعة والنقاشات الطلابية.
 */
export default function ExchangeHubTab({
  isAr,
  profile,
  posts,
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
  // ── Tab state: 'chat' (Live Group Chat) or 'forum' (Academic Forum) ──
  const [exchangeTab, setExchangeTab] = useState('chat');
  const [exchangeSearch, setExchangeSearch] = useState('');
  const [exchangeCategoryFilter, setExchangeCategoryFilter] = useState('ALL');
  const [isNewPostModalOpen, setIsNewPostModalOpen] = useState(false);

  // New Post Form States
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostCategory, setNewPostCategory] = useState('GENERAL');
  const [newPostIsAnonymous, setNewPostIsAnonymous] = useState(false);

  // Comment Form States
  const [newCommentText, setNewCommentText] = useState('');
  const [newCommentIsAnonymous, setNewCommentIsAnonymous] = useState(false);

  // Group Chat Input States
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatIsAnonymous, setChatIsAnonymous] = useState(false);

  // Smart Summary states
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  const handleSummarizeChat = async () => {
    setSummaryLoading(true);
    setSummary('');
    setIsSummaryOpen(true);
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.post(`${API_URL}/api/exchange/posts/summarize`, {}, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.data?.success) {
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error(err);
      toast.error(isAr ? 'فشل تلخيص المحادثة' : 'Failed to summarize chat');
      setIsSummaryOpen(false);
    } finally {
      setSummaryLoading(false);
    }
  };

  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Retrieve current student ID for permission matching
  const studentJson = localStorage.getItem('manar_user');
  let currentStudentId = null;
  if (studentJson) {
    try {
      currentStudentId = JSON.parse(studentJson).id;
    } catch {}
  }

  const handleVotePoll = async (postId, optionIdx) => {
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.post(`${API_URL}/api/exchange/posts/${postId}/poll/vote`, {
        optionIdx
      }, { headers: { Authorization: `Bearer ${token}` } });

      if (res.data?.success) {
        toast.success(isAr ? 'تم تسجيل تصويتك بنجاح!' : 'Vote recorded successfully!');
        const { pollId, votes, votedOptionIdx } = res.data.data;
        if (setSelectedPost) {
          setSelectedPost(prev => {
            if (!prev || !prev.poll || prev.poll.id !== pollId) return prev;
            return {
              ...prev,
              poll: {
                ...prev.poll,
                votes,
                votedOptionIdx
              }
            };
          });
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || (isAr ? 'فشل تسجيل التصويت' : 'Failed to record vote'));
    }
  };

  const handleToggleVerifyComment = async (commentId, currentIsVerified) => {
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.put(`${API_URL}/api/exchange/comments/${commentId}/verify`, {
        isVerified: !currentIsVerified
      }, { headers: { Authorization: `Bearer ${token}` } });

      if (res.data?.success) {
        toast.success(isAr ? 'تم تحديث حالة الإجابة المعتمدة!' : 'Verified status updated!');
        if (setSelectedPost) {
          setSelectedPost(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              comments: (prev.comments || []).map(c => c.id === commentId ? { ...c, isVerified: !currentIsVerified } : c)
            };
          });
        }
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.error || (isAr ? 'فشل التوثيق' : 'Failed to update verified answer'));
    }
  };

  // Scroll to bottom on load and whenever posts or exchangeTab changes
  useEffect(() => {
    if (exchangeTab === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [posts, exchangeTab]);

  const getCategoryBadgeClass = (category) => {
    switch (category) {
      case 'QUESTION':
        return 'bg-blue-500/10 border-blue-500/20 text-blue-400';
      case 'RESOURCE':
        return 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400';
      case 'HELP':
        return 'bg-red-500/10 border-red-500/25 text-red-400';
      case 'GENERAL':
      default:
        return 'bg-slate-500/10 border-slate-500/25 text-slate-400';
    }
  };

  const getCategoryLabel = (category) => {
    switch (category) {
      case 'QUESTION': return t('exchange.catQuestion') || (isAr ? 'سؤال' : 'Question');
      case 'RESOURCE': return t('exchange.catResource') || (isAr ? 'مرجع دراسي' : 'Resource');
      case 'HELP': return t('exchange.catHelp') || (isAr ? 'طلب مساعدة' : 'Help Request');
      case 'GENERAL':
      default: return t('exchange.catGeneral') || (isAr ? 'نقاش عام' : 'General');
    }
  };

  // ── Send instant group chat message ──
  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isSendingChat) return;
    try {
      setIsSendingChat(true);
      // Use category 'GENERAL' to represent group chat messages
      const success = await handleCreatePost(
        `chat_${Date.now()}`,
        chatInput.trim(),
        'GENERAL',
        chatIsAnonymous
      );
      if (success) {
        setChatInput('');
      }
    } catch (err) {
      console.error('Failed to send group chat message:', err);
    } finally {
      setIsSendingChat(false);
    }
  };

  // Filter posts based on forum view (Academic only: QUESTION, RESOURCE, HELP)
  const forumPosts = posts.filter(post => post.category !== 'GENERAL');
  
  const filteredPosts = forumPosts.filter(post => {
    const matchesCategory = exchangeCategoryFilter === 'ALL' || post.category === exchangeCategoryFilter;
    const matchesSearch = !exchangeSearch.trim() || 
      (post.title || '').toLowerCase().includes(exchangeSearch.toLowerCase()) || 
      (post.content || '').toLowerCase().includes(exchangeSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Chat messages (Category GENERAL, sorted oldest to newest)
  const chatMessages = posts
    .filter(post => post.category === 'GENERAL')
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const onCreatePostSubmit = async (e) => {
    e.preventDefault();
    if (!newPostTitle.trim() || !newPostContent.trim()) return;
    const success = await handleCreatePost(newPostTitle, newPostContent, newPostCategory, newPostIsAnonymous);
    if (success) {
      setIsNewPostModalOpen(false);
      setNewPostTitle('');
      setNewPostContent('');
      setNewPostCategory('GENERAL');
      setNewPostIsAnonymous(false);
    }
  };

  const onCreateCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    const success = await handleCreateComment(newCommentText, newCommentIsAnonymous);
    if (success) {
      setNewCommentText('');
      setNewCommentIsAnonymous(false);
    }
  };

  // ── Case: Single Thread Detail View ──
  if (selectedPost) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedPost(null)}
            className="p-2 rounded-xl text-slate-400 hover:text-white flex items-center gap-1.5 text-xs font-bold transition-all"
          >
            {isAr ? '← العودة لملتقى الدفعة' : '← Back to Hub'}
          </button>
        </div>

        <div
          className="frosted-panel rounded-3xl p-5 border border-white/5 bg-white/2 space-y-4"
          style={{ background: 'var(--bg-card, #121824)', border: '1px solid var(--border-card, rgba(255,255,255,0.05))' }}
        >
          <div className="flex justify-between items-start gap-3">
            <div className="flex items-center gap-3">
              {selectedPost.student?.isAnonymous ? (
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-lg shrink-0">
                  🕵️
                </div>
              ) : selectedPost.student?.idPhotoUrl ? (
                <img
                  src={selectedPost.student.idPhotoUrl}
                  alt={selectedPost.student.name}
                  className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-white/10 to-white/5 border border-white/10 flex items-center justify-center font-black text-xs text-white shrink-0">
                  {selectedPost.student?.name ? selectedPost.student.name.split(' ').slice(0, 2).map(n => n[0]).join('') : 'ST'}
                </div>
              )}
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-white">
                    {selectedPost.student?.isAnonymous ? (isAr ? 'طالب مجهول' : 'Anonymous Student') : selectedPost.student?.name}
                  </span>
                  {!selectedPost.student?.isAnonymous && selectedPost.student?.isRepresentative && (
                    <span className="text-[8px] font-black uppercase bg-[#00f59b]/10 border border-[#00f59b]/25 text-[#00f59b] px-1.5 py-0.5 rounded">
                      {isAr ? 'مندوب' : 'Rep'}
                    </span>
                  )}
                </div>
                <span className="text-[9px] text-slate-500 font-semibold block mt-0.5" dir="ltr">
                  {new Date(selectedPost.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${getCategoryBadgeClass(selectedPost.category)}`}>
                {getCategoryLabel(selectedPost.category)}
              </span>
              {selectedPost.isMine && (
                <button
                  onClick={() => handleDeletePost(selectedPost.id)}
                  className="p-1.5 rounded bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 text-red-400 text-xs transition-colors"
                  title={isAr ? 'حذف المنشور' : 'Delete Post'}
                >
                  🗑️
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-extrabold text-white leading-snug">{selectedPost.title}</h3>
            <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed font-medium">
              {selectedPost.content}
            </p>

            {/* Poll Widget */}
            {selectedPost.poll && (
              <div className="bg-[var(--bg-elevated)] p-3.5 rounded-2xl border border-[var(--border-color)] my-3 font-sans">
                <p className="mb-2 font-bold text-xs text-white flex items-center gap-1.5">
                  <span>📊</span> {selectedPost.poll.question}
                </p>
                <div className="space-y-2">
                  {selectedPost.poll.options.map((optText, idx) => {
                    const totalVotes = selectedPost.poll.votes?.length || 0;
                    const optVotes = selectedPost.poll.votes?.filter(v => v.optionIdx === idx).length || 0;
                    const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
                    const isSelected = selectedPost.poll.votedOptionIdx === idx;
                    const hasVoted = selectedPost.poll.votedOptionIdx !== undefined && selectedPost.poll.votedOptionIdx !== null;

                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={hasVoted}
                        onClick={() => handleVotePoll(selectedPost.id, idx)}
                        className={`w-full bg-[#0b1120] border rounded-xl p-2.5 text-right relative overflow-hidden group transition-all ${
                          isSelected 
                            ? 'border-[#f59e0b] shadow-[0_0_10px_rgba(245,158,11,0.2)]' 
                            : hasVoted
                              ? 'border-slate-700/50 opacity-90'
                              : 'border-slate-600 hover:border-[#f59e0b]'
                        }`}
                      >
                        <div 
                          className="absolute left-0 top-0 bottom-0 bg-[#f59e0b]/20 transition-all duration-500 z-0" 
                          style={{ width: `${pct}%` }} 
                        />
                        <div className="relative z-10 flex justify-between text-xs font-bold text-white">
                          <span className="flex items-center gap-1">
                            {optText}
                            {isSelected && <span className="text-[#f59e0b]"> ({isAr ? 'تصويتك ✓' : 'Your Vote ✓'})</span>}
                          </span>
                          <span className="font-mono">{pct}%</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="text-[10px] text-slate-400 mt-2.5 text-center font-bold">
                  {isAr ? `إجمالي أصوات الطلاب: ${selectedPost.poll.votes?.length || 0}` : `Total student votes: ${selectedPost.poll.votes?.length || 0}`}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider px-1">
            {t('exchange.commentsCount') || (isAr ? 'التعليقات والمناقشات' : 'Comments')} ({selectedPost.comments?.length || 0})
          </h4>

          {selectedPost.comments && selectedPost.comments.length > 0 ? (
            <div className="space-y-3">
              {selectedPost.comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`frosted-panel rounded-2xl p-4 border space-y-2.5 ${
                    comment.isVerified
                      ? 'border-emerald-500/50 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                      : 'border-white/5 bg-white/1'
                  }`}
                  style={{ background: 'var(--bg-card, #121824)' }}
                >
                  {/* Verified Answer Badge Header */}
                  {comment.isVerified && (
                    <div className="self-end bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full text-[9px] font-bold flex items-center gap-1 mb-2 w-fit">
                      <i className="ph-fill ph-check-circle"></i> {isAr ? 'إجابة معتمدة من الدكتور / المندوب' : 'Verified Answer'}
                    </div>
                  )}

                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2.5">
                      {comment.student?.isAnonymous ? (
                        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-sm shrink-0">
                          🕵️
                        </div>
                      ) : comment.student?.idPhotoUrl ? (
                        <img
                          src={comment.student.idPhotoUrl}
                          alt={comment.student.name}
                          className="w-8 h-8 rounded-lg object-cover border border-white/10 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-white/10 to-white/5 border border-white/10 flex items-center justify-center font-black text-[10px] text-white shrink-0">
                          {comment.student?.name ? comment.student.name.split(' ').slice(0, 2).map(n => n[0]).join('') : 'ST'}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-extrabold text-white">
                            {comment.student?.isAnonymous ? (isAr ? 'طالب مجهول' : 'Anonymous Student') : comment.student?.name}
                          </span>
                          {!comment.student?.isAnonymous && comment.student?.isRepresentative && (
                            <span className="text-[7px] font-black uppercase bg-[#00f59b]/10 border border-[#00f59b]/25 text-[#00f59b] px-1 py-0.2 rounded">
                              {isAr ? 'مندوب' : 'Rep'}
                            </span>
                          )}
                        </div>
                        <span className="text-[8px] text-slate-500 font-semibold block mt-0.5" dir="ltr">
                          {new Date(comment.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {(profile?.isRepresentative || profile?.role === 'ADMIN') && (
                        <button
                          type="button"
                          onClick={() => handleToggleVerifyComment(comment.id, comment.isVerified)}
                          className={`text-[9px] px-2 py-0.5 rounded border font-bold transition-all ${
                            comment.isVerified
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                              : 'bg-white/5 text-slate-400 border-white/10 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          {comment.isVerified ? (isAr ? '✓ إجابة معتمدة' : 'Verified') : (isAr ? '+ اعتماد الإجابة' : '+ Verify Answer')}
                        </button>
                      )}
                      {comment.isMine && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="p-1.5 rounded bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 text-red-400 text-[10px] transition-colors"
                          title={isAr ? 'حذف التعليق' : 'Delete Comment'}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-300 leading-normal font-medium pl-10 pr-2">
                    {comment.content}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-slate-500 font-bold text-xs bg-slate-900/10 border border-white/3 rounded-2xl">
              {t('exchange.noComments') || (isAr ? 'لا توجد تعليقات بعد. كن أول من يعلق!' : 'No comments yet. Write a comment!')}
            </div>
          )}

          {/* Comment Write Bar */}
          <form onSubmit={onCreateCommentSubmit} className="space-y-2 pt-2">
            <div className="flex gap-2 items-end">
              <textarea
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder={t('exchange.commentPlaceholder') || (isAr ? 'اكتب تعليقك الأكاديمي هنا...' : 'Write a comment...')}
                rows={2}
                className="flex-1 bg-slate-955/80 border border-white/5 rounded-xl p-3 text-xs text-slate-350 focus:outline-none focus:border-[#00f59b]/50 placeholder-slate-650 resize-none font-medium text-right font-sans"
                dir="rtl"
              />
              <button
                type="submit"
                disabled={commentSubmitting || !newCommentText.trim()}
                className="px-4 py-3 bg-[#00f59b] hover:bg-[#00d484] disabled:bg-slate-800 disabled:text-slate-500 text-slate-955 font-black text-xs rounded-xl transition-all shadow-lg shadow-[#00f59b]/10 whitespace-nowrap active:scale-95 duration-150 shrink-0 h-[46px] flex items-center justify-center"
              >
                {commentSubmitting ? (t('exchange.commenting') || (isAr ? 'جاري التعليق' : 'Commenting...')) : (t('exchange.commentBtn') || (isAr ? 'تعليق' : 'Comment'))}
              </button>
            </div>
            
            {/* خيار الهوية المجهولة للتعليق */}
            <div className="flex items-center gap-2 justify-start px-1 select-none">
              <input
                type="checkbox"
                id="isAnonymousComment"
                checked={newCommentIsAnonymous}
                onChange={(e) => setNewCommentIsAnonymous(e.target.checked)}
                className="accent-[var(--accent)] h-3.5 w-3.5 rounded border-white/10 bg-black cursor-pointer"
              />
              <label htmlFor="isAnonymousComment" className="text-[10px] text-slate-400 font-bold cursor-pointer">
                🕵️ {isAr ? 'تعليق بهوية مجهولة' : 'Comment anonymously'}
              </label>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── Main UI view ──
  return (
    <div className="space-y-4 flex flex-col h-full">
      
      {/* Header and Class Section Badge */}
      <div className="flex justify-between items-center gap-3">
        <div>
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-wider">
            {isAr ? `شعبة: ${profile.groupName || 'شعبتك الدارسية'}` : `Class: ${profile.groupName || 'Your Section'}`}
          </h3>
        </div>

        {/* Tab switcher: Live Group Chat vs Academic Threads */}
        <div className="flex bg-slate-955 border border-white/5 rounded-xl p-0.5 select-none">
          <button
            onClick={() => setExchangeTab('chat')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide transition-all ${
              exchangeTab === 'chat'
                ? 'bg-[#f59e0b] text-slate-950 shadow-md shadow-[#f59e0b]/10'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            💬 {isAr ? 'محادثة الدفعة' : 'Group Chat'}
          </button>
          <button
            onClick={() => setExchangeTab('forum')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide transition-all ${
              exchangeTab === 'forum'
                ? 'bg-[#f59e0b] text-slate-950 shadow-md shadow-[#f59e0b]/10'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📚 {isAr ? 'المنتدى الدراسي' : 'Academic Hub'}
          </button>
        </div>
      </div>

      {/* ── View 1: Live Group Chat Mode ── */}
      {exchangeTab === 'chat' && (
        <div className="flex flex-col h-[520px] bg-black/20 border border-white/5 rounded-3xl p-4 justify-between space-y-3 overflow-hidden relative">
          
          {/* Smart Summarizer Banner */}
          <div className="shrink-0 flex flex-col gap-2">
            <div className="flex justify-between items-center bg-[var(--bg-elevated)]/70 border border-[var(--border-color)] rounded-2xl p-2">
              <span className="text-[9px] text-slate-400 font-bold">
                {isAr ? 'احصل على ملخص سريع لآخر 50 رسالة' : 'Get quick summary of last 50 messages'}
              </span>
              <button
                type="button"
                onClick={handleSummarizeChat}
                disabled={summaryLoading}
                className="text-slate-950 bg-[#f59e0b] hover:bg-[#f59e0b]/90 font-black text-[9px] flex items-center gap-1 px-2.5 py-1.5 rounded-xl transition-all disabled:opacity-50 active:scale-95 shadow-md shadow-amber-500/10 shrink-0"
              >
                {summaryLoading ? (
                  <div className="h-3 w-3 border border-slate-950 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>✨</span>
                    {isAr ? 'الملخص الذكي' : 'Smart Summary'}
                  </>
                )}
              </button>
            </div>

            {isSummaryOpen && (
              <div className="bg-[#f59e0b]/10 border border-[#f59e0b]/30 p-3 rounded-2xl text-xs space-y-2 text-right relative">
                <div className="flex justify-between items-center border-b border-[#f59e0b]/20 pb-1.5 mb-1.5">
                  <span className="text-[10px] font-black text-[#f59e0b] uppercase tracking-wider flex items-center gap-1">
                    <span>✨</span> {isAr ? 'الملخص التلقائي للدردشة' : 'AI Chat Summary'}
                  </span>
                  <button type="button" onClick={() => setIsSummaryOpen(false)} className="text-[#f59e0b] font-bold text-[10px] hover:text-white transition-colors">✕</button>
                </div>
                {summaryLoading ? (
                  <p className="text-[10px] text-slate-400 text-center py-2 animate-pulse">{isAr ? 'جاري قراءة الرسائل وتوليد التلخيص...' : 'Analyzing conversation history...'}</p>
                ) : (
                  <p className="text-[10px] text-amber-100 leading-relaxed whitespace-pre-line font-medium">{summary}</p>
                )}
              </div>
            )}
          </div>

          {/* Chat Messages Container */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto space-y-3 pr-1 pl-1 no-scrollbar scroll-smooth"
          >
            {postsLoading ? (
              <div className="flex flex-col items-center justify-center h-full text-xs text-slate-500 gap-2">
                <div className="h-5 w-5 border-2 border-[#00f59b] border-t-transparent rounded-full animate-spin" />
                <span>{isAr ? 'جاري تحميل المحادثة...' : 'Loading messages...'}</span>
              </div>
            ) : chatMessages.length > 0 ? (
              chatMessages.map((msg) => {
                const isMine = msg.isMine;
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    {/* Other user's avatar */}
                    {!isMine && (
                      msg.student?.isAnonymous ? (
                        <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sm shrink-0 mt-0.5">
                          🕵️
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-white/10 to-white/5 border border-white/10 flex items-center justify-center font-black text-[10px] text-white shrink-0 shadow-sm mt-0.5">
                          {msg.student?.name ? msg.student.name.split(' ').slice(0, 2).map(n => n[0]).join('') : 'ST'}
                        </div>
                      )
                    )}

                    {/* Chat Bubble Card */}
                    <div className="flex flex-col space-y-1 max-w-[75%]">
                      {/* Name of sender (other user) */}
                      {!isMine && (
                        <div className="flex items-center gap-1 px-1">
                          <span className="text-[10px] font-black text-[#00f59b]">
                            {msg.student?.isAnonymous ? (isAr ? 'طالب مجهول' : 'Anonymous Student') : msg.student?.name}
                          </span>
                          {!msg.student?.isAnonymous && msg.student?.isRepresentative && (
                            <span className="text-[7px] font-bold uppercase bg-[#00f59b]/15 border border-[#00f59b]/30 text-[#00f59b] px-1 py-0.2 rounded">
                              {isAr ? 'مندوب' : 'Rep'}
                            </span>
                          )}
                        </div>
                      )}

                      <div
                        className={`rounded-2xl px-4 py-2.5 text-xs font-semibold leading-relaxed relative group ${
                          isMine
                            ? 'bg-gradient-to-r from-indigo-600/90 to-violet-600/90 border border-indigo-500/20 text-white rounded-tr-none shadow-md shadow-indigo-900/10'
                            : 'bg-slate-900/90 border border-slate-800/60 text-slate-200 rounded-tl-none'
                        }`}
                      >
                        <p className="whitespace-pre-line text-right font-medium" dir="rtl">{msg.content}</p>
                        
                        {/* Time and Actions */}
                        <div className="flex items-center justify-between gap-3 mt-1.5 border-t border-white/5 pt-1 text-[8px] text-white/40 font-bold">
                          <span dir="ltr">
                            {new Date(msg.createdAt).toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          </span>
                          
                          {/* Trash button for your own message */}
                          {isMine && (
                            <button
                              onClick={() => handleDeletePost(msg.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-[9px] hover:text-red-400 p-0.5"
                              title={isAr ? 'سحب الرسالة' : 'Delete Message'}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-3 text-slate-500">
                <span className="text-3xl block">💬</span>
                <p className="text-xs font-black">{isAr ? 'مرحباً بك في المحادثة الحية لشعبتك! ابدأ التحدث مع زملائك.' : 'Start the conversation in your class group chat!'}</p>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Send Input Box */}
          <form onSubmit={handleSendChatMessage} className="flex gap-2 items-center bg-slate-955 border border-white/5 rounded-2xl p-2">
            {/* زر الهوية المجهولة */}
            <button
              type="button"
              onClick={() => setChatIsAnonymous(prev => !prev)}
              className={`p-2 rounded-xl transition-all flex items-center justify-center shrink-0 text-sm h-9 w-9 ${
                chatIsAnonymous
                  ? 'bg-[#f59e0b]/10 border border-[#f59e0b]/35 text-[#f59e0b]'
                  : 'bg-white/5 border border-white/5 text-slate-500 hover:text-slate-300'
              }`}
              title={isAr ? 'تفعيل الهوية المجهولة' : 'Toggle anonymous mode'}
            >
              🕵️
            </button>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={isAr ? 'اكتب رسالتك للدفعة هنا...' : 'Type message to your class...'}
              className="flex-1 bg-transparent border-0 px-3 py-2 text-xs text-white focus:outline-none placeholder-slate-650 text-right font-sans"
              dir="rtl"
              disabled={isSendingChat}
            />
            <button
              type="submit"
              disabled={isSendingChat || !chatInput.trim()}
              className="px-4 py-2 bg-[#f59e0b] hover:bg-[#f59e0b]/90 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black text-xs rounded-xl transition-all shadow-md shadow-[#f59e0b]/15 whitespace-nowrap active:scale-95 duration-100"
            >
              {isSendingChat ? (isAr ? 'إرسال...' : 'Sending') : (isAr ? 'إرسال 🚀' : 'Send 🚀')}
            </button>
          </form>

        </div>
      )}

      {/* ── View 2: Academic Threads Forum Mode ── */}
      {exchangeTab === 'forum' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center gap-2">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">
              {isAr ? 'المنتدى الأكاديمي للدفعة' : 'Academic Class Forum'}
            </h4>
            <button
              onClick={() => setIsNewPostModalOpen(true)}
              className="px-3 py-1.5 bg-[#00f59b] hover:bg-[#00d484] text-slate-955 font-black text-[10px] rounded-lg active:scale-95 shadow-md shadow-[#00f59b]/20 whitespace-nowrap transition-transform"
            >
              ➕ {isAr ? 'منشور جديد' : 'New Post'}
            </button>
          </div>

          {/* Forum search input */}
          <div className="relative">
            <input
              type="text"
              value={exchangeSearch}
              onChange={(e) => setExchangeSearch(e.target.value)}
              placeholder={isAr ? 'البحث عن أسئلة أو مراجع بالمنتدى...' : 'Search forum threads...'}
              className="w-full bg-slate-955 border border-white/5 rounded-xl p-3 text-xs text-slate-350 focus:outline-none focus:border-[#00f59b]/50 text-right font-sans font-medium"
              dir="rtl"
            />
            <span className="absolute right-3.5 top-3.5 text-xs text-slate-500">🔍</span>
          </div>

          {/* Academic filters (No GENERAL/GENERAL is replaced by ALL for academic threads) */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar select-none">
            {[
              { id: 'ALL', label: isAr ? 'الكل' : 'All' },
              { id: 'QUESTION', label: isAr ? 'أسئلة دراسية' : 'Questions' },
              { id: 'RESOURCE', label: isAr ? 'مراجع ومستندات' : 'Resources' },
              { id: 'HELP', label: isAr ? 'طلبات مساعدة' : 'Help Requests' }
            ].map(cat => {
              const active = exchangeCategoryFilter === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setExchangeCategoryFilter(cat.id)}
                  className={`px-3.5 py-1.5 rounded-full text-[9px] font-black tracking-wide border whitespace-nowrap transition-all duration-200 active:scale-95 ${
                    active 
                      ? 'bg-[#00f59b] text-slate-955 border-[#00f59b] shadow-md shadow-[#00f59b]/15'
                      : 'bg-white/3 text-slate-400 border-white/5 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Academic thread list */}
          {postsLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-5 w-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredPosts.length > 0 ? (
            <div className="space-y-3">
              {filteredPosts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => {
                    setSelectedPost(post);
                    fetchPostDetails(post.id);
                  }}
                  className="frosted-panel rounded-3xl p-5 border border-white/5 bg-white/2 hover:bg-white/4 cursor-pointer active:scale-[0.99] transition-all duration-200 space-y-3 relative overflow-hidden group"
                  style={{ background: 'var(--bg-card, #121824)', border: '1px solid var(--border-card, rgba(255,255,255,0.05))' }}
                >
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-[var(--accent)]/5 rounded-full blur-3xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex justify-between items-center gap-2">
                    <div className="flex items-center gap-2.5">
                      {post.student?.isAnonymous ? (
                        <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-sm shrink-0">
                          🕵️
                        </div>
                      ) : post.student?.idPhotoUrl ? (
                        <img
                          src={post.student.idPhotoUrl}
                          alt={post.student.name}
                          className="w-8 h-8 rounded-lg object-cover border border-white/10 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-white/10 to-white/5 border border-white/10 flex items-center justify-center font-black text-[10px] text-white shrink-0">
                          {post.student?.name ? post.student.name.split(' ').slice(0, 2).map(n => n[0]).join('') : 'ST'}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] font-extrabold text-white">
                            {post.student?.isAnonymous ? (isAr ? 'طالب مجهول' : 'Anonymous Student') : post.student?.name}
                          </span>
                          {!post.student?.isAnonymous && post.student?.isRepresentative && (
                            <span className="text-[7px] font-black uppercase bg-[#00f59b]/10 border border-[#00f59b]/25 text-[#00f59b] px-1 py-0.2 rounded">
                              {isAr ? 'مندوب' : 'Rep'}
                            </span>
                          )}
                        </div>
                        <span className="text-[8px] text-slate-500 font-semibold block mt-0.5" dir="ltr">
                          {new Date(post.createdAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>

                    <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${getCategoryBadgeClass(post.category)}`}>
                      {getCategoryLabel(post.category)}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-white group-hover:text-[#00f59b] transition-colors leading-tight truncate text-right">
                      {post.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-semibold line-clamp-2 text-right">
                      {post.content}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 text-[9px] text-slate-500 font-black border-t border-white/3 pt-2 justify-end">
                    <span>{post._count?.comments || 0} {isAr ? 'تعليقات ومشاركات' : 'Comments'}</span>
                    <span>💬</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="frosted-panel rounded-3xl p-8 border border-white/5 bg-white/2 text-center space-y-4" style={{ background: 'var(--bg-card, #121824)', border: '1px solid var(--border-card, rgba(255,255,255,0.05))' }}>
              <span className="text-3xl block">💬</span>
              <h3 className="text-xs font-black text-slate-400">{isAr ? 'لا توجد مواضيع في هذا القسم بعد.' : 'No posts in this category yet.'}</h3>
            </div>
          )}
        </div>
      )}

      {/* ── Thread Creation Modal ── */}
      <AnimatePresence>
        {isNewPostModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="frosted-panel w-full max-w-sm rounded-3xl p-6 shadow-2xl space-y-5 text-white bg-slate-900 border border-slate-800"
              style={{ background: 'var(--bg-card, #121824)', border: '1px solid var(--border-card, rgba(255,255,255,0.05))' }}
            >
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#00f59b]">
                  📝 {isAr ? 'إنشاء موضوع مناقشة جديد' : 'Create New Thread'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsNewPostModalOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors text-lg leading-none"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={onCreatePostSubmit} className="space-y-4 text-xs font-bold text-right" dir="rtl">
                <div className="space-y-1">
                  <label className="text-slate-400 block text-right">{isAr ? 'التصنيف / الوسم' : 'Thread Category'}</label>
                  <select
                    value={newPostCategory}
                    onChange={(e) => setNewPostCategory(e.target.value)}
                    className="w-full bg-slate-955 border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#00f59b]/50 cursor-pointer font-bold text-right"
                  >
                    <option value="QUESTION">{isAr ? 'سؤال دراسي' : 'Question'}</option>
                    <option value="RESOURCE">{isAr ? 'مراجع ومستندات' : 'Resource'}</option>
                    <option value="HELP">{isAr ? 'طلب مساعدة عاجلة' : 'Help Request'}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block text-right">{isAr ? 'عنوان الموضوع' : 'Post Title'}</label>
                  <input
                    type="text"
                    required
                    value={newPostTitle}
                    onChange={(e) => setNewPostTitle(e.target.value)}
                    placeholder={isAr ? 'اكتب عنواناً معبراً وقصيراً...' : 'Post title...'}
                    className="w-full bg-slate-955 border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#00f59b]/50 text-right font-sans font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block text-right">{isAr ? 'تفاصيل ومحتوى الموضوع' : 'Content Description'}</label>
                  <textarea
                    required
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder={isAr ? 'اكتب بالتفصيل ما تريد مشاركته أو السؤال عنه هنا...' : 'Post description...'}
                    rows={4}
                    className="w-full bg-slate-955 border border-white/5 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-[#00f59b]/50 resize-none text-right font-sans font-medium"
                  />
                </div>

                {/* خيار الهوية المجهولة */}
                <div className="flex items-center gap-2 py-1 justify-start select-none">
                  <input
                    type="checkbox"
                    id="isAnonymousForum"
                    checked={newPostIsAnonymous}
                    onChange={(e) => setNewPostIsAnonymous(e.target.checked)}
                    className="accent-[var(--accent)] h-4 w-4 rounded border-white/10 bg-black cursor-pointer"
                  />
                  <label htmlFor="isAnonymousForum" className="text-slate-350 cursor-pointer select-none">
                    🕵️ {isAr ? 'نشر بهوية مجهولة (طالب مجهول)' : 'Post anonymously'}
                  </label>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setIsNewPostModalOpen(false)}
                    className="btn-ghost px-4 py-2.5 text-xs font-bold rounded-lg hover:bg-white/5"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={postSubmitting}
                    className="px-5 py-2.5 text-xs font-black rounded-lg bg-[#00f59b] text-slate-955 hover:bg-[#00d484] transition-colors"
                  >
                    {postSubmitting ? (isAr ? 'جاري النشر...' : 'Submitting...') : (isAr ? 'نشر الموضوع' : 'Publish')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
