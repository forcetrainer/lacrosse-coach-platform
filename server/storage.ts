import { User, InsertUser, ContentLink, Comment, WatchStatus } from "@shared/schema";
import { users, contentLinks, comments, watchStatus } from "@shared/schema";
import { eq, sql, desc } from "drizzle-orm";
import { db } from "./db";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db";

const PostgresStore = connectPgSimple(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Content management
  createContent(content: Omit<ContentLink, "id" | "views">, coachId: number): Promise<ContentLink>;
  getContent(id: number): Promise<ContentLink | undefined>;
  getAllContent(): Promise<ContentLink[]>;
  deleteContent(id: number): Promise<void>;

  // Comments
  createComment(comment: Omit<Comment, "id" | "createdAt">, userId: number): Promise<Comment>;
  getCommentsByContent(contentId: number): Promise<(Comment & { username: string })[]>;

  // Watch status
  updateWatchStatus(userId: number, contentId: number, watched: boolean): Promise<WatchStatus>;
  getWatchStatus(userId: number, contentId: number): Promise<WatchStatus | undefined>;

  // View tracking
  incrementViews(contentId: number): Promise<void>;
  getWatchersForContent(contentId: number): Promise<{ username: string; watched: boolean }[]>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  readonly sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createContent(content: Omit<ContentLink, "id" | "views">, coachId: number): Promise<ContentLink> {
    const [newContent] = await db
      .insert(contentLinks)
      .values({ ...content, coachId, views: 0 })
      .returning();
    return newContent;
  }

  async getContent(id: number): Promise<ContentLink | undefined> {
    const [content] = await db.select().from(contentLinks).where(eq(contentLinks.id, id));
    return content;
  }

  async getAllContent(): Promise<ContentLink[]> {
    return await db.select().from(contentLinks);
  }

  async deleteContent(id: number): Promise<void> {
    await db.delete(contentLinks).where(eq(contentLinks.id, id));
  }

  async createComment(comment: Omit<Comment, "id" | "createdAt">, userId: number): Promise<Comment> {
    const [newComment] = await db
      .insert(comments)
      .values({ ...comment, userId })
      .returning();
    return newComment;
  }

  async getCommentsByContent(contentId: number): Promise<(Comment & { username: string })[]> {
    return await db
      .select({
        id: comments.id,
        content: comments.content,
        userId: comments.userId,
        contentId: comments.contentId,
        createdAt: comments.createdAt,
        username: users.username
      })
      .from(comments)
      .where(eq(comments.contentId, contentId))
      .innerJoin(users, eq(comments.userId, users.id))
      .orderBy(desc(comments.createdAt));
  }

  async updateWatchStatus(userId: number, contentId: number, watched: boolean): Promise<WatchStatus> {
    // Start a transaction to ensure data consistency
    return await db.transaction(async (tx) => {
      // Try to find existing watch status for this specific user and content
      const [existingStatus] = await tx
        .select()
        .from(watchStatus)
        .where(eq(watchStatus.userId, userId))
        .where(eq(watchStatus.contentId, contentId));

      if (existingStatus) {
        // Update existing status
        const [updated] = await tx
          .update(watchStatus)
          .set({ watched })
          .where(eq(watchStatus.id, existingStatus.id))
          .returning();
        return updated;
      } else {
        // Create new status
        const [newStatus] = await tx
          .insert(watchStatus)
          .values({ userId, contentId, watched })
          .returning();
        return newStatus;
      }
    });
  }

  async getWatchStatus(userId: number, contentId: number): Promise<WatchStatus | undefined> {
    // Get watch status for this specific user and content combination
    const [status] = await db
      .select()
      .from(watchStatus)
      .where(eq(watchStatus.userId, userId))
      .where(eq(watchStatus.contentId, contentId))
      .limit(1);

    return status;
  }

  async incrementViews(contentId: number): Promise<void> {
    await db
      .update(contentLinks)
      .set({ views: sql`${contentLinks.views} + 1` })
      .where(eq(contentLinks.id, contentId));
  }

  async getWatchersForContent(contentId: number): Promise<{ username: string; watched: boolean }[]> {
    return await db
      .select({
        username: users.username,
        watched: watchStatus.watched,
      })
      .from(watchStatus)
      .where(eq(watchStatus.contentId, contentId))
      .innerJoin(users, eq(watchStatus.userId, users.id))
      .orderBy(users.username);
  }
}

export const storage = new DatabaseStorage();