import { pgTable, text, serial, integer, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Helper for validating social media URLs
const socialMediaUrlSchema = z.string().url().refine((url) => {
  const supportedPlatforms = [
    'youtube.com',
    'youtu.be',
    'instagram.com',
    'tiktok.com',
    'facebook.com',
    'fb.watch'
  ];
  try {
    const urlObj = new URL(url);
    return supportedPlatforms.some(platform => urlObj.hostname.includes(platform));
  } catch {
    return false;
  }
}, "URL must be from a supported social media platform (YouTube, Instagram, TikTok, or Facebook)");

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
  platform: text("platform").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  description: text("description").notNull(),
  views: integer("views").notNull().default(0),
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
}, (table) => ({
  // Add unique constraint properly using Drizzle syntax
  uniqueIndex: uniqueIndex("watch_status_user_content_idx").on(table.userId, table.contentId),
}));

// New likes table
export const commentLikes = pgTable("comment_likes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  commentId: integer("comment_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  // Ensure a user can only like a comment once
  uniqueIndex: uniqueIndex("comment_likes_user_comment_idx").on(table.userId, table.commentId),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  isCoach: true,
});

export const insertContentSchema = createInsertSchema(contentLinks)
  .pick({
    url: true,
    title: true,
    category: true,
    description: true,
  })
  .extend({
    url: socialMediaUrlSchema,
  })
  .transform((data) => {
    const { platform, thumbnailUrl } = extractVideoInfo(data.url);
    return {
      ...data,
      platform,
      thumbnailUrl,
    };
  });

export const insertCommentSchema = createInsertSchema(comments).pick({
  content: true,
  contentId: true,
}).extend({
  content: z.string()
    .min(1, "Comment cannot be empty")
    .max(1000, "Comment cannot exceed 1000 characters"),
  contentId: z.number().positive("Invalid content ID")
});

export const insertCommentLikeSchema = createInsertSchema(commentLikes).pick({
  commentId: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type ContentLink = typeof contentLinks.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type WatchStatus = typeof watchStatus.$inferSelect;
export type CommentLike = typeof commentLikes.$inferSelect;

// Platform detection helper
export function extractVideoInfo(url: string): { platform: string; thumbnailUrl: string | null } {
  try {
    const urlObj = new URL(url);

    // YouTube
    if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      let videoId;
      if (urlObj.hostname.includes('youtu.be')) {
        videoId = urlObj.pathname.slice(1);
      } else {
        videoId = urlObj.searchParams.get('v');
      }
      return {
        platform: 'YouTube',
        thumbnailUrl: videoId ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg` : null
      };
    }

    // Instagram - Use platform logo as fallback
    if (urlObj.hostname.includes('instagram.com')) {
      return {
        platform: 'Instagram',
        thumbnailUrl: 'https://cdinstagram.com' + urlObj.pathname + 'media/?size=l'
      };
    }

    // TikTok
    if (urlObj.hostname.includes('tiktok.com')) {
      return {
        platform: 'TikTok',
        thumbnailUrl: 'https://upload.wikimedia.org/wikipedia/en/a/a9/TikTok_logo.svg'
      };
    }

    // Facebook
    if (urlObj.hostname.includes('facebook.com') || urlObj.hostname.includes('fb.watch')) {
      return {
        platform: 'Facebook',
        thumbnailUrl: 'https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg'
      };
    }

    return { platform: 'Other', thumbnailUrl: null };
  } catch {
    return { platform: 'Invalid URL', thumbnailUrl: null };
  }
}