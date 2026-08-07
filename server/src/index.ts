import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { setupSocket } from './socket';

// Routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import sessionRoutes from './routes/session.routes';
import scenarioRoutes from './routes/scenario.routes';
import actionRoutes from './routes/action.routes';
import analyticsRoutes from './routes/analytics.routes';
import recommendationsRoutes from './routes/recommendations.routes';
import modulesRoutes from './routes/modules.routes';
import labsRoutes from './routes/labs.routes';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(morgan('dev'));

// Setup Socket.IO
setupSocket(httpServer);

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/scenarios', scenarioRoutes);
app.use('/api', actionRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/recommendations', recommendationsRoutes);
app.use('/api/modules', modulesRoutes);
app.use('/api/labs', labsRoutes);

// Global Error Handler
app.use(errorHandler);

// Graceful shutdown
const shutdown = () => {
  console.log('Shutting down gracefully...');
  httpServer.close(() => {
    console.log('Closed out remaining connections.');
    process.exit(0);
  });
  
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start server
httpServer.listen(env.PORT, () => {
  console.log(`🚀 CyberLearn server running on port ${env.PORT}`);
});
