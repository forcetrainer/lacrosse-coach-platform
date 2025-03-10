import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertContentSchema, insertCommentSchema } from "@shared/schema";
import knex from 'knex';

// Helper function to detect platform (needs a robust implementation in a real application)
function detectPlatform(url: string): string {
  if (url.includes("youtube.com")) return "youtube";
  if (url.includes("vimeo.com")) return "vimeo";
  return "other";
}

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Content management
  app.post("/api/content", async (req, res) => {
    if (!req.user?.isCoach) {
      return res.status(403).send("Only coaches can add content");
    }

    const parsed = insertContentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error);
    }

    try {
      const content = await storage.createContent(
        { 
          ...parsed.data,
          coachId: req.user.id // Add coachId from authenticated user
        },
        req.user.id
      );
      res.status(201).json(content);
    } catch (error) {
      console.error('Error creating content:', error);
      res.status(500).json({ error: 'Failed to create content' });
    }
  });

  app.get("/api/content", async (req, res) => {
    const content = await storage.getAllContent();

    // If the user is a coach, fetch watchers for each content
    if (req.user?.isCoach) {
      const contentWithWatchers = await Promise.all(
        content.map(async (item) => {
          const watchers = await storage.getWatchersForContent(item.id);
          return { ...item, watchers };
        })
      );
      res.json(contentWithWatchers);
    } else {
      res.json(content);
    }
  });

  app.get("/api/content/:id", async (req, res) => {
    try {
      const contentId = parseInt(req.params.id);
      if (isNaN(contentId)) {
        return res.status(400).json({ error: "Invalid content ID format" });
      }

      const content = await storage.getContent(contentId);
      if (!content) {
        return res.status(404).json({ error: "Content not found" });
      }

      res.json(content);
    } catch (error) {
      console.error('Error fetching content:', error);
      res.status(500).json({ error: 'Failed to fetch content' });
    }
  });

  app.delete("/api/content/:id", async (req, res) => {
    if (!req.user?.isCoach) {
      return res.status(403).send("Only coaches can delete content");
    }

    try {
      const contentId = parseInt(req.params.id);
      if (isNaN(contentId)) {
        return res.status(400).json({ error: "Invalid content ID format" });
      }

      const content = await storage.getContent(contentId);
      if (!content) {
        return res.status(404).json({ error: "Content not found" });
      }

      // Only allow the coach who created the content to delete it
      if (content.coachId !== req.user.id) {
        return res.status(403).json({ error: "You can only delete your own content" });
      }

      await storage.deleteContent(contentId);
      res.sendStatus(200);
    } catch (error) {
      console.error('Error deleting content:', error);
      res.status(500).json({ error: 'Failed to delete content' });
    }
  });

  app.post("/api/content/:id/view", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      const contentId = parseInt(req.params.id);
      if (isNaN(contentId)) {
        return res.status(400).json({ error: "Invalid content ID format" });
      }

      const content = await storage.getContent(contentId);
      if (!content) {
        return res.status(404).json({ error: "Content not found" });
      }

      // Only increment views and update watch status for non-coach users
      if (!req.user.isCoach) {
        // Increment the view count
        await storage.incrementViews(contentId);

        // Update watch status to watched
        await storage.updateWatchStatus(
          req.user.id,
          contentId,
          true // Mark as watched when viewing
        );
      }

      res.sendStatus(200);
    } catch (error) {
      console.error('Error updating view status:', error);
      res.status(500).json({ error: 'Failed to update view status' });
    }
  });

  // Comments
  app.post("/api/content/:contentId/comments", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      const contentId = parseInt(req.params.contentId);
      if (isNaN(contentId)) {
        return res.status(400).json({ error: "Invalid content ID format" });
      }

      const content = await storage.getContent(contentId);
      if (!content) {
        return res.status(404).json({ error: "Content not found" });
      }

      const parsed = insertCommentSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json(parsed.error);
      }

      const comment = await storage.createComment(
        {
          ...parsed.data,
          userId: req.user.id,
          contentId
        },
        req.user.id
      );
      res.status(201).json(comment);
    } catch (error) {
      console.error('Error creating comment:', error);
      res.status(500).json({ error: 'Failed to create comment' });
    }
  });

  // Get comments with sorting and like status
  app.get("/api/content/:contentId/comments", async (req, res) => {
    try {
      const contentId = parseInt(req.params.contentId);
      if (isNaN(contentId)) {
        return res.status(400).json({ error: "Invalid content ID format" });
      }

      const content = await storage.getContent(contentId);
      if (!content) {
        return res.status(404).json({ error: "Content not found" });
      }

      const sortBy = (req.query.sortBy as 'newest' | 'oldest' | 'likes') || 'newest';
      const comments = await storage.getCommentsByContent(contentId, sortBy);

      // If user is logged in, check which comments they've liked
      if (req.user) {
        const commentsWithLikeStatus = await Promise.all(
          comments.map(async (comment) => ({
            ...comment,
            hasLiked: await storage.hasUserLikedComment(req.user!.id, comment.id)
          }))
        );
        res.json(commentsWithLikeStatus);
      } else {
        res.json(comments);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
      res.status(500).json({ error: 'Failed to fetch comments' });
    }
  });

  // Like a comment
  app.post("/api/comments/:commentId/like", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      // Check if this is the user's own comment
      const comment = await storage.getCommentById(parseInt(req.params.commentId));
      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }
      if (comment.userId === req.user.id) {
        return res.status(400).json({ error: "Cannot like your own comment" });
      }

      await storage.likeComment(req.user.id, parseInt(req.params.commentId));
      res.sendStatus(200);
    } catch (error) {
      console.error('Error liking comment:', error);
      res.status(500).json({ error: 'Failed to like comment' });
    }
  });

  // Unlike a comment
  app.post("/api/comments/:commentId/unlike", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      await storage.unlikeComment(req.user.id, parseInt(req.params.commentId));
      res.sendStatus(200);
    } catch (error) {
      console.error('Error unliking comment:', error);
      res.status(500).json({ error: 'Failed to unlike comment' });
    }
  });

  // Watch status
  app.get("/api/content/:contentId/watch", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      const status = await storage.getWatchStatus(
        req.user.id,
        parseInt(req.params.contentId)
      );

      res.json({
        watched: status ? status.watched : false
      });
    } catch (error) {
      console.error('Error getting watch status:', error);
      res.status(500).json({ error: 'Failed to get watch status' });
    }
  });

  app.post("/api/content/:contentId/watch", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      const status = await storage.updateWatchStatus(
        req.user.id,
        parseInt(req.params.contentId),
        req.body.watched
      );

      res.json({
        watched: status.watched
      });
    } catch (error) {
      console.error('Error updating watch status:', error);
      res.status(500).json({ error: 'Failed to update watch status' });
    }
  });

  // Analytics
  app.get("/api/analytics", async (req, res) => {
    if (!req.user?.isCoach) {
      return res.status(403).send("Only coaches can access analytics");
    }

    const db = knex({
      client: 'pg',
      connection: process.env.DATABASE_URL
    });

    try {
      // Get total views per content
      const contentViews = await db
        .select({
          id: 'id',
          title: 'title',
          views: 'views',
          category: 'category',
        })
        .from('content_links')
        .where('coach_id', req.user.id);

      // Get watch stats by category - summing total views
      const watchStats = await db
        .select({
          category: 'content_links.category',
          watchCount: db.raw('COALESCE(sum(content_links.views), 0)::integer')
        })
        .from('content_links')
        .where('content_links.coach_id', req.user.id)
        .groupBy('content_links.category');

      // Get unique viewers per content
      const uniqueViewers = await db
        .select({
          contentId: 'content_links.id',
          title: 'content_links.title',
          uniqueViewers: db.raw('count(distinct case when watch_status.watched then watch_status.user_id end)::integer')
        })
        .from('content_links')
        .leftJoin('watch_status', 'content_links.id', 'watch_status.content_id')
        .where('content_links.coach_id', req.user.id)
        .groupBy('content_links.id', 'content_links.title');

      res.json({
        contentViews,
        watchStats,
        uniqueViewers,
      });
    } finally {
      await db.destroy();
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}