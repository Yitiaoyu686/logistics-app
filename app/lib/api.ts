import AsyncStorage from '@react-native-async-storage/async-storage';

import { Platform } from 'react-native';

const LOCAL_URL = 'http://localhost:3001/api';
const LAN_URL = 'http://192.168.3.127:3001/api';

const BASE_URL = Platform.OS === 'web'
  ? '/api'
  : LAN_URL;

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('token');
}

async function request(method: string, path: string, body?: any): Promise<any> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': '1',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    throw new Error('登录已过期');
  }

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || '请求失败');
  return json;
}

export const api = {
  get: (path: string) => request('GET', path),
  post: (path: string, body?: any) => request('POST', path, body),
  put: (path: string, body?: any) => request('PUT', path, body),
  delete: (path: string) => request('DELETE', path),
};

// Auth
export const authApi = {
  login: (username: string, password: string) => api.post('/auth/login', { username, password }),
};

// Notifications
export const notificationApi = {
  list: () => api.get('/system/notifications'),
};

// Jobs (TMS)
export const jobApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/jobs${qs}`);
  },
  get: (jobNo: string) => api.get(`/jobs/${jobNo}`),
  update: (jobNo: string, data: any) => api.put(`/jobs/${jobNo}`, data),
  addEvent: (data: any) => api.post('/v2/tms/tracking-events', data),
  createShippingUnit: (data: any) => api.post('/v2/tms/shipping-units', data),
};

// Orders
export const orderApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/v2/oms/orders${qs}`);
  },
  get: (id: string) => api.get(`/v2/oms/orders/${id}/full`),
  create: (data: any) => api.post('/v2/oms/orders', data),
  update: (id: string, data: any) => api.put(`/v2/oms/orders/${id}`, data),
  pay: (id: string) => api.post(`/v2/oms/orders/${id}/pay`, {}),
  // 扫码按子单号/运单号查子单(返回 id + 基础信息)
  getSubByNo: (subOrderNo: string) => api.get(`/orders/sub/${encodeURIComponent(subOrderNo)}`),
};

// Customers
export const customerApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/v2/oms/customers${qs}`);
  },
  get: (id: string) => api.get(`/v2/oms/customers/${id}`),
  create: (data: any) => api.post('/v2/oms/customers', data),
  update: (id: string, data: any) => api.put(`/v2/oms/customers/${id}`, data),
  claim: (id: string, userId?: string) => api.post(`/v2/oms/customers/${id}/claim`, { userId }),
  release: (id: string) => api.post(`/v2/oms/customers/${id}/release`, {}),
};

// Sales 工作台数据
export const salesApi = {
  dashboard: (salesId?: string) => {
    const qs = salesId ? `?salesId=${salesId}` : '';
    return api.get(`/sales/dashboard${qs}`);
  },
  pendingPayments: () => api.get('/sales/pending-payments'),
};

// 系统 (路线等)
export const systemApi = {
  routes: () => api.get('/system/routes'),
  countries: () => api.get('/system/countries'),
  expressCompanies: () => api.get('/system/express-companies'),
  carriers: () => api.get('/system/carriers'),
  suppliers: () => api.get('/system/suppliers'),
  feeTypes: () => api.get('/system/fee-types'),
};

// Warehouse
export const warehouseApi = {
  getStock: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/warehouse/stock${qs}`);
  },
  getTransfers: () => api.get('/warehouse/transfers'),
  getTransferDetail: (id: string) => api.get(`/warehouse/transfers/${id}`),
  createTransfer: (data: any) => api.post('/warehouse/transfers', data),
  updateTransfer: (id: string, data: any) => api.put(`/warehouse/transfers/${id}`, data),
  scanInboundTransfer: (id: string, data: any) => api.post(`/warehouse/transfers/${id}/scan-inbound`, data),
  addTransferItem: (id: string, data: any) => api.post(`/warehouse/transfers/${id}/items`, data),
  confirmTransferInbound: (id: string) => api.post(`/warehouse/transfers/${id}/confirm-inbound`, {}),
  getUnmatched: () => api.get('/warehouse/no-order-express'),
  createUnmatched: (data: any) => api.post('/warehouse/no-order-express', data),
  matchUnmatched: (id: string, data: any) => api.post(`/v2/wms/unmatched-packages/${id}/match`, data),
  createInbound: (data: any) => api.post('/v2/wms/inbounds', data),
  submitDestInbound: (jobId: string, data: any) => api.post(`/v2/wms/dest-inbound/${jobId}/submit`, data),
  getInbound: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/warehouse/inbound${qs}`);
  },
  getUnits: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/warehouse/units${qs}`);
  },
  getReturns: () => api.get('/warehouse/returns'),
  applyReturn: (stockId: string, data: any) => api.post(`/warehouse/stock/${stockId}/return`, data),
  // 装箱:把运单绑到集装号
  loadUnit: (unitId: string, subOrderIds: string[]) =>
    api.post(`/warehouse/units/${unitId}/load`, { subOrderIds }),
  // 解绑:从集装号撤销运单
  unbindUnitItem: (unitId: string, subOrderId: string) =>
    api.delete(`/warehouse/units/${unitId}/items/${subOrderId}`),
};

// DPN & Delivery
export const deliveryApi = {
  getDpns: () => api.get('/v2/pod/dpns'),
  getDpn: (id: string) => api.get(`/v2/pod/dpns/${id}`),
  createDpn: (data: any) => api.post('/v2/pod/dpns', data),
  updateDpn: (id: string, data: any) => api.put(`/v2/pod/dpns/${id}`, data),
  getDpnItems: (id: string) => api.get(`/v2/pod/dpns/${id}/items`),
  scanReceiveDpn: (id: string, data: any) => api.post(`/v2/pod/dpns/${id}/scan-receive`, data),
  bindSubOrders: (id: string, subOrderIds: string[]) => api.post(`/v2/pod/dpns/${id}/bind-sub-orders`, { subOrderIds }),
  getDeliveryTasks: () => api.get('/v2/pod/delivery-tasks'),
  getPickups: () => api.get('/delivery/pickups'),
  signDelivery: (id: string, data: any) => api.post(`/v2/pod/delivery-tasks/${id}/sign`, data),
  failDelivery: (id: string, data: any) => api.post(`/v2/pod/delivery-tasks/${id}/fail`, data),
  notifyPickup: (id: string) => api.put(`/delivery/pickups/${id}/notify`),
  completePickup: (id: string) => api.put(`/delivery/pickups/${id}/complete`),
};
