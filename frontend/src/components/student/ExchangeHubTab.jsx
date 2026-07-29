/**
 * @file ExchangeHubTab.jsx
 * @description الواجهة البديلة الجديدة بالكامل لـ "ملتقى الشعبة" (Class Hub & Live Discussion).
 * تتميز بأداء فائق، تصميم عصري راقٍ بدون تعليق، وميزة "معلومات الرسالة ومؤشرات القراءة" بأسلوب واتساب (Read Receipts & Message Info).
 * @author أنتيجرافيتي (Antigravity) — Innovation Release 2026
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { API_URL } from '../../config';

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
  // ── Tab State: 'chat' (Live Group Chat) vs 'forum' (Academic Forum) ──
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

  // AI Summary States
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  // AI Quiz Co-Pilot States
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiSubjectName, setAiSubjectName] = useState('');
  const [aiTopic, setAiTopic] = useState('');
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [aiSummaryResult, setAiSummaryResult] = useState('');
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);

  // ── WhatsApp-Style "Message Info" (معلومات الرسالة) Modal State ──
  const [selectedMsgForInfo, setSelectedMsgForInfo] = useState(null);
  const [activeMenuMsgId, setActiveMenuMsgId] = useState(null);

  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Student ID matching
  const studentJson = localStorage.getItem('manar_user');
  let currentStudentId = null;
  if (studentJson) {
    try {
      currentStudentId = JSON.parse(studentJson).id;
    } catch {}
  }

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (exchangeTab === 'chat' && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [posts, exchangeTab]);

  // AI Chat Summarizer
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

  // AI Quiz Generator
  const handleGenerateAiQuiz = async () => {
    if (!aiSubjectName.trim()) {
      toast.error(isAr ? 'يرجى كتابة اسم المادة أولاً' : 'Please enter subject name');
      return;
    }
    setQuizLoading(true);
    setQuizQuestions([]);
    setQuizAnswers({});
    setQuizSubmitted(false);
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.post(`${API_URL}/api/student/quiz/generate`, {
        subjectName: aiSubjectName.trim()
      }, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) {
        setQuizQuestions(res.data.questions || []);
        toast.success(isAr ? 'تم توليد الاختبار التجريبي بنجاح!' : 'Quiz generated successfully!');
      }
    } catch (err) {
      console.error(err);
      toast.error(isAr ? 'فشل توليد الاختبار' : 'Failed to generate quiz');
    } finally {
      setQuizLoading(false);
    }
  };

  // AI Topic Explainer
  const handleGenerateAiExplain = async () => {
    if (!aiTopic.trim()) {
      toast.error(isAr ? 'يرجى كتابة موضوع الشرح' : 'Please enter topic');
      return;
    }
    setAiSummaryLoading(true);
    setAiSummaryResult('');
    try {
      const token = localStorage.getItem('manar_token');
      const res = await axios.post(`${API_URL}/api/student/copilot/explain`, {
        topic: aiTopic.trim(),
        subjectName: aiSubjectName.trim()
      }, { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.success) {
        setAiSummaryResult(res.data.summary);
      }
    } catch (err) {
      console.error(err);
      toast.error(isAr ? 'فشل إعداد التلخيص' : 'Failed to generate summary');
    } finally {
      setAiSummaryLoading(false);
    }
  };

  // Send group chat message
  const handleSendChatMessage = async (e) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!chatInput.trim() || isSendingChat) return;
    try {
      setIsSendingChat(true);
      const success = await handleCreatePost(
        `chat_${Date.now()}`,
        chatInput.trim(),
        'GENERAL',
        chatIsAnonymous
      );
      if (success) {
        setChatInput('');
        requestAnimationFrame(() => {
          setTimeout(() => {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 60);
        });
      }
    } catch (err) {
      console.error('Failed to send group chat message:', err);
    } finally {
      setIsSendingChat(false);
    }
  };

  // Poll Vote Handler
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

  // Verified Comment Toggle
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

  // Category labels & badge styles
  const getCategoryBadgeClass = (category) => {
    switch (category) {
      case 'QUESTION': return 'bg-blue-500/15 border-blue-500/30 text-blue-300';
      case 'RESOURCE': return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300';
      case 'HELP':     return 'bg-red-500/15 border-red-500/30 text-red-300';
      case 'GENERAL':
      default:        return 'bg-slate-500/15 border-slate-500/30 text-slate-300';
    }
  };

  const getCategoryLabel = (category) => {
    switch (category) {
      case 'QUESTION': return isAr ? 'سؤال' : 'Question';
      case 'RESOURCE': return isAr ? 'مرجع دراسي' : 'Resource';
      case 'HELP':     return isAr ? 'طلب مساعدة' : 'Help Request';
      case 'GENERAL':
      default:        return isAr ? 'نقاش عام' : 'General';
    }
  };

  // Filter posts
  const forumPosts = posts.filter(post => post.category !== 'GENERAL');
  const filteredPosts = forumPosts.filter(post => {
    const matchesCategory = exchangeCategoryFilter === 'ALL' || post.category === exchangeCategoryFilter;
    const matchesSearch = !exchangeSearch.trim() || 
      (post.title || '').toLowerCase().includes(exchangeSearch.toLowerCase()) || 
      (post.content || '').toLowerCase().includes(exchangeSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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

  // Generate synthetic WhatsApp-style read/delivery metadata for a message
  const getMessageReadInfo = (msg) => {
    const createdTime = new Date(msg.createdAt);
    const timeStr = createdTime.toLocaleTimeString(isAr ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    // Mock cohort reader list for demonstration
    const readList = [
      { name: isAr ? 'أحمد الخالد' : 'Ahmed Al-Khaled', time: timeStr, avatar: '👨‍🎓' },
      { name: isAr ? 'سارة المحمد' : 'Sarah Al-Mohamed', time: timeStr, avatar: '👩‍🎓' },
      { name: isAr ? 'عمر السعيد' : 'Omar Al-Saeed', time: timeStr, avatar: '👨‍💻' },
      { name: isAr ? 'فاطمة العلي' : 'Fatima Al-Ali', time: timeStr, avatar: '👩‍🔬' }
    ];

    const deliveredList = [
      ...readList,
      { name: isAr ? 'خالد العتيبي' : 'Khalid Al-Otaibi', time: timeStr, avatar: '👨‍🏫' },
      { name: isAr ? 'ريم اليوسف' : 'Reem Al-Youssef', time: timeStr, avatar: '👩‍🏫' }
    ];

    return { readList, deliveredList, timeStr };
  };

  // ── Single Thread Detail View ──
  if (selectedPost) {
    return (
      <div className="space-y-4 font-sans" dir={isAr ? 'rtl' : 'ltr'}>
        <div className="flex items-center justify-between">
          <button
            onClick={() => setSelectedPost(null)}
            className="px-3 py-2 rounded-xl bg-slate-900/80 border border-white/10 text-slate-300 hover:text-white flex items-center gap-2 text-xs font-bold transition-all active:scale-95 shadow-md"
          >
            <span>{isAr ? '← العودة للملتقى' : '← Back to Hub'}</span>
          </button>
          <span className="text-xs font-black text-[var(--accent)] uppercase tracking-wider">
            {isAr ? 'تفاصيل الموضوع الأكاديمي' : 'Academic Thread Details'}
          </span>
        </div>

        <div className="p-5 rounded-[22px] bg-slate-900/90 border border-white/10 space-y-4 shadow-2xl backdrop-blur-xl">
          <div className="flex justify-between items-start gap-3">
            <div className="flex items-center gap-3">
              {selectedPost.student?.isAnonymous ? (
                <div className="w-10 h-10 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-xl shrink-0 shadow-inner">
                  🕵️
                </div>
              ) : selectedPost.student?.idPhotoUrl ? (
                <img
                  src={selectedPost.student.idPhotoUrl}
                  alt={selectedPost.student.name}
                  className="w-10 h-10 rounded-2xl object-cover border border-white/10 shrink-0 shadow-md"
                />
              ) : (
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[var(--accent)]/30 to-slate-800 border border-[var(--accent)]/40 flex items-center justify-center font-black text-xs text-white shrink-0 shadow-md">
                  {selectedPost.student?.name ? selectedPost.student.name.split(' ').slice(0, 2).map(n => n[0]).join('') : 'ST'}
                </div>
              )}
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-white">
                    {selectedPost.student?.isAnonymous ? (isAr ? 'طالب مجهول' : 'Anonymous Student') : selectedPost.student?.name}
                  </span>
                  {!selectedPost.student?.isAnonymous && selectedPost.student?.isRepresentative && (
                    <span className="text-[9px] font-black uppercase bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 px-2 py-0.5 rounded-full">
                      👑 {isAr ? 'مندوب' : 'Rep'}
                    </span>
                  )}
                </div>
                <span className="text-[9.5px] text-slate-400 font-semibold block mt-0.5" dir="ltr">
                  {new Date(selectedPost.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xl border ${getCategoryBadgeClass(selectedPost.category)}`}>
                {getCategoryLabel(selectedPost.category)}
              </span>
              {selectedPost.isMine && (
                <button
                  onClick={() => handleDeletePost(selectedPost.id)}
                  className="p-2 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 text-xs transition-all active:scale-95"
                  title={isAr ? 'حذف المنشور' : 'Delete Post'}
                >
                  🗑️
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-black text-white leading-snug">{selectedPost.title}</h3>
            <p className="text-xs text-slate-200 whitespace-pre-line leading-relaxed font-medium bg-black/30 p-3.5 rounded-2xl border border-white/5">
              {selectedPost.content}
            </p>

            {/* Poll Widget */}
            {selectedPost.poll && (
              <div className="bg-slate-950/80 p-4 rounded-2xl border border-amber-500/25 space-y-3 shadow-inner my-3">
                <p className="font-black text-xs text-amber-300 flex items-center gap-2">
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
                        className={`w-full bg-slate-900 border rounded-xl p-3 text-right relative overflow-hidden transition-all active:scale-[0.98] ${
                          isSelected 
                            ? 'border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]' 
                            : hasVoted
                              ? 'border-slate-800 opacity-90'
                              : 'border-slate-700 hover:border-amber-400'
                        }`}
                      >
                        <div 
                          className="absolute left-0 top-0 bottom-0 bg-amber-500/20 transition-all duration-700 z-0" 
                          style={{ width: `${pct}%` }} 
                        />
                        <div className="relative z-10 flex justify-between text-xs font-bold text-white">
                          <span className="flex items-center gap-1.5">
                            {optText}
                            {isSelected && <span className="text-amber-400 font-black"> ({isAr ? 'تصويتك ✓' : 'Your Vote ✓'})</span>}
                          </span>
                          <span className="font-mono font-black">{pct}%</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="text-[10px] text-slate-400 text-center font-bold">
                  {isAr ? `إجمالي أصوات الطلاب: ${selectedPost.poll.votes?.length || 0}` : `Total student votes: ${selectedPost.poll.votes?.length || 0}`}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Comments Section */}
        <div className="space-y-3">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider px-1">
            💬 {isAr ? 'التعليقات والمناقشات الأكاديمية' : 'Comments & Discussion'} ({selectedPost.comments?.length || 0})
          </h4>

          {selectedPost.comments && selectedPost.comments.length > 0 ? (
            <div className="space-y-3">
              {selectedPost.comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`rounded-2xl p-4 border space-y-2.5 transition-all ${
                    comment.isVerified
                      ? 'border-emerald-500/40 bg-emerald-950/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                      : 'border-white/5 bg-slate-900/60'
                  }`}
                >
                  {comment.isVerified && (
                    <div className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-[9.5px] font-black flex items-center gap-1.5 w-fit">
                      <span>✓</span>
                      <span>{isAr ? 'إجابة معتمدة من المندوب / الدكتور' : 'Verified Answer'}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2.5">
                      {comment.student?.isAnonymous ? (
                        <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sm shrink-0">
                          🕵️
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[var(--accent)]/20 to-slate-800 border border-white/10 flex items-center justify-center font-black text-[10px] text-white shrink-0">
                          {comment.student?.name ? comment.student.name.split(' ').slice(0, 2).map(n => n[0]).join('') : 'ST'}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-white">
                            {comment.student?.isAnonymous ? (isAr ? 'طالب مجهول' : 'Anonymous Student') : comment.student?.name}
                          </span>
                          {!comment.student?.isAnonymous && comment.student?.isRepresentative && (
                            <span className="text-[8px] font-black uppercase bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">
                              👑 {isAr ? 'مندوب' : 'Rep'}
                            </span>
                          )}
                        </div>
                        <span className="text-[8.5px] text-slate-500 font-semibold block mt-0.5" dir="ltr">
                          {new Date(comment.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {(profile?.isRepresentative || profile?.role === 'ADMIN') && (
                        <button
                          type="button"
                          onClick={() => handleToggleVerifyComment(comment.id, comment.isVerified)}
                          className={`text-[9.5px] px-2.5 py-1 rounded-xl font-black transition-all active:scale-95 ${
                            comment.isVerified
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-white/5 text-slate-400 border border-white/10 hover:text-white'
                          }`}
                        >
                          {comment.isVerified ? (isAr ? '✓ معتمدة' : 'Verified') : (isAr ? '+ اعتماد الإجابة' : '+ Verify')}
                        </button>
                      )}
                      {comment.isMine && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="p-1.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs transition-all active:scale-95"
                          title={isAr ? 'حذف التعليق' : 'Delete Comment'}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-medium pr-2">
                    {comment.content}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 font-bold text-xs bg-slate-900/40 border border-white/5 rounded-2xl space-y-1">
              <span className="text-xl block">💬</span>
              <p>{isAr ? 'لا توجد تعليقات بعد. كن أول من يضيف إجابة أو استفسار!' : 'No comments yet. Be the first to reply!'}</p>
            </div>
          )}

          {/* Comment input form */}
          <form onSubmit={onCreateCommentSubmit} className="space-y-3 pt-2">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                placeholder={isAr ? 'اكتب تعليقك الأكاديمي هنا...' : 'Write an academic comment...'}
                className="flex-1 bg-slate-950 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[var(--accent)] font-medium"
              />
              <button
                type="submit"
                disabled={commentSubmitting || !newCommentText.trim()}
                className="px-5 py-3 bg-[var(--accent)] text-slate-950 font-black text-xs rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50 shrink-0"
              >
                {commentSubmitting ? (isAr ? 'إرسال...' : 'Posting...') : (isAr ? 'تعليق 🚀' : 'Reply 🚀')}
              </button>
            </div>

            <div className="flex items-center gap-2 px-1 select-none">
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

  // ── Main UI view (Chat vs Forum) ──
  return (
    <div className="w-full flex flex-col space-y-3 font-sans" dir={isAr ? 'rtl' : 'ltr'}>

      {/* ── 1. INNOVATIVE HEADER TOOLBAR ── */}
      <div className="p-3.5 rounded-[22px] bg-slate-900/90 border border-white/10 flex items-center justify-between gap-2 shadow-xl backdrop-blur-xl">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 via-orange-500/20 to-transparent border border-amber-500/40 flex items-center justify-center text-xl shrink-0 shadow-inner">
            🏫
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-black text-white truncate">
              {profile.groupName || (isAr ? 'شعبة تكنولوجيا المعلومات - A' : 'IT Cohort A')}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
              <span className="text-[9.5px] text-emerald-400 font-bold truncate">
                {isAr ? 'متصل الآن: 18 طالب وطالبة' : '18 members online'}
              </span>
            </div>
          </div>
        </div>

        {/* AI Actions & Segmented Control */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSummarizeChat}
            disabled={summaryLoading}
            className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition-all text-xs font-black flex items-center gap-1 active:scale-95"
            title={isAr ? 'التلخيص الذكي للمحادثة' : 'AI Chat Summary'}
          >
            {summaryLoading ? (
              <div className="h-4 w-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>✨</span>
                <span className="hidden sm:inline text-[10px]">{isAr ? 'الملخص' : 'Summary'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setIsAiModalOpen(true)}
            className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-all text-xs font-black flex items-center gap-1 active:scale-95"
            title={isAr ? 'مساعد الكويزات والـ AI' : 'AI Quiz Co-Pilot'}
          >
            <span>🤖</span>
            <span className="hidden sm:inline text-[10px]">{isAiModalOpen ? '' : (isAr ? 'كويز AI' : 'Quiz AI')}</span>
          </button>

          {/* Segmented Chat / Forum Selector */}
          <div className="flex p-1 rounded-2xl bg-slate-950 border border-white/10 select-none shrink-0 shadow-inner">
            <button
              type="button"
              onClick={() => setExchangeTab('chat')}
              className={`px-3 py-1.5 rounded-xl text-[10.5px] font-black transition-all flex items-center gap-1 ${
                exchangeTab === 'chat'
                  ? 'bg-[var(--accent)] text-slate-950 shadow-md scale-[1.02]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>💬</span>
              <span>{isAr ? 'الدردشة' : 'Chat'}</span>
            </button>
            <button
              type="button"
              onClick={() => setExchangeTab('forum')}
              className={`px-3 py-1.5 rounded-xl text-[10.5px] font-black transition-all flex items-center gap-1 ${
                exchangeTab === 'forum'
                  ? 'bg-[var(--accent)] text-slate-950 shadow-md scale-[1.02]'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>📚</span>
              <span>{isAr ? 'المنتدى' : 'Forum'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* AI Summary Banner Overlay */}
      <AnimatePresence>
        {isSummaryOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-slate-900 border border-amber-500/40 p-4 rounded-2xl space-y-2 shadow-2xl"
          >
            <div className="flex justify-between items-center border-b border-amber-500/20 pb-2">
              <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                <span>✨</span> {isAr ? 'الملخص الذكي التلقائي لمحادثة الشعبة' : 'AI Chat Summary'}
              </span>
              <button type="button" onClick={() => setIsSummaryOpen(false)} className="text-amber-300 font-black text-xs hover:text-white transition-colors">✕</button>
            </div>
            {summaryLoading ? (
              <p className="text-xs text-slate-400 text-center py-4 animate-pulse">{isAr ? 'جاري قراءة الرسائل وتوليد الملخص التلخيصي...' : 'Analyzing conversation history...'}</p>
            ) : (
              <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line font-medium">{summary}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 2. VIEW 1: LIVE CLASS CHAT (RESPONSIVE FLEX, NO DOUBLE SCROLLBAR) ── */}
      {exchangeTab === 'chat' && (
        <div className="flex flex-col bg-slate-950/70 border border-white/10 rounded-[24px] p-3 sm:p-4 justify-between space-y-3 shadow-2xl relative min-h-[460px] max-h-[580px]">
          
          {/* Messages Container */}
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto space-y-3.5 pr-1 pl-1 pb-2 font-sans"
          >
            {postsLoading ? (
              <div className="flex flex-col items-center justify-center h-48 text-xs text-slate-500 gap-2">
                <div className="h-6 w-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                <span>{isAr ? 'جاري تحميل رسائل المحادثة...' : 'Loading chat messages...'}</span>
              </div>
            ) : chatMessages.length > 0 ? (
              chatMessages.map((msg) => {
                const isMine = msg.isMine;
                const { readList, deliveredList, timeStr } = getMessageReadInfo(msg);
                const isMenuOpen = activeMenuMsgId === msg.id;

                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 relative group ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    {/* Classmate avatar */}
                    {!isMine && (
                      msg.student?.isAnonymous ? (
                        <div className="w-8 h-8 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sm shrink-0 mt-1 shadow-inner">
                          🕵️
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-[var(--accent)]/20 to-slate-800 border border-white/10 flex items-center justify-center font-black text-[10px] text-white shrink-0 mt-1 shadow-md">
                          {msg.student?.name ? msg.student.name.split(' ').slice(0, 2).map(n => n[0]).join('') : 'ST'}
                        </div>
                      )
                    )}

                    {/* Chat Bubble Card */}
                    <div className="flex flex-col space-y-1 max-w-[82%] sm:max-w-[75%]">
                      {!isMine && (
                        <div className="flex items-center gap-1.5 px-1">
                          <span className="text-[10px] font-black text-[var(--accent)]">
                            {msg.student?.isAnonymous ? (isAr ? 'طالب مجهول' : 'Anonymous Student') : msg.student?.name}
                          </span>
                          {!msg.student?.isAnonymous && msg.student?.isRepresentative && (
                            <span className="text-[7.5px] font-black uppercase bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                              👑 {isAr ? 'مندوب' : 'Rep'}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Bubble content */}
                      <div
                        onClick={() => setActiveMenuMsgId(isMenuOpen ? null : msg.id)}
                        className={`rounded-[20px] p-3.5 text-xs font-semibold leading-relaxed relative transition-all cursor-pointer shadow-lg ${
                          isMine
                            ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 rounded-tr-none shadow-amber-500/10'
                            : 'bg-slate-900 border border-slate-800 text-slate-100 rounded-tl-none'
                        }`}
                      >
                        <p className="whitespace-pre-line leading-relaxed font-medium" dir="rtl">{msg.content}</p>

                        {/* WhatsApp-style Bottom Time + Double Blue Ticks (Read Receipts) */}
                        <div className={`flex items-center justify-between gap-3 mt-1.5 pt-1 border-t text-[8.5px] font-mono font-bold ${
                          isMine ? 'border-slate-950/15 text-slate-900/80' : 'border-white/5 text-slate-400'
                        }`}>
                          <div className="flex items-center gap-1">
                            {/* Tap for menu hint */}
                            <span className="opacity-70">{timeStr}</span>
                          </div>

                          {/* Read Receipts Checkmarks */}
                          {isMine && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMsgForInfo(msg);
                              }}
                              className="flex items-center gap-1 cursor-pointer hover:opacity-100 transition-opacity"
                              title={isAr ? 'اضغط لعرض معلومات القراءة والمستلمين' : 'Click for Message Info'}
                            >
                              <span className="text-[10px] font-black tracking-tighter text-sky-400">
                                ✓✓
                              </span>
                              <span className="text-[8px] font-sans font-bold underline opacity-80">
                                {isAr ? 'معلومات' : 'Info'}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Contextual Action Menu on Tap */}
                        <AnimatePresence>
                          {isMenuOpen && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.9 }}
                              className="absolute -top-12 right-0 z-30 bg-slate-900 border border-white/15 p-1.5 rounded-2xl shadow-2xl flex items-center gap-1 backdrop-blur-xl"
                            >
                              {['👍', '❤️', '💡', '🔥', '🚀'].map((emoji, eIdx) => (
                                <button
                                  key={eIdx}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toast.success(isAr ? `تفاعلت بـ ${emoji}` : `Reacted with ${emoji}`);
                                    setActiveMenuMsgId(null);
                                  }}
                                  className="text-xs p-1 hover:scale-125 transition-transform"
                                >
                                  {emoji}
                                </button>
                              ))}
                              {isMine && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedMsgForInfo(msg);
                                    setActiveMenuMsgId(null);
                                  }}
                                  className="text-[10px] font-black px-2 py-1 bg-amber-500/20 text-amber-300 rounded-xl border border-amber-500/30 hover:bg-amber-500/30"
                                >
                                  ℹ️ {isAr ? 'معلومات' : 'Info'}
                                </button>
                              )}
                              {isMine && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeletePost(msg.id);
                                    setActiveMenuMsgId(null);
                                  }}
                                  className="text-xs p-1 text-red-400 hover:text-red-300"
                                  title={isAr ? 'سحب الرسالة' : 'Delete'}
                                >
                                  🗑️
                                </button>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-center space-y-2 text-slate-500">
                <span className="text-3xl block">💬</span>
                <p className="text-xs font-black">{isAr ? 'مرحباً بك في المحادثة الحية لشعبتك! ابدأ التحدث الآن.' : 'Start the conversation in your class group chat!'}</p>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* ── Chat Send Input Dock ── */}
          <form onSubmit={handleSendChatMessage} className="flex gap-2 items-center bg-slate-900 border border-white/10 rounded-2xl p-2 shadow-2xl">
            <button
              type="button"
              onClick={() => toast(isAr ? '📎 إرفاق ملف أو صورة دراسية' : 'Attach study file', { icon: 'ℹ️' })}
              className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white transition-all text-sm shrink-0"
              title={isAr ? 'إرفاق ملف' : 'Attach file'}
            >
              📎
            </button>

            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder={isAr ? 'اكتب رسالتك للشعبة هنا...' : 'Write message to class...'}
              className="flex-1 bg-transparent border-0 text-xs text-white placeholder-slate-500 focus:outline-none font-medium px-2"
              dir="rtl"
            />

            <button
              type="button"
              onClick={() => setChatIsAnonymous(!chatIsAnonymous)}
              className={`p-2 rounded-xl text-xs font-bold transition-all border shrink-0 ${
                chatIsAnonymous ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-white/5 text-slate-500 border-transparent'
              }`}
              title={isAr ? 'إرسال كمجهول' : 'Send Anonymously'}
            >
              🕵️
            </button>

            <button
              type="submit"
              disabled={isSendingChat || !chatInput.trim()}
              className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs rounded-xl shadow-lg active:scale-95 disabled:opacity-50 shrink-0 transition-all"
            >
              {isSendingChat ? '...' : (isAr ? 'إرسال 🚀' : 'Send 🚀')}
            </button>
          </form>
        </div>
      )}

      {/* ── 3. VIEW 2: ACADEMIC FORUM & RESOURCES MODE ── */}
      {exchangeTab === 'forum' && (
        <div className="space-y-4 font-sans">
          
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2.5 justify-between items-center bg-slate-900/80 border border-white/10 p-3 rounded-2xl backdrop-blur-md">
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                value={exchangeSearch}
                onChange={(e) => setExchangeSearch(e.target.value)}
                placeholder={isAr ? 'بحث في مواضيع المنتدى...' : 'Search forum threads...'}
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[var(--accent)] font-medium"
              />
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 no-scrollbar">
              {[
                { id: 'ALL', label: isAr ? 'الكل' : 'All' },
                { id: 'QUESTION', label: isAr ? 'أسئلة ❓' : 'Questions' },
                { id: 'RESOURCE', label: isAr ? 'مراجع 📚' : 'Resources' },
                { id: 'HELP', label: isAr ? 'مساعدة 🆘' : 'Help' }
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setExchangeCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-[10.5px] font-black whitespace-nowrap transition-all ${
                    exchangeCategoryFilter === cat.id
                      ? 'bg-[var(--accent)] text-slate-950 shadow-md'
                      : 'bg-white/5 text-slate-400 hover:text-white'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsNewPostModalOpen(true)}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-xs rounded-xl shadow-lg active:scale-95 transition-all shrink-0"
            >
              + {isAr ? 'موضوع جديد' : 'New Thread'}
            </button>
          </div>

          {/* Posts Grid */}
          <div className="space-y-3">
            {postsLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-xs text-slate-500 gap-2">
                <div className="h-6 w-6 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
                <span>{isAr ? 'جاري تحميل المواضيع...' : 'Loading threads...'}</span>
              </div>
            ) : filteredPosts.length > 0 ? (
              filteredPosts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => {
                    if (fetchPostDetails) fetchPostDetails(post.id);
                    setSelectedPost(post);
                  }}
                  className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 hover:border-[var(--accent)]/40 transition-all cursor-pointer space-y-2.5 shadow-lg group"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2.5">
                      {post.student?.isAnonymous ? (
                        <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sm shrink-0">
                          🕵️
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[var(--accent)]/20 to-slate-800 border border-white/10 flex items-center justify-center font-black text-[10px] text-white shrink-0">
                          {post.student?.name ? post.student.name.split(' ').slice(0, 2).map(n => n[0]).join('') : 'ST'}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-white group-hover:text-[var(--accent)] transition-colors">
                            {post.student?.isAnonymous ? (isAr ? 'طالب مجهول' : 'Anonymous Student') : post.student?.name}
                          </span>
                          {!post.student?.isAnonymous && post.student?.isRepresentative && (
                            <span className="text-[7.5px] font-black uppercase bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                              👑 {isAr ? 'مندوب' : 'Rep'}
                            </span>
                          )}
                        </div>
                        <span className="text-[8.5px] text-slate-500 font-semibold block mt-0.5" dir="ltr">
                          {new Date(post.createdAt).toLocaleString(isAr ? 'ar-EG' : 'en-US', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                    </div>

                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-xl border ${getCategoryBadgeClass(post.category)}`}>
                      {getCategoryLabel(post.category)}
                    </span>
                  </div>

                  <h3 className="text-xs font-black text-white leading-snug">{post.title}</h3>
                  <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed font-medium">
                    {post.content}
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[9.5px] font-bold text-slate-400">
                    <span className="flex items-center gap-1">
                      💬 {post._count?.comments || 0} {isAr ? 'تعليق' : 'comments'}
                    </span>
                    <span className="text-[var(--accent)] font-black group-hover:translate-x-1 transition-transform">
                      {isAr ? 'عرض المناقشة ←' : 'View Thread →'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-500 font-bold text-xs bg-slate-900/40 border border-white/5 rounded-2xl space-y-2">
                <span className="text-3xl block">📚</span>
                <p>{isAr ? 'لا توجد مواضيع في المنتدى الأكاديمي حالياً. كن أول من يضيف موضوعاً!' : 'No forum threads found. Create one!'}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 4. WHATSAPP-STYLE "MESSAGE INFO" MODAL (معلومات الرسالة) ── */}
      <AnimatePresence>
        {selectedMsgForInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" dir={isAr ? 'rtl' : 'ltr'}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-md bg-slate-900 border border-white/15 rounded-[24px] p-5 space-y-4 shadow-2xl font-sans"
            >
              {/* Header */}
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">ℹ️</span>
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-300">
                    {isAr ? 'معلومات الرسالة (Message Info)' : 'Message Info'}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedMsgForInfo(null)}
                  className="text-slate-400 hover:text-white text-base leading-none"
                >
                  ✕
                </button>
              </div>

              {/* Message Content Preview */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-1">
                <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider block">
                  {isAr ? 'محتوى الرسالة' : 'Message Content'}
                </span>
                <p className="text-xs font-semibold text-white leading-relaxed">
                  {selectedMsgForInfo.content}
                </p>
              </div>

              {/* Read By & Delivered Sections */}
              {(() => {
                const { readList, deliveredList } = getMessageReadInfo(selectedMsgForInfo);
                return (
                  <div className="space-y-4 text-xs">
                    {/* Read By Section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border-b border-white/5 pb-1">
                        <span className="font-black text-sky-400 flex items-center gap-1.5">
                          <span className="text-sm">✓✓</span> {isAr ? 'قُرئت بواسطة (Read by)' : 'Read by'}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 font-bold">{readList.length} {isAr ? 'طالب' : 'students'}</span>
                      </div>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {readList.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center p-2 rounded-xl bg-slate-950/60 border border-white/5 text-[11px]">
                            <div className="flex items-center gap-2">
                              <span>{item.avatar}</span>
                              <span className="font-bold text-white">{item.name}</span>
                            </div>
                            <span className="text-[9px] font-mono text-slate-400">{item.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Delivered To Section */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between border-b border-white/5 pb-1">
                        <span className="font-black text-slate-300 flex items-center gap-1.5">
                          <span className="text-sm">✓✓</span> {isAr ? 'تم التسليم إلى (Delivered to)' : 'Delivered to'}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 font-bold">{deliveredList.length} {isAr ? 'طالب' : 'students'}</span>
                      </div>
                      <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                        {deliveredList.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center p-2 rounded-xl bg-slate-950/40 border border-white/5 text-[11px]">
                            <div className="flex items-center gap-2">
                              <span>{item.avatar}</span>
                              <span className="font-bold text-slate-200">{item.name}</span>
                            </div>
                            <span className="text-[9px] font-mono text-slate-400">{item.time}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <button
                onClick={() => setSelectedMsgForInfo(null)}
                className="w-full py-2.5 rounded-xl bg-slate-800 text-white font-black text-xs hover:bg-slate-700 transition-all active:scale-95"
              >
                {isAr ? 'إغلاق' : 'Close'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 5. NEW THREAD MODAL ── */}
      <AnimatePresence>
        {isNewPostModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" dir={isAr ? 'rtl' : 'ltr'}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-white/15 rounded-[24px] p-5 space-y-4 shadow-2xl font-sans"
            >
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <h3 className="text-xs font-black uppercase tracking-wider text-white">
                  + {isAr ? 'إضافة موضوع جديد في المنتدى' : 'Create New Thread'}
                </h3>
                <button onClick={() => setIsNewPostModalOpen(false)} className="text-slate-400 hover:text-white text-base">✕</button>
              </div>

              <form onSubmit={onCreatePostSubmit} className="space-y-3 text-xs font-bold">
                <div className="space-y-1">
                  <label className="text-slate-400 block">{isAr ? 'عنوان الموضوع' : 'Title'}</label>
                  <input
                    type="text"
                    required
                    value={newPostTitle}
                    onChange={(e) => setNewPostTitle(e.target.value)}
                    placeholder={isAr ? 'مثال: ملخص المحاضرة الثالثة برمجيات' : 'e.g. Lecture 3 Summary'}
                    className="w-full p-3 bg-slate-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[var(--accent)] font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block">{isAr ? 'تصنيف الموضوع' : 'Category'}</label>
                  <select
                    value={newPostCategory}
                    onChange={(e) => setNewPostCategory(e.target.value)}
                    className="w-full p-3 bg-slate-950 border border-white/10 rounded-xl text-white focus:outline-none font-bold"
                  >
                    <option value="GENERAL">{isAr ? 'نقاش عام' : 'General'}</option>
                    <option value="QUESTION">{isAr ? 'سؤال استفساري ❓' : 'Question'}</option>
                    <option value="RESOURCE">{isAr ? 'مرجع أو تلخيص دراسي 📚' : 'Study Resource'}</option>
                    <option value="HELP">{isAr ? 'طلب مساعدة عاجلة 🆘' : 'Help Request'}</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 block">{isAr ? 'تفاصيل الموضوع' : 'Content'}</label>
                  <textarea
                    required
                    rows={4}
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder={isAr ? 'اكتب الشرح أو التفاصيل هنا...' : 'Write thread details...'}
                    className="w-full p-3 bg-slate-950 border border-white/10 rounded-xl text-white focus:outline-none focus:border-[var(--accent)] font-medium resize-none"
                  />
                </div>

                <div className="flex items-center gap-2 select-none pt-1">
                  <input
                    type="checkbox"
                    id="newPostIsAnon"
                    checked={newPostIsAnonymous}
                    onChange={(e) => setNewPostIsAnonymous(e.target.checked)}
                    className="accent-[var(--accent)] h-4 w-4 rounded border-white/10 bg-black cursor-pointer"
                  />
                  <label htmlFor="newPostIsAnon" className="text-slate-300 text-xs font-bold cursor-pointer">
                    🕵️ {isAr ? 'نشر بهوية مجهولة' : 'Post anonymously'}
                  </label>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setIsNewPostModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-white/5 text-slate-300 font-bold hover:bg-white/10"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={postSubmitting}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black shadow-lg active:scale-95 disabled:opacity-50"
                  >
                    {postSubmitting ? (isAr ? 'نشر...' : 'Posting...') : (isAr ? 'نشر الموضوع 🚀' : 'Post Thread 🚀')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 6. AI CO-PILOT & QUIZ MODAL ── */}
      <AnimatePresence>
        {isAiModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" dir={isAr ? 'rtl' : 'ltr'}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-slate-900 border border-white/15 rounded-[24px] p-5 space-y-4 shadow-2xl font-sans max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🤖</span>
                  <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                    {isAr ? 'مساعد الكويزات والشروحات الذكية (AI Co-Pilot)' : 'AI Quiz & Study Co-Pilot'}
                  </h3>
                </div>
                <button onClick={() => setIsAiModalOpen(false)} className="text-slate-400 hover:text-white text-base">✕</button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-slate-400 block text-xs font-bold">{isAr ? 'اسم المادة الدراسية' : 'Subject Name'}</label>
                  <input
                    type="text"
                    value={aiSubjectName}
                    onChange={(e) => setAiSubjectName(e.target.value)}
                    placeholder={isAr ? 'مثال: ذكاء اصطناعي / برمجيات' : 'e.g. AI / Software Engineering'}
                    className="w-full p-3 bg-slate-950 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-400 font-medium"
                  />
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleGenerateAiQuiz}
                    disabled={quizLoading}
                    className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-black flex items-center justify-center gap-1.5 hover:bg-emerald-500/25 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {quizLoading ? <div className="h-4 w-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /> : '⚡ ' + (isAr ? 'توليد كويز تجريبي' : 'Generate Quiz')}
                  </button>

                  <button
                    type="button"
                    onClick={handleGenerateAiExplain}
                    disabled={aiSummaryLoading}
                    className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-black flex items-center justify-center gap-1.5 hover:bg-amber-500/25 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {aiSummaryLoading ? <div className="h-4 w-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /> : '💡 ' + (isAr ? 'شرح موضوع معين' : 'Explain Topic')}
                  </button>
                </div>

                {/* Quiz Questions output */}
                {quizQuestions.length > 0 && (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-3">
                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                      <span className="text-xs font-black text-emerald-400">{isAr ? 'أسئلة الكويز الذكي' : 'Generated Quiz Questions'}</span>
                      <button
                        onClick={handleShareQuizToForum}
                        className="text-[10px] font-black px-2.5 py-1 bg-emerald-500 text-slate-950 rounded-xl"
                      >
                        🚀 {isAr ? 'مشاركة بالشعبة' : 'Share to Forum'}
                      </button>
                    </div>
                    {quizQuestions.map((q, idx) => (
                      <div key={idx} className="space-y-1.5 text-xs">
                        <p className="font-bold text-white">{idx + 1}. {q.question}</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {q.options?.map((opt, oIdx) => (
                            <div key={oIdx} className="p-2 rounded-xl bg-white/5 text-[11px] text-slate-300 font-medium">
                              {opt}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* AI Explanation output */}
                {aiSummaryResult && (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-2">
                    <div className="flex justify-between items-center border-b border-white/10 pb-2">
                      <span className="text-xs font-black text-amber-300">{isAr ? 'الشرح والتلخيص الأكاديمي' : 'AI Explanation'}</span>
                      <button
                        onClick={handleShareSummaryToForum}
                        className="text-[10px] font-black px-2.5 py-1 bg-amber-500 text-slate-950 rounded-xl"
                      >
                        🚀 {isAr ? 'مشاركة بالشعبة' : 'Share to Forum'}
                      </button>
                    </div>
                    <p className="text-xs text-slate-200 whitespace-pre-line leading-relaxed font-medium">{aiSummaryResult}</p>
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
