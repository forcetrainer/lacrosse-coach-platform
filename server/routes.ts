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

    const content = await storage.createContent(
      { ...parsed.data },
      req.user.id
    );
    res.status(201).json(content);
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

  app.delete("/api/content/:id", async (req, res) => {
    if (!req.user?.isCoach) {
      return res.status(403).send("Only coaches can delete content");
    }

    await storage.deleteContent(parseInt(req.params.id));
    res.sendStatus(200);
  });

  app.post("/api/content/:id/view", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    // Only increment views for non-coach users
    if (!req.user.isCoach) {
      await storage.incrementViews(parseInt(req.params.id));

      // Also update watch status when viewing
      await storage.updateWatchStatus(
        req.user.id,
        parseInt(req.params.id),
        true
      );
    }

    res.sendStatus(200);
  });

  // Comments
  app.post("/api/content/:contentId/comments", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    const parsed = insertCommentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error);
    }

    const comment = await storage.createComment(
      parsed.data,
      req.user.id
    );
    res.status(201).json(comment);
  });

  app.get("/api/content/:contentId/comments", async (req, res) => {
    const comments = await storage.getCommentsByContent(parseInt(req.params.contentId));
    res.json(comments);
  });

  // Watch status
  app.get("/api/content/:contentId/watch", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    try {
      // Get watch status for this specific user and content combination
      const status = await storage.getWatchStatus(
        req.user.id,
        parseInt(req.params.contentId)
      );

      // Video is only watched if:
      // 1. A record exists
      // 2. The record belongs to the current user
      // 3. The watched flag is true
      res.json({
        watched: status?.userId === req.user.id && status?.watched === true
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

      // Return watched status only if:
      // 1. The record belongs to the current user
      // 2. The watched flag is true
      res.json({
        watched: status.userId === req.user.id && status.watched === true
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