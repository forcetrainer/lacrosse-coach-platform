import { User, InsertUser, ContentLink, Comment, WatchStatus } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Content management
  createContent(content: Omit<ContentLink, "id">, coachId: number): Promise<ContentLink>;
  getContent(id: number): Promise<ContentLink | undefined>;
  getAllContent(): Promise<ContentLink[]>;
  
  // Comments
  createComment(comment: Omit<Comment, "id" | "createdAt">, userId: number): Promise<Comment>;
  getCommentsByContent(contentId: number): Promise<Comment[]>;
  
  // Watch status
  updateWatchStatus(userId: number, contentId: number, watched: boolean): Promise<WatchStatus>;
  getWatchStatus(userId: number, contentId: number): Promise<WatchStatus | undefined>;
  
  sessionStore: session.Store;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private content: Map<number, ContentLink>;
  private comments: Map<number, Comment>;
  private watchStatuses: Map<string, WatchStatus>;
  private currentId: number;
  readonly sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.content = new Map();
    this.comments = new Map();
    this.watchStatuses = new Map();
    this.currentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createContent(content: Omit<ContentLink, "id">, coachId: number): Promise<ContentLink> {
    const id = this.currentId++;
    const newContent = { ...content, id, coachId };
    this.content.set(id, newContent);
    return newContent;
  }

  async getContent(id: number): Promise<ContentLink | undefined> {
    return this.content.get(id);
  }

  async getAllContent(): Promise<ContentLink[]> {
    return Array.from(this.content.values());
  }

  async createComment(comment: Omit<Comment, "id" | "createdAt">, userId: number): Promise<Comment> {
    const id = this.currentId++;
    const newComment = {
      ...comment,
      id,
      userId,
      createdAt: new Date(),
    };
    this.comments.set(id, newComment);
    return newComment;
  }

  async getCommentsByContent(contentId: number): Promise<Comment[]> {
    return Array.from(this.comments.values()).filter(
      (comment) => comment.contentId === contentId,
    );
  }

  async updateWatchStatus(userId: number, contentId: number, watched: boolean): Promise<WatchStatus> {
    const key = `${userId}-${contentId}`;
    const status = {
      id: this.currentId++,
      userId,
      contentId,
      watched,
    };
    this.watchStatuses.set(key, status);
    return status;
  }

  async getWatchStatus(userId: number, contentId: number): Promise<WatchStatus | undefined> {
    return this.watchStatuses.get(`${userId}-${contentId}`);
  }
}

export const storage = new MemStorage();
