import express from 'express';
import cors from 'cors';
import http from 'http';
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

// 非 API 请求代理到 Expo Metro (8082)，统一走 ngrok 域名
app.use('/', (req, res) => {
  const fwd: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade'].includes(k.toLowerCase())) {
      fwd[k] = v as string;
    }
  }
  const proxy = http.request({ hostname: 'localhost', port: 8082, path: req.url, method: req.method, headers: fwd }, (pres) => {
    res.writeHead(pres.statusCode || 200, pres.headers);
    pres.pipe(res);
  });
  proxy.on('error', () => { res.status(502).send('Frontend unavailable'); });
  req.pipe(proxy);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Network: http://192.168.3.127:${PORT}`);
});
