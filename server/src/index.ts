import express from 'express';
import cors from 'cors';
import { createTables } from './database/schema';
import { seedData } from './database/seed';
import { createV2Tables } from './database/schemaV2';
import { seedV2Data } from './database/seedV2';
import { errorHandler } from './middleware/errorHandler';
import { closeDb } from './database/connection';
import { closeV2Db, getV2DbPath } from './database/connectionV2';

import authRoutes from './routes/auth';
import clientRoutes from './routes/clients';
import orderRoutes from './routes/orders';
import jobRoutes from './routes/jobs';
import warehouseRoutes from './routes/warehouse';
import deliveryRoutes from './routes/delivery';
import financeRoutes from './routes/finance';
import salesRoutes from './routes/sales';
import notificationRoutes from './routes/notifications';
import systemRoutes from './routes/system';
import v2Routes from './routes/v2';

const app = express();
const port = parseInt(process.env.PORT || '3001');

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Initialize database
try {
  createTables();
  seedData();
  createV2Tables();
  seedV2Data();
  console.log('Database initialized successfully');
  console.log(`V2 database initialized at ${getV2DbPath()}`);
} catch (err) {
  console.error('Database initialization failed:', err);
  process.exit(1);
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api', financeRoutes);  // handles /api/fees/* and /api/suppliers/*
app.use('/api/sales', salesRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/system', systemRoutes);
app.use('/api', systemRoutes); // for /api/no-order-express
app.use('/api/v2', v2Routes);

// Error handler
app.use(errorHandler);

// Graceful shutdown
process.on('SIGINT', () => {
  closeDb();
  closeV2Db();
  process.exit(0);
});

process.on('SIGTERM', () => {
  closeDb();
  closeV2Db();
  process.exit(0);
});

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
