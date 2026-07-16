const express = require('express');
const { prisma } = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// 1. Fetch all posts in the student's group
router.get('/posts', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Access denied. Student account required.' });
    }

    // Always fetch fresh group details to avoid stale token states
    const student = await prisma.student.findUnique({
      where: { id: req.user.id }
    });

    if (!student || !student.groupId) {
      return res.status(400).json({ success: false, error: 'You are not assigned to any group yet.' });
    }

    const posts = await prisma.exchangePost.findMany({
      where: { groupId: student.groupId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            idPhotoUrl: true,
            isRepresentative: true
          }
        },
        _count: {
          select: { comments: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const mappedPosts = posts.map(post => {
      const isMine = post.studentId === req.user.id;
      return {
        id: post.id,
        title: post.title,
        content: post.content,
        category: post.category,
        groupId: post.groupId,
        studentId: post.isAnonymous ? null : post.studentId,
        isAnonymous: post.isAnonymous,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        _count: post._count,
        isMine,
        student: post.isAnonymous ? {
          id: null,
          name: 'Anonymous',
          idPhotoUrl: null,
          isRepresentative: false,
          isAnonymous: true
        } : post.student
      };
    });

    res.status(200).json({ success: true, data: mappedPosts });
  } catch (error) {
    console.error('[API] Error fetching exchange posts:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch exchange posts' });
  }
});

// 2. Create a new post in the student's group
router.post('/posts', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Access denied. Student account required.' });
    }

    const { title, content, category, isAnonymous } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, error: 'Title and content are required' });
    }

    const student = await prisma.student.findUnique({
      where: { id: req.user.id }
    });

    if (!student || !student.groupId) {
      return res.status(400).json({ success: false, error: 'You must belong to a group to post.' });
    }

    // Verify category matches enum
    const allowedCategories = ['QUESTION', 'RESOURCE', 'HELP', 'GENERAL'];
    const postCategory = allowedCategories.includes(category) ? category : 'GENERAL';

    const post = await prisma.exchangePost.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        category: postCategory,
        groupId: student.groupId,
        studentId: student.id,
        isAnonymous: !!isAnonymous
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            idPhotoUrl: true,
            isRepresentative: true
          }
        },
        _count: {
          select: { comments: true }
        }
      }
    });

    const responseData = {
      id: post.id,
      title: post.title,
      content: post.content,
      category: post.category,
      groupId: post.groupId,
      studentId: post.isAnonymous ? null : post.studentId,
      isAnonymous: post.isAnonymous,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      _count: post._count,
      isMine: true,
      student: post.isAnonymous ? {
        id: null,
        name: 'Anonymous',
        idPhotoUrl: null,
        isRepresentative: false,
        isAnonymous: true
      } : post.student
    };

    res.status(201).json({ success: true, data: responseData });
    
    // Broadcast via SSE for real-time updates
    try {
      const { broadcastSSE } = require('../services/notifications');
      broadcastSSE('EXCHANGE_POST_CREATED', { groupId: student.groupId, post });
    } catch (e) {
      console.error('[SSE] Failed to broadcast post creation:', e.message);
    }
  } catch (error) {
    console.error('[API] Error creating exchange post:', error);
    res.status(500).json({ success: false, error: 'Failed to create exchange post' });
  }
});

// 3. Get detailed single post with comments
router.get('/posts/:postId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    const { postId } = req.params;

    const student = await prisma.student.findUnique({
      where: { id: req.user.id }
    });

    if (!student || !student.groupId) {
      return res.status(400).json({ success: false, error: 'Invalid group context.' });
    }

    const post = await prisma.exchangePost.findUnique({
      where: { id: postId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            idPhotoUrl: true,
            isRepresentative: true
          }
        },
        comments: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                idPhotoUrl: true,
                isRepresentative: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found.' });
    }

    // Ensure the student belongs to the group of this post
    if (post.groupId !== student.groupId) {
      return res.status(403).json({ success: false, error: 'Forbidden. This post belongs to another group.' });
    }

    const isPostMine = post.studentId === req.user.id;
    const mappedPost = {
      id: post.id,
      title: post.title,
      content: post.content,
      category: post.category,
      groupId: post.groupId,
      studentId: post.isAnonymous ? null : post.studentId,
      isAnonymous: post.isAnonymous,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      isMine: isPostMine,
      student: post.isAnonymous ? {
        id: null,
        name: 'Anonymous',
        idPhotoUrl: null,
        isRepresentative: false,
        isAnonymous: true
      } : post.student,
      comments: (post.comments || []).map(comment => {
        const isCommentMine = comment.studentId === req.user.id;
        return {
          id: comment.id,
          postId: comment.postId,
          content: comment.content,
          createdAt: comment.createdAt,
          isAnonymous: comment.isAnonymous,
          isMine: isCommentMine,
          studentId: comment.isAnonymous ? null : comment.studentId,
          student: comment.isAnonymous ? {
            id: null,
            name: 'Anonymous',
            idPhotoUrl: null,
            isRepresentative: false,
            isAnonymous: true
          } : comment.student
        };
      })
    };

    res.status(200).json({ success: true, data: mappedPost });
  } catch (error) {
    console.error('[API] Error fetching single post:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch post details' });
  }
});

// 4. Comment/reply on a post
router.post('/posts/:postId/comments', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    const { postId } = req.params;
    const { content, isAnonymous } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, error: 'Comment content cannot be empty.' });
    }

    const student = await prisma.student.findUnique({
      where: { id: req.user.id }
    });

    if (!student || !student.groupId) {
      return res.status(400).json({ success: false, error: 'Invalid group context.' });
    }

    const post = await prisma.exchangePost.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found.' });
    }

    // Ensure the student belongs to the group of the target post
    if (post.groupId !== student.groupId) {
      return res.status(403).json({ success: false, error: 'Forbidden. Sibling groups cannot interact.' });
    }

    const comment = await prisma.exchangeComment.create({
      data: {
        content: content.trim(),
        postId,
        studentId: student.id,
        isAnonymous: !!isAnonymous
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            idPhotoUrl: true,
            isRepresentative: true
          }
        }
      }
    });

    const responseData = {
      id: comment.id,
      postId: comment.postId,
      content: comment.content,
      createdAt: comment.createdAt,
      isAnonymous: comment.isAnonymous,
      studentId: comment.isAnonymous ? null : comment.studentId,
      isMine: true,
      student: comment.isAnonymous ? {
        id: null,
        name: 'Anonymous',
        idPhotoUrl: null,
        isRepresentative: false,
        isAnonymous: true
      } : comment.student
    };

    res.status(201).json({ success: true, data: responseData });

    // Broadcast via SSE for real-time updates
    try {
      const { broadcastSSE } = require('../services/notifications');
      broadcastSSE('EXCHANGE_COMMENT_CREATED', { groupId: student.groupId, postId, comment });
    } catch (e) {
      console.error('[SSE] Failed to broadcast comment creation:', e.message);
    }
  } catch (error) {
    console.error('[API] Error posting exchange comment:', error);
    res.status(500).json({ success: false, error: 'Failed to post comment' });
  }
});

// 5. Delete post (only author student can delete)
router.delete('/posts/:postId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    const { postId } = req.params;

    const post = await prisma.exchangePost.findUnique({
      where: { id: postId }
    });

    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found.' });
    }

    // Author authorization check
    if (post.studentId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied. You can only delete your own posts.' });
    }

    await prisma.exchangePost.delete({
      where: { id: postId }
    });

    res.status(200).json({ success: true, message: 'Post deleted successfully.' });

    // Broadcast via SSE for real-time updates
    try {
      const { broadcastSSE } = require('../services/notifications');
      broadcastSSE('EXCHANGE_POST_DELETED', { groupId: post.groupId, postId });
    } catch (e) {
      console.error('[SSE] Failed to broadcast post deletion:', e.message);
    }
  } catch (error) {
    console.error('[API] Error deleting post:', error);
    res.status(500).json({ success: false, error: 'Failed to delete post' });
  }
});

// 6. Delete comment (only author student can delete)
router.delete('/comments/:commentId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'STUDENT') {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    const { commentId } = req.params;

    const comment = await prisma.exchangeComment.findUnique({
      where: { id: commentId },
      include: { post: true }
    });

    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found.' });
    }

    // Author authorization check
    if (comment.studentId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Access denied. You can only delete your own comments.' });
    }

    await prisma.exchangeComment.delete({
      where: { id: commentId }
    });

    res.status(200).json({ success: true, message: 'Comment deleted successfully.' });

    // Broadcast via SSE for real-time updates
    try {
      const { broadcastSSE } = require('../services/notifications');
      broadcastSSE('EXCHANGE_COMMENT_DELETED', { groupId: comment.post.groupId, postId: comment.postId, commentId });
    } catch (e) {
      console.error('[SSE] Failed to broadcast comment deletion:', e.message);
    }
  } catch (error) {
    console.error('[API] Error deleting comment:', error);
    res.status(500).json({ success: false, error: 'Failed to delete comment' });
  }
});

module.exports = router;
