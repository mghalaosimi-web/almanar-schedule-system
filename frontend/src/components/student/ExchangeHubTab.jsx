/**
 * @file ExchangeHubTab.jsx
 * @description تبويب ملتقى الدفعة (Class Exchange Hub) في بوابة الطالب.
 * يتيح للطلاب كتابة المنشورات وتصنيفها والمشاركة بالتعليقات وحل الأسئلة وتبادل المراجع الدراسية.
 * @author أنتيجرافيتي (Antigravity)
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

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

  // Comment Form States
  const [newCommentText, setNewCommentText] = useState('');

  // Group Chat Input States
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);

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
        'GENERAL'
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
    const success = await handleCreatePost(newPostTitle, newPostContent, newPostCategory);
    if (success) {
      setIsNewPostModalOpen(false);
      setNewPostTitle('');
      setNewPostContent('');
      setNewPostCategory('GENERAL');
    }
  };

  const onCreateCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    const success = await handleCreateComment(newCommentText);
    if (success) {
      setNewCommentText('');
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
              {selectedPost.student?.idPhotoUrl ? (
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
                  <span className="text-xs font-black text-white">{selectedPost.student?.name}</span>
                  {selectedPost.student?.isRepresentative && (
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
              {selectedPost.student?.id === currentStudentId && (
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
                  className="frosted-panel rounded-2xl p-4 border border-white/5 bg-white/1 space-y-2.5"
                  style={{ background: 'var(--bg-card, #121824)', border: '1px solid var(--border-card, rgba(255,255,255,0.05))' }}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2.5">
                      {comment.student?.idPhotoUrl ? (
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
                          <span className="text-xs font-extrabold text-white">{comment.student?.name}</span>
                          {comment.student?.isRepresentative && (
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

                    {comment.student?.id === currentStudentId && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="p-1.5 rounded bg-red-500/10 border border-red-500/25 hover:bg-red-500/20 text-red-400 text-[10px] transition-colors"
                        title={isAr ? 'حذف التعليق' : 'Delete Comment'}
                      >
                        🗑️
                      </button>
                    )}
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
          <form onSubmit={onCreateCommentSubmit} className="flex gap-2 items-end pt-2">
            <textarea
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              placeholder={t('exchange.commentPlaceholder') || (isAr ? 'اكتب تعليقك الأكاديمي هنا...' : 'Write a comment...')}
              rows={2}
              className="flex-1 bg-slate-955/80 border border-white/5 rounded-xl p-3 text-xs text-slate-300 focus:outline-none focus:border-[#00f59b]/50 placeholder-slate-600 resize-none font-medium text-right font-sans"
              dir="rtl"
            />
            <button
              type="submit"
              disabled={commentSubmitting || !newCommentText.trim()}
              className="px-4 py-3 bg-[#00f59b] hover:bg-[#00d484] disabled:bg-slate-800 disabled:text-slate-500 text-slate-955 font-black text-xs rounded-xl transition-all shadow-lg shadow-[#00f59b]/10 whitespace-nowrap active:scale-95 duration-150 shrink-0 h-[46px] flex items-center justify-center"
            >
              {commentSubmitting ? (t('exchange.commenting') || (isAr ? 'جاري التعليق' : 'Commenting...')) : (t('exchange.commentBtn') || (isAr ? 'تعليق' : 'Comment'))}
            </button>
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
                ? 'bg-[#00f59b] text-slate-955 shadow-md shadow-[#00f59b]/10'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            💬 {isAr ? 'محادثة الدفعة' : 'Group Chat'}
          </button>
          <button
            onClick={() => setExchangeTab('forum')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide transition-all ${
              exchangeTab === 'forum'
                ? 'bg-[#00f59b] text-slate-955 shadow-md shadow-[#00f59b]/10'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            📚 {isAr ? 'المنتدى الدراسي' : 'Academic Hub'}
          </button>
        </div>
      </div>

      {/* ── View 1: Live Group Chat Mode ── */}
      {exchangeTab === 'chat' && (
        <div className="flex flex-col h-[520px] bg-black/20 border border-white/5 rounded-3xl p-4 justify-between space-y-3 overflow-hidden">
          
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
                const isMine = msg.student?.id === currentStudentId;
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2.5 ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    {/* Other user's avatar */}
                    {!isMine && (
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-white/10 to-white/5 border border-white/10 flex items-center justify-center font-black text-[10px] text-white shrink-0 shadow-sm mt-0.5">
                        {msg.student?.name ? msg.student.name.split(' ').slice(0, 2).map(n => n[0]).join('') : 'ST'}
                      </div>
                    )}

                    {/* Chat Bubble Card */}
                    <div className="flex flex-col space-y-1 max-w-[75%]">
                      {/* Name of sender (other user) */}
                      {!isMine && (
                        <div className="flex items-center gap-1 px-1">
                          <span className="text-[10px] font-black text-[#00f59b]">{msg.student?.name}</span>
                          {msg.student?.isRepresentative && (
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
          <form onSubmit={handleSendChatMessage} className="flex gap-2 items-center bg-slate-950/80 border border-white/5 rounded-2xl p-2">
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
              className="px-4 py-2 bg-[#00f59b] hover:bg-[#00d484] disabled:bg-slate-800 disabled:text-slate-500 text-slate-955 font-black text-xs rounded-xl transition-all shadow-md shadow-[#00f59b]/15 whitespace-nowrap active:scale-95 duration-100"
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
                      {post.student?.idPhotoUrl ? (
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
                          <span className="text-[11px] font-extrabold text-white">{post.student?.name}</span>
                          {post.student?.isRepresentative && (
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
