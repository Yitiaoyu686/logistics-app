import AsyncStorage from '@react-native-async-storage/async-storage';

import { Platform } from 'react-native';

// Web uses localhost, native device uses computer's local IP
const BASE_URL = Platform.OS === 'web'
  ? 'http://localhost:3001/api'
  : 'http://192.168.3.127:3001/api';

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('token');
}

async function request(method: string, path: string, body?: any): Promise<any> {
  const token = await getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
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
};

// Orders
export const orderApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/v2/oms/orders${qs}`);
  },
  get: (id: string) => api.get(`/v2/oms/orders/${id}/full`),
};

// Customers
export const customerApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/v2/oms/customers${qs}`);
  },
  get: (id: string) => api.get(`/v2/oms/customers/${id}`),
};

// Warehouse
export const warehouseApi = {
  getStock: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api.get(`/warehouse/stock${qs}`);
  },
  getTransfers: () => api.get('/warehouse/transfers'),
  getUnmatched: () => api.get('/warehouse/no-order-express'),
  createInbound: (data: any) => api.post('/v2/wms/inbounds', data),
};

// DPN & Delivery
export const deliveryApi = {
  getDpns: () => api.get('/v2/pod/dpns'),
  getDpn: (id: string) => api.get(`/v2/pod/dpns/${id}`),
  updateDpn: (id: string, data: any) => api.put(`/v2/pod/dpns/${id}`, data),
  bindSubOrders: (id: string, subOrderIds: string[]) => api.post(`/v2/pod/dpns/${id}/bind-sub-orders`, { subOrderIds }),
  getDeliveryTasks: () => api.get('/v2/pod/delivery-tasks'),
  getPickups: () => api.get('/delivery/pickups'),
  signDelivery: (id: string, data: any) => api.post(`/v2/pod/delivery-tasks/${id}/sign`, data),
  failDelivery: (id: string, data: any) => api.post(`/v2/pod/delivery-tasks/${id}/fail`, data),
  notifyPickup: (id: string) => api.put(`/delivery/pickups/${id}/notify`),
  completePickup: (id: string) => api.put(`/delivery/pickups/${id}/complete`),
};
