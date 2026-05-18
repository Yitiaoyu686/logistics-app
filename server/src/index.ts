import express from 'express';
import cors from 'cors';
import path from 'path';
import { createTables } from './database/schema';
import { seedDatabase } from './database/seed';
import authRoutes from './routes/auth';
import systemRoutes from './routes/system';
import customerRoutes from './routes/customers';
import orderRoutes from './routes/orders';
import warehouseRoutes from './routes/warehouse';
import jobRoutes from './routes/jobs';
import deliveryRoutes from './routes/delivery';
import compatRoutes from './routes/compat';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Database init
createTables();
seedDatabase();

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes
app.use('/api/auth', authRoutes);

// System management routes (Web 端系统管理)
app.use('/api/system', systemRoutes);

// V2 OMS routes (customers + orders)
app.use('/api/v2/oms/customers', customerRoutes);
app.use('/api/v2/oms/orders', orderRoutes);
app.use('/api/v2/oms', orderRoutes);  // for /api/v2/oms/users/sales

// Legacy client routes (Web 端客户中心)
app.use('/api/clients', customerRoutes);

// Warehouse routes (WMS)
app.use('/api/v2/wms', warehouseRoutes);
app.use('/api/warehouse', warehouseRoutes);

// Job routes (TMS)
app.use('/api/jobs', jobRoutes);
app.use('/api/v2/tms/jobs', jobRoutes);
app.use('/api/v2/tms', jobRoutes);  // for tracking-events

// Delivery routes (POD)
app.use('/api/v2/pod', deliveryRoutes);
app.use('/api/delivery', deliveryRoutes);

// Compatibility: system routes also mounted at /api root for Web client
app.use('/api', systemRoutes);

// Web 端旧接口兼容层
app.use('/api', compatRoutes);

// 前端静态构建文件
app.use(express.static(path.join(__dirname, '../../app/dist')));
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, '../../app/dist/index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Network: http://192.168.3.127:${PORT}`);
});
