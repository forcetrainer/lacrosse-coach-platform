import { Express } from "express";
import { storage } from "./storage";
import { db, pool } from "./db";
import os from "os";

interface SystemMetrics {
  uptime: number;
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  activeSessions: number;
  databaseStatus: {
    isConnected: boolean;
    connectionCount: number;
    idleConnections: number;
  };
  lastMinuteRequests: number;
  errorRate: number;
}

// Track request counts and errors
let requestCount = 0;
let errorCount = 0;
const requestHistory: { timestamp: number; isError: boolean }[] = [];

// Clean up old request history every minute
setInterval(() => {
  const oneMinuteAgo = Date.now() - 60000;
  while (requestHistory.length > 0 && requestHistory[0].timestamp < oneMinuteAgo) {
    requestHistory.shift();
  }
}, 60000);

export function setupHealthMonitoring(app: Express) {
  // Middleware to track requests and errors
  app.use((req, res, next) => {
    const start = Date.now();
    requestCount++;

    requestHistory.push({
      timestamp: Date.now(),
      isError: false
    });

    res.on('finish', () => {
      if (res.statusCode >= 400) {
        errorCount++;
        requestHistory[requestHistory.length - 1].isError = true;
      }
    });

    next();
  });

  app.get("/api/health", async (req, res) => {
    if (!req.user?.isCoach) {
      return res.status(403).send("Only coaches can access health metrics");
    }

    try {
      // Get database connection status
      const dbStatus = {
        isConnected: pool.totalCount > 0,
        connectionCount: pool.totalCount,
        idleConnections: pool.idleCount
      };

      // Get active sessions
      let activeSessions = 0;
      try {
        if (storage.sessionStore.length) {
          activeSessions = await new Promise<number>((resolve, reject) => {
            storage.sessionStore.length((err, length) => {
              if (err) reject(err);
              else resolve(length || 0);
            });
          });
        }
      } catch (error) {
        console.error('Error getting session count:', error);
      }

      // Calculate last minute metrics
      const oneMinuteAgo = Date.now() - 60000;
      const recentRequests = requestHistory.filter(r => r.timestamp >= oneMinuteAgo);
      const recentErrors = recentRequests.filter(r => r.isError);

      const metrics: SystemMetrics = {
        uptime: process.uptime(),
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem(),
          usagePercent: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
        },
        activeSessions,
        databaseStatus: dbStatus,
        lastMinuteRequests: recentRequests.length,
        errorRate: recentRequests.length ? (recentErrors.length / recentRequests.length) * 100 : 0
      };

      res.json(metrics);
    } catch (error) {
      console.error('Error fetching health metrics:', error);
      res.status(500).json({ error: 'Failed to fetch health metrics' });
    }
  });
}