import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertContentSchema, insertCommentSchema } from "@shared/schema";

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

    const content = await storage.createContent(parsed.data, req.user.id);
    res.status(201).json(content);
  });

  app.get("/api/content", async (_req, res) => {
    const content = await storage.getAllContent();
    res.json(content);
  });

  // Comments
  app.post("/api/content/:contentId/comments", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    const parsed = insertCommentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json(parsed.error);
    }

    const comment = await storage.createComment(
      { ...parsed.data, contentId: parseInt(req.params.contentId) },
      req.user.id
    );
    res.status(201).json(comment);
  });

  app.get("/api/content/:contentId/comments", async (req, res) => {
    const comments = await storage.getCommentsByContent(parseInt(req.params.contentId));
    res.json(comments);
  });

  // Watch status
  app.post("/api/content/:contentId/watch", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    const status = await storage.updateWatchStatus(
      req.user.id,
      parseInt(req.params.contentId),
      req.body.watched
    );
    res.json(status);
  });

  app.get("/api/content/:contentId/watch", async (req, res) => {
    if (!req.user) return res.sendStatus(401);

    const status = await storage.getWatchStatus(
      req.user.id,
      parseInt(req.params.contentId)
    );
    res.json(status || { watched: false });
  });

  const httpServer = createServer(app);
  return httpServer;
}
