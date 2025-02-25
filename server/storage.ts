import { User, InsertUser, ContentLink, Comment, WatchStatus, commentLikes } from "@shared/schema";
import { users, contentLinks, comments, watchStatus, commentLikes as commentLikesTable } from "@shared/schema";
import { eq, sql, desc, asc, and } from "drizzle-orm";
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
  getCommentsByContent(
    contentId: number,
    sortBy?: 'newest' | 'oldest' | 'likes'
  ): Promise<(Comment & { username: string; likeCount: number })[]>;
  getCommentById(id: number): Promise<(Comment & { userId: number }) | undefined>;

  // Watch status
  updateWatchStatus(userId: number, contentId: number, watched: boolean): Promise<WatchStatus>;
  getWatchStatus(userId: number, contentId: number): Promise<WatchStatus | undefined>;

  // View tracking
  incrementViews(contentId: number): Promise<void>;
  getWatchersForContent(contentId: number): Promise<{ username: string; watched: boolean }[]>;

  sessionStore: session.Store;

  // Comment likes
  likeComment(userId: number, commentId: number): Promise<void>;
  unlikeComment(userId: number, commentId: number): Promise<void>;
  hasUserLikedComment(userId: number, commentId: number): Promise<boolean>;
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

  async getCommentsByContent(
    contentId: number,
    sortBy: 'newest' | 'oldest' | 'likes' = 'newest'
  ): Promise<(Comment & { username: string; likeCount: number })[]> {
    // Subquery to count likes per comment
    const likesCount = db
      .select({
        commentId: commentLikesTable.commentId,
        count: sql<number>`count(*)::integer`.as('count'),
      })
      .from(commentLikesTable)
      .groupBy(commentLikesTable.commentId)
      .as('likes_count');

    const baseQuery = db
      .select({
        id: comments.id,
        content: comments.content,
        userId: comments.userId,
        contentId: comments.contentId,
        createdAt: comments.createdAt,
        username: users.username,
        likeCount: sql<number>`COALESCE(${likesCount.count}, 0)::integer`,
      })
      .from(comments)
      .leftJoin(likesCount, eq(comments.id, likesCount.commentId))
      .innerJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.contentId, contentId));

    // Apply sorting
    if (sortBy === 'newest') {
      return await baseQuery.orderBy(desc(comments.createdAt));
    } else if (sortBy === 'oldest') {
      return await baseQuery.orderBy(asc(comments.createdAt));
    } else {
      return await baseQuery.orderBy(desc(sql`COALESCE(${likesCount.count}, 0)`));
    }
  }

  async getCommentById(id: number): Promise<(Comment & { userId: number }) | undefined> {
    const [comment] = await db
      .select()
      .from(comments)
      .where(eq(comments.id, id));
    return comment;
  }

  async updateWatchStatus(userId: number, contentId: number, watched: boolean): Promise<WatchStatus> {
    try {
      // Use an upsert operation to either update existing or create new record
      const [status] = await db
        .insert(watchStatus)
        .values({
          userId,
          contentId,
          watched
        })
        .onConflictDoUpdate({
          target: [watchStatus.userId, watchStatus.contentId],
          set: { watched }
        })
        .returning();

      return status;
    } catch (error) {
      console.error('Error updating watch status:', error);
      throw error;
    }
  }

  async getWatchStatus(userId: number, contentId: number): Promise<WatchStatus | undefined> {
    // Get watch status for this specific user and content combination using AND condition
    const [status] = await db
      .select()
      .from(watchStatus)
      .where(sql`${watchStatus.userId} = ${userId} AND ${watchStatus.contentId} = ${contentId}`);

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

  async likeComment(userId: number, commentId: number): Promise<void> {
    await db
      .insert(commentLikesTable)
      .values({ userId, commentId })
      .onConflictDoNothing(); // If already liked, do nothing
  }

  async unlikeComment(userId: number, commentId: number): Promise<void> {
    await db
      .delete(commentLikesTable)
      .where(
        and(
          eq(commentLikesTable.userId, userId),
          eq(commentLikesTable.commentId, commentId)
        )
      );
  }

  async hasUserLikedComment(userId: number, commentId: number): Promise<boolean> {
    const [like] = await db
      .select()
      .from(commentLikesTable)
      .where(
        and(
          eq(commentLikesTable.userId, userId),
          eq(commentLikesTable.commentId, commentId)
        )
      );
    return !!like;
  }
}

export const storage = new DatabaseStorage();