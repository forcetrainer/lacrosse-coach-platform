import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isCoach: boolean("is_coach").notNull().default(false),
});

export const contentLinks = pgTable("content_links", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  coachId: integer("coach_id").notNull(),
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  userId: integer("user_id").notNull(),
  contentId: integer("content_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const watchStatus = pgTable("watch_status", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  contentId: integer("content_id").notNull(),
  watched: boolean("watched").notNull().default(false),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  isCoach: true,
});

export const insertContentSchema = createInsertSchema(contentLinks).pick({
  url: true,
  title: true,
  category: true,
});

export const insertCommentSchema = createInsertSchema(comments).pick({
  content: true,
  contentId: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type ContentLink = typeof contentLinks.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type WatchStatus = typeof watchStatus.$inferSelect;
