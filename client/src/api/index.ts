import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

const directApi = axios.create({
  baseURL: (import.meta.env.VITE_API_DIRECT_BASE_URL as string) || 'http://localhost:3001/api',
  timeout: 15000,
});

const isLocalHost = typeof window !== 'undefined'
  && ['localhost', '127.0.0.1'].includes(window.location.hostname);

const attachAuthToken = (config: any) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

// Add auth token to requests
api.interceptors.request.use(attachAuthToken);
directApi.interceptors.request.use(attachAuthToken);

// Handle response errors
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const isNetworkError = !error?.response;
    const alreadyRetried = Boolean((error?.config as any)?._directRetried);

    if (isLocalHost && isNetworkError && !alreadyRetried) {
      try {
        const retryConfig: any = {
          ...(error.config || {}),
          _directRetried: true,
          baseURL: directApi.defaults.baseURL,
        };
        const directRes = await directApi.request(retryConfig);
        return directRes.data;
      } catch (fallbackError: any) {
        const fallbackMsg = fallbackError?.response?.data?.error || fallbackError?.message || '请求失败';
        return Promise.reject(new Error(`Network Error（代理失败，直连后端也失败）: ${fallbackMsg}`));
      }
    }

    // 401 时自动退出登录（排除 login 请求自身）
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.reload();
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
  listUsers: () => api.get('/auth/users'),
  createUser: (data: any) => api.post('/auth/users', data),
  updateUser: (id: string, data: any) => api.put(`/auth/users/${id}`, data),
  deleteUser: (id: string) => api.delete(`/auth/users/${id}`),
  resetPassword: (id: string, password?: string) => api.post(`/auth/users/${id}/reset-password`, { password }),
};

// ==================== Clients ====================
export const clientApi = {
  list: (params?: Record<string, any>) => api.get('/v2/oms/customers', { params }),
  get: (id: string) => api.get(`/v2/oms/customers/${id}`),
  create: (data: any) => api.post('/v2/oms/customers', data),
  update: (id: string, data: any) => api.put(`/v2/oms/customers/${id}`, data),
  delete: (id: string) => api.delete(`/v2/oms/customers/${id}`),
  claim: (id: string, salesId: string, operatorId?: string, operatorName?: string) =>
    api.post(`/v2/oms/customers/${id}/claim`, { salesId, operatorId, operatorName }),
  release: (id: string, reason?: string, operatorId?: string, operatorName?: string) =>
    api.post(`/v2/oms/customers/${id}/release`, { reason, operatorId, operatorName }),
  transfer: (id: string, toSalesId: string, reason?: string, operatorId?: string, operatorName?: string) =>
    api.post(`/v2/oms/customers/${id}/transfer`, { toSalesId, reason, operatorId, operatorName }),
  poolLogs: (id: string) => api.get(`/v2/oms/customers/${id}/pool-logs`),
};

// ==================== Orders ====================
export const orderApi = {
  // Master orders
  listMaster: (params?: Record<string, any>) => api.get('/orders/master', { params }),
  getMaster: (id: string) => api.get(`/orders/master/${id}`),
  createMaster: (data: any) => api.post('/orders/master', data),
  updateMaster: (id: string, data: any) => api.put(`/orders/master/${id}`, data),
  // Sub orders
  listSub: (params?: Record<string, any>) => api.get('/orders/sub', { params }),
  getSub: (id: string) => api.get(`/orders/sub/${id}`),
  createSub: (data: any) => api.post('/orders/sub', data),
  updateSub: (id: string, data: any) => api.put(`/orders/sub/${id}`, data),
  updateSubStatus: (id: string, status: string, currentNode?: string) =>
    api.put(`/orders/sub/${id}/status`, { status, currentNode }),
  // Return order approval
  approveReturn: (id: string, data?: any) => api.post(`/orders/master/${id}/approve-return`, data),
  rejectReturn: (id: string, data?: any) => api.post(`/orders/master/${id}/reject-return`, data),
  // Search
  search: (q: string) => api.get('/orders/search', { params: { q } }),
};

// ==================== V2 OMS ====================
export const v2OmsApi = {
  listSalesUsers: () => api.get('/v2/oms/users/sales'),
  listCustomers: (params?: Record<string, any>) => api.get('/v2/oms/customers', { params }),
  getCustomer: (id: string) => api.get(`/v2/oms/customers/${id}`),
  listCustomerLineProfiles: (id: string, params?: Record<string, any>) => api.get(`/v2/oms/customers/${id}/line-profiles`, { params }),
  upsertCustomerLineProfile: (id: string, businessLine: 'SEA' | 'AIR', data: any) =>
    api.put(`/v2/oms/customers/${id}/line-profiles/${businessLine}`, data),
  listOrders: (params?: Record<string, any>) => api.get('/v2/oms/orders', { params }),
  getOrderFull: (id: string) => api.get(`/v2/oms/orders/${id}/full`),
  createOrder: (data: any) => api.post('/v2/oms/orders', data),
  updateOrder: (id: string, data: any) => api.put(`/v2/oms/orders/${id}`, data),
  approveReturn: (id: string, data?: any) => api.post(`/v2/oms/orders/${id}/approve-return`, data),
  rejectReturn: (id: string, data?: any) => api.post(`/v2/oms/orders/${id}/reject-return`, data),
};

export const v2WmsApi = {
  createInbound: (data: any) => api.post('/v2/wms/inbounds', data),
  listUnmatchedPackages: (params?: Record<string, any>) => api.get('/v2/wms/unmatched-packages', { params }),
  getUnmatchedRecommendations: (id: string) => api.get(`/v2/wms/unmatched-packages/${id}/recommendations`),
  matchUnmatchedPackage: (id: string, data: any) => api.post(`/v2/wms/unmatched-packages/${id}/match`, data),
  updateUnmatchedPackage: (id: string, data: any) => api.put(`/v2/wms/unmatched-packages/${id}`, data),
  deleteUnmatchedPackage: (id: string) => api.delete(`/v2/wms/unmatched-packages/${id}`),
};

export const v2TmsApi = {
  createJob: (data: any) => api.post('/v2/tms/jobs', data),
  bindSubOrders: (jobId: string, data: any) => api.post(`/v2/tms/jobs/${jobId}/bind-sub-orders`, data),
  createTrackingEvent: (data: any) => api.post('/v2/tms/tracking-events', data),
};

export const v2PodApi = {
  listDpns: (params?: Record<string, any>) => api.get('/v2/pod/dpns', { params }),
  listDpnCandidates: (params?: Record<string, any>) => api.get('/v2/pod/dpn-candidates', { params }),
  getDpnDetail: (id: string) => api.get(`/v2/pod/dpns/${id}`),
  listDeliveryTasks: (params?: Record<string, any>) => api.get('/v2/pod/delivery-tasks', { params }),
  createDpn: (data: any) => api.post('/v2/pod/dpns', data),
  createDpnDraft: (data: any) => api.post('/v2/pod/dpns/draft', data),
  bindSubOrders: (id: string, data: any) => api.post(`/v2/pod/dpns/${id}/bind-sub-orders`, data),
  createDeliveryTask: (data: any) => api.post('/v2/pod/delivery-tasks', data),
  signDeliveryTask: (id: string, data?: any) => api.post(`/v2/pod/delivery-tasks/${id}/sign`, data || {}),
  failDeliveryTask: (id: string, data?: any) => api.post(`/v2/pod/delivery-tasks/${id}/fail`, data || {}),
  returnDpnToWarehouse: (id: string, data?: any) => api.post(`/v2/pod/dpns/${id}/return-to-warehouse`, data || {}),
};

export const v2FinanceApi = {
  createFee: (data: any) => api.post('/v2/finance/fees', data),
  confirmPayment: (data: any) => api.post('/v2/finance/payments/confirm', data),
};

export const v2WorkflowApi = {
  createInstance: (data: any) => api.post('/v2/workflow/instances', data),
  actionTask: (taskId: string, data: any) => api.post(`/v2/workflow/tasks/${taskId}/action`, data),
};

// ==================== Jobs ====================
export const jobApi = {
  list: (params?: Record<string, any>) => api.get('/jobs', { params }),
  get: (jobNo: string) => api.get(`/jobs/${jobNo}`),
  create: (data: any) => api.post('/jobs', data),
  update: (jobNo: string, data: any) => api.put(`/jobs/${jobNo}`, data),
  delete: (jobNo: string) => api.delete(`/jobs/${jobNo}`),
  bindUnits: (jobNo: string, unitIds: string[]) =>
    api.post(`/jobs/${jobNo}/bind-units`, { unitIds }),
  unbindUnits: (jobNo: string, unitIds: string[]) =>
    api.post(`/jobs/${jobNo}/unbind-units`, { unitIds }),
  updateOriginPhase: (jobNo: string, data: any) => api.put(`/jobs/${jobNo}/origin-phase`, data),
  updateDestPhase: (jobNo: string, data: any) => api.put(`/jobs/${jobNo}/dest-phase`, data),
};

// ==================== Warehouse ====================
export const warehouseApi = {
  // Inbound
  listInbound: (params?: Record<string, any>) => api.get('/warehouse/inbound', { params }),
  getInbound: (id: string) => api.get(`/warehouse/inbound/${id}`),
  createInbound: (data: any) => api.post('/warehouse/inbound', data),
  updateInbound: (id: string, data: any) => api.put(`/warehouse/inbound/${id}`, data),
  cancelInbound: (id: string, data?: any) => api.post(`/warehouse/inbound/${id}/cancel`, data || {}),
  deleteInbound: (id: string) => api.delete(`/warehouse/inbound/${id}`),
  // Stock
  listStock: (params?: Record<string, any>) => api.get('/warehouse/stock', { params }),
  getStock: (subOrderNo: string) => api.get(`/warehouse/stock/${subOrderNo}`),
  getStockById: (id: string) => api.get(`/warehouse/stock/item/${id}`),
  updateStock: (id: string, data: any) => api.put(`/warehouse/stock/${id}`, data),
  updateStockStatus: (id: string, status: string) =>
    api.put(`/warehouse/stock/${id}/status`, { status }),
  returnStock: (id: string, data: any) => api.post(`/warehouse/stock/${id}/return`, data),
  deleteStock: (id: string) => api.delete(`/warehouse/stock/${id}`),
  // Shipping units
  listUnits: (params?: Record<string, any>) => api.get('/warehouse/units', { params }),
  getUnit: (id: string) => api.get(`/warehouse/units/${id}`),
  createUnit: (data: any) => api.post('/warehouse/units', data),
  updateUnit: (id: string, data: any) => api.put(`/warehouse/units/${id}`, data),
  loadUnit: (id: string, subOrderIds: string[]) =>
    api.post(`/warehouse/units/${id}/load`, { subOrderIds }),
  sealUnit: (id: string, sealNo?: string) =>
    api.post(`/warehouse/units/${id}/seal`, { sealNo }),
  deleteUnit: (id: string) => api.delete(`/warehouse/units/${id}`),
  // Transfers
  listTransfers: (params?: Record<string, any>) => api.get('/warehouse/transfers', { params }),
  createTransfer: (data: any) => api.post('/warehouse/transfers', data),
  updateTransfer: (id: string, data: any) => api.put(`/warehouse/transfers/${id}`, data),
  // Returns
  listReturns: (params?: Record<string, any>) => api.get('/warehouse/returns', { params }),
  getReturn: (id: string) => api.get(`/warehouse/returns/${id}`),
  createReturn: (data: any) => api.post('/warehouse/returns', data),
  updateReturn: (id: string, data: any) => api.put(`/warehouse/returns/${id}`, data),
  deleteReturn: (id: string) => api.delete(`/warehouse/returns/${id}`),
  // No-order express
  listNoOrderExpress: (params?: Record<string, any>) => api.get('/warehouse/no-order-express', { params }),
  getNoOrderExpress: (id: string) => api.get(`/warehouse/no-order-express/${id}`),
  createNoOrderExpress: (data: any) => api.post('/warehouse/no-order-express', data),
  updateNoOrderExpress: (id: string, data: any) => api.put(`/warehouse/no-order-express/${id}`, data),
  deleteNoOrderExpress: (id: string) => api.delete(`/warehouse/no-order-express/${id}`),
};

// ==================== Delivery ====================
export const deliveryApi = {
  list: (params?: Record<string, any>) => api.get('/delivery', { params }),
  create: (data: any) => api.post('/delivery', data),
  update: (id: string, data: any) => api.put(`/delivery/${id}`, data),
  assign: (id: string, driverId: string, driverName?: string, driverPhone?: string) =>
    api.post(`/delivery/${id}/assign`, { driverId, driverName, driverPhone }),
  sign: (id: string, photos?: string[]) =>
    api.post(`/delivery/${id}/sign`, { photos }),
};

// ==================== Finance ====================
export const feeApi = {
  list: (params?: Record<string, any>) => api.get('/fees', { params }),
  get: (id: string) => api.get('/fees', { params: { id } }),
  coverage: () => api.get('/fees/coverage'),
  bootstrap: (data?: any) => api.post('/fees/bootstrap', data),
  create: (data: any) => api.post('/fees', data),
  update: (id: string, data: any) => api.put(`/fees/${id}`, data),
  approve: (id: string, approver?: string) => api.post(`/fees/${id}/approve`, { approver }),
  reject: (id: string, approver?: string, rejectReason?: string) =>
    api.post(`/fees/${id}/reject`, { approver, rejectReason }),
  pay: (id: string, data?: any) => api.post(`/fees/${id}/pay`, data || {}),
  cancel: (id: string, reason?: string) => api.post(`/fees/${id}/cancel`, { reason }),
};

export const supplierApi = {
  list: (params?: Record<string, any>) => api.get('/suppliers', { params }),
  create: (data: any) => api.post('/suppliers', data),
};

export const commissionApi = {
  listRules: (params?: Record<string, any>) => api.get('/finance/commission/rules', { params }),
  createRule: (data: any) => api.post('/finance/commission/rules', data),
  updateRule: (id: string, data: any) => api.put(`/finance/commission/rules/${id}`, data),
  deleteRule: (id: string) => api.delete(`/finance/commission/rules/${id}`),
  getBonus: () => api.get('/finance/commission/bonus'),
  updateBonus: (data: any) => api.put('/finance/commission/bonus', data),
};

// ==================== Sales ====================
export const salesApi = {
  dashboard: (salesId?: string) => api.get('/sales/dashboard', { params: { salesId } }),
  pendingPayments: () => api.get('/sales/pending-payments'),
  sendReminder: (data: any) => api.post('/sales/reminders', data),
  getReminderHistory: (paymentId: string) => api.get(`/sales/reminders/${paymentId}`),
  quotes: (params?: Record<string, any>) => api.get('/sales/quotes', { params }),
};

// ==================== Notifications ====================
export const notificationApi = {
  list: (params?: Record<string, any>) => api.get('/notifications', { params }),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  create: (data: any) => api.post('/notifications', data),
};

// ==================== System ====================
export const systemApi = {
  listBaseData: (params?: Record<string, any>) => api.get('/system/base-data', { params }),
  listBaseDataOptions: (params?: Record<string, any>) => api.get('/system/base-data/options', { params }),
  createBaseData: (data: any) => api.post('/system/base-data', data),
  updateBaseData: (id: string, data: any) => api.put(`/system/base-data/${id}`, data),
  deleteBaseData: (id: string) => api.delete(`/system/base-data/${id}`),
  routes: (params?: Record<string, any>) => api.get('/system/routes', { params }),
  createRoute: (data: any) => api.post('/system/routes', data),
  updateRoute: (id: string, data: any) => api.put(`/system/routes/${id}`, data),
  deleteRoute: (id: string) => api.delete(`/system/routes/${id}`),
  exchangeRates: () => api.get('/system/exchange-rates'),
  createExchangeCurrency: (data: any) => api.post('/system/exchange-rates/currencies', data),
  updateExchangeCurrency: (id: string, data: any) => api.put(`/system/exchange-rates/currencies/${id}`, data),
  deleteExchangeCurrency: (id: string) => api.delete(`/system/exchange-rates/currencies/${id}`),
  saveExchangeRate: (currencyCode: string, data: any) =>
    api.post(`/system/exchange-rates/currencies/${currencyCode}/rates`, data),
  refreshLiveRates: () => api.post('/system/exchange-rates/refresh-live'),
  listFreightRates: (params?: Record<string, any>) => api.get('/system/freight-rates', { params }),
  createFreightRate: (data: any) => api.post('/system/freight-rates', data),
  updateFreightRate: (id: string, data: any) => api.put(`/system/freight-rates/${id}`, data),
  deleteFreightRate: (id: string) => api.delete(`/system/freight-rates/${id}`),
  listCountries: (params?: Record<string, any>) => api.get('/system/countries', { params }),
  createCountry: (data: any) => api.post('/system/countries', data),
  updateCountry: (id: string, data: any) => api.put(`/system/countries/${id}`, data),
  deleteCountry: (id: string) => api.delete(`/system/countries/${id}`),
  createCity: (countryId: string, data: any) => api.post(`/system/countries/${countryId}/cities`, data),
  updateCity: (countryId: string, cityId: string, data: any) =>
    api.put(`/system/countries/${countryId}/cities/${cityId}`, data),
  deleteCity: (countryId: string, cityId: string) => api.delete(`/system/countries/${countryId}/cities/${cityId}`),
  listSites: (params?: Record<string, any>) => api.get('/system/sites', { params }),
  createSite: (data: any) => api.post('/system/sites', data),
  updateSite: (id: string, data: any) => api.put(`/system/sites/${id}`, data),
  deleteSite: (id: string) => api.delete(`/system/sites/${id}`),
  listDepartments: (params?: Record<string, any>) => api.get('/system/departments', { params }),
  createDepartment: (data: any) => api.post('/system/departments', data),
  updateDepartment: (id: string, data: any) => api.put(`/system/departments/${id}`, data),
  deleteDepartment: (id: string) => api.delete(`/system/departments/${id}`),
  listUserSites: (userId: string) => api.get(`/system/user-sites/${userId}`),
  setUserSites: (userId: string, siteIds: string[]) => api.put(`/system/user-sites/${userId}`, { siteIds }),
  listRbacRoles: (params?: Record<string, any>) => api.get('/system/rbac/roles', { params }),
  createRbacRole: (data: any) => api.post('/system/rbac/roles', data),
  updateRbacRole: (id: string, data: any) => api.put(`/system/rbac/roles/${id}`, data),
  deleteRbacRole: (id: string) => api.delete(`/system/rbac/roles/${id}`),
  listRbacPermissions: (params?: Record<string, any>) => api.get('/system/rbac/permissions', { params }),
  createRbacPermission: (data: any) => api.post('/system/rbac/permissions', data),
  updateRbacPermission: (id: string, data: any) => api.put(`/system/rbac/permissions/${id}`, data),
  deleteRbacPermission: (id: string) => api.delete(`/system/rbac/permissions/${id}`),
  getRolePermissions: (roleId: string) => api.get(`/system/rbac/roles/${roleId}/permissions`),
  setRolePermissions: (roleId: string, permissionIds: string[]) =>
    api.put(`/system/rbac/roles/${roleId}/permissions`, { permissionIds }),
  getUserRoles: (userId: string) => api.get(`/system/rbac/users/${userId}/roles`),
  setUserRoles: (userId: string, roleIds: string[]) => api.put(`/system/rbac/users/${userId}/roles`, { roleIds }),
  listLogisticsNodes: (params?: Record<string, any>) => api.get('/system/logistics-nodes', { params }),
  createLogisticsNode: (data: any) => api.post('/system/logistics-nodes', data),
  updateLogisticsNode: (id: string, data: any) => api.put(`/system/logistics-nodes/${id}`, data),
  deleteLogisticsNode: (id: string) => api.delete(`/system/logistics-nodes/${id}`),
  listWorkflows: (params?: Record<string, any>) => api.get('/system/workflows', { params }),
  createWorkflow: (data: any) => api.post('/system/workflows', data),
  updateWorkflow: (id: string, data: any) => api.put(`/system/workflows/${id}`, data),
  updateWorkflowStatus: (id: string, status: string) => api.put(`/system/workflows/${id}/status`, { status }),
  deleteWorkflow: (id: string) => api.delete(`/system/workflows/${id}`),
  noOrderExpress: (params?: Record<string, any>) => api.get('/no-order-express', { params }),
};

// ==================== Warehouse Management ====================
export const warehouseManagementApi = {
  list: (params?: Record<string, any>) => api.get('/system/warehouses', { params }),
  get: (id: string) => api.get(`/system/warehouses/${id}`),
  create: (data: any) => api.post('/system/warehouses', data),
  update: (id: string, data: any) => api.put(`/system/warehouses/${id}`, data),
  delete: (id: string) => api.delete(`/system/warehouses/${id}`),
  getUserWarehouses: (userId: string) => api.get(`/system/warehouses/user/${userId}`),
  setUserWarehouses: (userId: string, warehouseIds: string[]) =>
    api.put(`/system/warehouses/user/${userId}`, { warehouseIds }),
};
