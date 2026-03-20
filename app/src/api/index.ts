import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return Promise.reject(new Error('登录已过期，请重新登录'));
    }
    const message = error.response?.data?.error || error.message || '请求失败';
    return Promise.reject(new Error(message));
  }
);

export default api;

// ==================== Auth ====================
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  getProfile: () => api.get('/auth/profile'),
};

// ==================== Orders ====================
export const orderApi = {
  listMaster: (params?: Record<string, any>) => api.get('/orders/master', { params }),
  getMaster: (id: string) => api.get(`/orders/master/${id}`),
  createMaster: (data: any) => api.post('/orders/master', data),
  listSub: (params?: Record<string, any>) => api.get('/orders/sub', { params }),
  getSub: (id: string) => api.get(`/orders/sub/${id}`),
  createSub: (data: any) => api.post('/orders/sub', data),
  updateSub: (id: string, data: any) => api.put(`/orders/sub/${id}`, data),
  search: (q: string) => api.get('/orders/search', { params: { q } }),
};

// ==================== Clients ====================
export const clientApi = {
  list: (params?: Record<string, any>) => api.get('/clients', { params }),
  get: (id: string) => api.get(`/clients/${id}`),
  create: (data: any) => api.post('/clients', data),
};

// ==================== Warehouse ====================
export const warehouseApi = {
  listInbound: (params?: Record<string, any>) => api.get('/warehouse/inbound', { params }),
  createInbound: (data: any) => api.post('/warehouse/inbound', data),
  listStock: (params?: Record<string, any>) => api.get('/warehouse/stock', { params }),
  listUnits: (params?: Record<string, any>) => api.get('/warehouse/units', { params }),
  createUnit: (data: any) => api.post('/warehouse/units', data),
  updateUnit: (id: string, data: any) => api.put(`/warehouse/units/${id}`, data),
  loadUnit: (id: string, subOrderIds: string[]) => api.post(`/warehouse/units/${id}/load`, { subOrderIds }),
  sealUnit: (id: string, sealNo?: string) => api.post(`/warehouse/units/${id}/seal`, { sealNo }),
  deleteUnit: (id: string) => api.delete(`/warehouse/units/${id}`),
  listTransfers: (params?: Record<string, any>) => api.get('/warehouse/transfers', { params }),
  createTransfer: (data: any) => api.post('/warehouse/transfers', data),
  updateTransfer: (id: string, data: any) => api.put(`/warehouse/transfers/${id}`, data),
  listReturns: (params?: Record<string, any>) => api.get('/warehouse/returns', { params }),
  createReturn: (data: any) => api.post('/warehouse/returns', data),
  updateReturn: (id: string, data: any) => api.put(`/warehouse/returns/${id}`, data),
  listNoOrderExpress: (params?: Record<string, any>) => api.get('/warehouse/no-order-express', { params }),
  createNoOrderExpress: (data: any) => api.post('/warehouse/no-order-express', data),
  updateNoOrderExpress: (id: string, data: any) => api.put(`/warehouse/no-order-express/${id}`, data),
};

// ==================== Delivery ====================
export const deliveryApi = {
  list: (params?: Record<string, any>) => api.get('/delivery', { params }),
  create: (data: any) => api.post('/delivery', data),
  update: (id: string, data: any) => api.put(`/delivery/${id}`, data),
  assign: (id: string, data: any) => api.post(`/delivery/${id}/assign`, data),
  sign: (id: string, photos?: string[]) => api.post(`/delivery/${id}/sign`, { photos }),
};

// ==================== Sales ====================
export const salesApi = {
  dashboard: (salesId?: string) => api.get('/sales/dashboard', { params: { salesId } }),
  pendingPayments: () => api.get('/sales/pending-payments'),
  sendReminder: (data: any) => api.post('/sales/reminders', data),
  getReminderHistory: (paymentId: string) => api.get(`/sales/reminders/${paymentId}`),
  quotes: (params?: Record<string, any>) => api.get('/sales/quotes', { params }),
};

// ==================== Jobs ====================
export const jobApi = {
  list: (params?: Record<string, any>) => api.get('/jobs', { params }),
  get: (jobNo: string) => api.get(`/jobs/${jobNo}`),
};

// ==================== Notifications ====================
export const notificationApi = {
  list: (params?: Record<string, any>) => api.get('/notifications', { params }),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
};

// ==================== System ====================
export const systemApi = {
  routes: (params?: Record<string, any>) => api.get('/system/routes', { params }),
  exchangeRates: () => api.get('/system/exchange-rates'),
};
