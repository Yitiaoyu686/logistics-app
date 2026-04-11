import express from 'express';
import cors from 'cors';
import { createTables } from './database/schema';
import { seedDatabase } from './database/seed';
import authRoutes from './routes/auth';
import systemRoutes from './routes/system';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Database init
createTables();
seedDatabase();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/system', systemRoutes);

// Compatibility aliases (Web client uses these paths)
app.use('/api', systemRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
