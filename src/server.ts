import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import runMigrations from './config/migrate';
import reminderSystem from './services/reminder-system';

// Import routes
import authRoutes from './routes/auth.routes';
import feedbackRoutes from './routes/feedback.routes';
import cyclesRoutes from './routes/cycles.routes';
import analyticsRoutes from './routes/analytics.routes';
import employeesRoutes from './routes/employees.routes';
import notificationsRoutes from './routes/notifications.routes';
import pulseRoutes from './routes/pulse.routes';
import actionsRoutes from './routes/actions.routes';
import chatbotRoutes from './routes/chatbot.routes';
import agentsRoutes from './routes/agents.routes';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/cycles', cyclesRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/employees', employeesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/pulse', pulseRoutes);
app.use('/api/actions', actionsRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/agents', agentsRoutes);

// Demo/Admin routes
app.post('/api/admin/init-demo', async (req: Request, res: Response) => {
  try {
    const collaborationTracker = require('./services/collaboration-tracker').default;
    const peerRanker = require('./services/peer-ranker').default;

    await collaborationTracker.generateSampleData();
    await peerRanker.rankAllPeers();

    res.json({ message: 'Demo data initialized successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize database and start server
async function startServer() {
  try {
    console.log('🔄 Initializing database...');
    await runMigrations();

    console.log('🚀 Starting server...');
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`📊 API available at http://localhost:${PORT}/api`);
      console.log(`🏥 Health check: http://localhost:${PORT}/health`);
      
      // Start reminder system
      reminderSystem.start();
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer();

export default app;

