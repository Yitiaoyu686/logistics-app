# 喵喵国际物流系统 - App 端详细规划

**文档版本**: v1.0
**生成日期**: 2026-02-02
**技术方案**: H5 (React 19 + TypeScript + Vite + Ant Design Mobile)
**预览端口**: 1234

---

## 📋 目录

1. [技术架构](#一技术架构)
2. [项目结构](#二项目结构)
3. [功能模块详细设计](#三功能模块详细设计)
4. [页面路由设计](#四页面路由设计)
5. [数据模型复用](#五数据模型复用)
6. [开发计划](#六开发计划)

---

## 一、技术架构

### 1.1 技术栈选型

**前端框架**:
- React 19 + TypeScript
- Vite 5 (构建工具)
- Ant Design Mobile 5.x (移动端 UI 组件库)
- React Router DOM v7 (路由管理)

**状态管理**:
- useState + useContext (轻量级状态管理)
- 无需 Redux (保持简单)

**HTTP 客户端**:
- Axios (与 Web 端保持一致)

**工具库**:
- Day.js (日期处理)
- ahooks (React Hooks 工具库)

**扫码功能**:
- html5-qrcode (H5 扫码库)
- 支持调用摄像头扫描二维码/条形码

### 1.2 与 Web 端的关系

```
┌─────────────────────────────────────────────────────┐
│                   共享层                             │
├─────────────────────────────────────────────────────┤
│  - TypeScript 类型定义 (types/core.ts)              │
│  - Mock 数据 (data/mock.ts)                         │
│  - API 接口定义 (utils/api.ts)                      │
│  - 业务逻辑函数 (utils/helpers.ts)                  │
└─────────────────────────────────────────────────────┘
           ↓                              ↓
┌──────────────────────┐      ┌──────────────────────┐
│   Web 端 (5176)      │      │   App 端 (1234)      │
├──────────────────────┤      ├──────────────────────┤
│ Ant Design v6        │      │ Ant Design Mobile    │
│ PC 端布局            │      │ 移动端布局            │
│ 完整功能             │      │ 核心功能              │
└──────────────────────┘      └──────────────────────┘
```

### 1.3 目录结构设计

```
/app/
├── public/
│   └── favicon.ico
├── src/
│   ├── assets/              # 静态资源
│   │   ├── images/
│   │   └── icons/
│   ├── components/          # 共享组件
│   │   ├── Layout/
│   │   │   ├── TabBar.tsx          # 底部导航栏
│   │   │   └── NavBar.tsx          # 顶部导航栏
│   │   ├── Scanner/
│   │   │   └── QRScanner.tsx       # 扫码组件
│   │   └── Common/
│   │       ├── Loading.tsx
│   │       └── Empty.tsx
│   ├── pages/               # 页面组件
│   │   ├── auth/
│   │   │   └── Login.tsx           # 登录页
│   │   ├── sales/           # 销售端
│   │   │   ├── Dashboard.tsx       # 工作台
│   │   │   ├── ClientList.tsx      # 客户列表
│   │   │   ├── ClientDetail.tsx    # 客户详情
│   │   │   ├── OrderList.tsx       # 订单列表
│   │   │   ├── OrderCreate.tsx     # 创建订单
│   │   │   ├── OrderDetail.tsx     # 订单详情
│   │   │   ├── PriceCalc.tsx       # 运费计算
│   │   │   └── Profile.tsx         # 个人中心
│   │   ├── warehouse-cn/    # 起运国仓管
│   │   │   ├── Dashboard.tsx       # 工作台
│   │   │   ├── InboundScan.tsx     # 扫码入库
│   │   │   ├── InboundList.tsx     # 入库记录
│   │   │   ├── PackingScan.tsx     # 扫码装箱
│   │   │   ├── ContainerList.tsx   # 集装箱列表
│   │   │   ├── StockList.tsx       # 库存查询
│   │   │   └── Profile.tsx         # 个人中心
│   │   └── warehouse-us/    # 目的国仓管
│   │       ├── Dashboard.tsx       # 工作台
│   │       ├── InboundScan.tsx     # 扫码入库
│   │       ├── InboundList.tsx     # 入库记录
│   │       ├── DeliveryList.tsx    # 配送列表
│   │       ├── DeliveryDetail.tsx  # 配送详情
│   │       └── Profile.tsx         # 个人中心
│   ├── types/               # 类型定义 (复用 Web 端)
│   │   └── core.ts
│   ├── data/                # Mock 数据 (复用 Web 端)
│   │   └── mock.ts
│   ├── utils/               # 工具函数
│   │   ├── api.ts                  # API 封装
│   │   ├── storage.ts              # 本地存储
│   │   └── helpers.ts              # 辅助函数
│   ├── hooks/               # 自定义 Hooks
│   │   ├── useAuth.ts              # 认证 Hook
│   │   └── useScanner.ts           # 扫码 Hook
│   ├── App.tsx              # 根组件
│   ├── main.tsx             # 入口文件
│   └── router.tsx           # 路由配置
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 二、项目结构

### 2.1 核心文件说明

**App.tsx** - 根组件
```typescript
// 根据用户角色显示不同的底部导航
// SALES: 工作台、客户、订单、我的
// WAREHOUSE_CN: 工作台、入库、装箱、我的
// WAREHOUSE_US: 工作台、入库、配送、我的
```

**router.tsx** - 路由配置
```typescript
// 使用 React Router DOM v7
// 路由守卫：未登录跳转到登录页
// 角色路由：根据角色显示不同页面
```

**components/Layout/TabBar.tsx** - 底部导航栏
```typescript
// 使用 Ant Design Mobile 的 TabBar 组件
// 根据角色动态显示不同的导航项
```

---

## 三、功能模块详细设计

### 3.1 销售端 (SALES) - 8 个页面

#### 3.1.1 登录页 (Login)
**路由**: `/login`
**功能**:
- 账号密码登录
- 记住密码
- 自动登录

**UI 组件**:
- Form (表单)
- Input (输入框)
- Button (按钮)
- Checkbox (记住密码)

**Mock 账号**:
```typescript
{
  username: 'sales001',
  password: '123456',
  role: 'SALES',
  name: '张销售'
}
```

#### 3.1.2 工作台 (Dashboard)
**路由**: `/sales/dashboard`
**功能**:
- 今日数据统计（订单数、客户数、业绩）
- 待办事项列表
- 快捷入口（创建订单、添加客户、运费计算）

**UI 组件**:
- Grid (宫格)
- Card (卡片)
- List (列表)
- Badge (徽标)

#### 3.1.3 客户列表 (ClientList)
**路由**: `/sales/clients`
**功能**:
- 标签页切换（公海池、我的客户）
- 搜索客户
- 查看客户详情
- 添加客户

**UI 组件**:
- Tabs (标签页)
- SearchBar (搜索栏)
- List (列表)
- FloatingBubble (悬浮按钮 - 添加客户)

#### 3.1.4 客户详情 (ClientDetail)
**路由**: `/sales/clients/:id`
**功能**:
- 查看客户基本信息
- 查看跟进记录
- 添加跟进记录
- 创建订单

**UI 组件**:
- Tabs (标签页)
- Descriptions (描述列表)
- Timeline (时间轴)
- Button (操作按钮)

#### 3.1.5 订单列表 (OrderList)
**路由**: `/sales/orders`
**功能**:
- 我的订单列表
- 状态筛选
- 搜索订单
- 查看订单详情

**UI 组件**:
- Tabs (状态筛选)
- SearchBar (搜索)
- List (列表)
- Tag (状态标签)

#### 3.1.6 创建订单 (OrderCreate)
**路由**: `/sales/orders/create`
**功能**:
- 简化版订单创建表单
- 选择客户
- 填写收发货信息
- 添加货物信息
- 运费估算

**UI 组件**:
- Form (表单)
- Picker (选择器)
- Input (输入框)
- Stepper (步进器)
- Button (提交按钮)

#### 3.1.7 订单详情 (OrderDetail)
**路由**: `/sales/orders/:id`
**功能**:
- 查看订单完整信息
- 物流轨迹
- 费用明细
- 操作按钮（催款、分享）

**UI 组件**:
- Tabs (标签页)
- Descriptions (描述列表)
- Steps (物流轨迹)
- Button (操作按钮)

#### 3.1.8 运费计算 (PriceCalc)
**路由**: `/sales/price-calc`
**功能**:
- 选择起运地、目的地
- 输入重量、体积
- 计算运费
- 生成报价单

**UI 组件**:
- Picker (地点选择)
- Input (输入框)
- Button (计算按钮)
- Result (结果展示)

---

### 3.2 起运国仓管 (WAREHOUSE_CN) - 7 个页面

#### 3.2.1 工作台 (Dashboard)
**路由**: `/warehouse-cn/dashboard`
**功能**:
- 今日入库数统计
- 待装箱数统计
- 快捷入口（扫码入库、扫码装箱）

**UI 组件**:
- Grid (宫格)
- Card (卡片)
- Button (快捷按钮)

#### 3.2.2 扫码入库 (InboundScan)
**路由**: `/warehouse-cn/inbound/scan`
**功能**:
- 调用摄像头扫描运单号
- 手动输入运单号
- 录入件数、重量、体积
- 拍照上传
- 提交入库

**UI 组件**:
- QRScanner (扫码组件)
- Form (表单)
- ImageUploader (图片上传)
- Button (提交按钮)

**扫码流程**:
```
1. 点击"扫码入库"按钮
2. 调用摄像头
3. 扫描运单号（自动识别）
4. 显示订单信息
5. 录入实际件数、重量
6. 拍照上传货物照片
7. 提交入库
```

#### 3.2.3 入库记录 (InboundList)
**路由**: `/warehouse-cn/inbound/list`
**功能**:
- 查看今日入库记录
- 搜索订单
- 查看入库详情

**UI 组件**:
- List (列表)
- SearchBar (搜索)
- Tag (状态标签)

#### 3.2.4 扫码装箱 (PackingScan)
**路由**: `/warehouse-cn/packing/scan`
**功能**:
- 选择集装箱
- 扫描订单号
- 自动计算装载率
- 提交装箱

**UI 组件**:
- Picker (集装箱选择)
- QRScanner (扫码组件)
- ProgressBar (装载率)
- List (已装箱列表)
- Button (提交按钮)

#### 3.2.5 集装箱列表 (ContainerList)
**路由**: `/warehouse-cn/containers`
**功能**:
- 查看集装箱列表
- 查看装载情况
- 查看装箱明细

**UI 组件**:
- List (列表)
- ProgressBar (装载率)
- Tag (状态标签)

#### 3.2.6 库存查询 (StockList)
**路由**: `/warehouse-cn/stock`
**功能**:
- 查询库存
- 搜索订单
- 查看库存详情

**UI 组件**:
- SearchBar (搜索)
- List (列表)
- Tag (状态标签)

#### 3.2.7 个人中心 (Profile)
**路由**: `/warehouse-cn/profile`
**功能**:
- 个人信息
- 设置
- 退出登录

**UI 组件**:
- List (列表)
- Button (退出按钮)

---

### 3.3 目的国仓管 (WAREHOUSE_US) - 6 个页面

#### 3.3.1 工作台 (Dashboard)
**路由**: `/warehouse-us/dashboard`
**功能**:
- 今日入库数统计
- 待配送数统计
- 快捷入口（扫码入库、配送管理）

#### 3.3.2 扫码入库 (InboundScan)
**路由**: `/warehouse-us/inbound/scan`
**功能**:
- 扫描运单号
- 录入异常信息（短少、损坏）
- 拍照上传
- 提交入库

#### 3.3.3 入库记录 (InboundList)
**路由**: `/warehouse-us/inbound/list`
**功能**:
- 查看今日入库记录
- 搜索订单
- 查看入库详情

#### 3.3.4 配送列表 (DeliveryList)
**路由**: `/warehouse-us/delivery`
**功能**:
- 待配送订单列表
- 搜索订单
- 通知客户
- 确认配送

#### 3.3.5 配送详情 (DeliveryDetail)
**路由**: `/warehouse-us/delivery/:id`
**功能**:
- 查看配送信息
- 客户联系方式
- 一键拨打电话
- 确认配送方式
- 更新配送状态

#### 3.3.6 个人中心 (Profile)
**路由**: `/warehouse-us/profile`
**功能**:
- 个人信息
- 设置
- 退出登录

---

## 四、页面路由设计

### 4.1 路由表

```typescript
const routes = [
  // 认证
  { path: '/login', component: Login },

  // 销售端
  { path: '/sales/dashboard', component: SalesDashboard, auth: 'SALES' },
  { path: '/sales/clients', component: ClientList, auth: 'SALES' },
  { path: '/sales/clients/:id', component: ClientDetail, auth: 'SALES' },
  { path: '/sales/orders', component: OrderList, auth: 'SALES' },
  { path: '/sales/orders/create', component: OrderCreate, auth: 'SALES' },
  { path: '/sales/orders/:id', component: OrderDetail, auth: 'SALES' },
  { path: '/sales/price-calc', component: PriceCalc, auth: 'SALES' },
  { path: '/sales/profile', component: Profile, auth: 'SALES' },

  // 起运国仓管
  { path: '/warehouse-cn/dashboard', component: WarehouseCNDashboard, auth: 'WAREHOUSE_CN' },
  { path: '/warehouse-cn/inbound/scan', component: InboundScan, auth: 'WAREHOUSE_CN' },
  { path: '/warehouse-cn/inbound/list', component: InboundList, auth: 'WAREHOUSE_CN' },
  { path: '/warehouse-cn/packing/scan', component: PackingScan, auth: 'WAREHOUSE_CN' },
  { path: '/warehouse-cn/containers', component: ContainerList, auth: 'WAREHOUSE_CN' },
  { path: '/warehouse-cn/stock', component: StockList, auth: 'WAREHOUSE_CN' },
  { path: '/warehouse-cn/profile', component: Profile, auth: 'WAREHOUSE_CN' },

  // 目的国仓管
  { path: '/warehouse-us/dashboard', component: WarehouseUSDashboard, auth: 'WAREHOUSE_US' },
  { path: '/warehouse-us/inbound/scan', component: InboundScan, auth: 'WAREHOUSE_US' },
  { path: '/warehouse-us/inbound/list', component: InboundList, auth: 'WAREHOUSE_US' },
  { path: '/warehouse-us/delivery', component: DeliveryList, auth: 'WAREHOUSE_US' },
  { path: '/warehouse-us/delivery/:id', component: DeliveryDetail, auth: 'WAREHOUSE_US' },
  { path: '/warehouse-us/profile', component: Profile, auth: 'WAREHOUSE_US' },
];
```

### 4.2 底部导航配置

```typescript
// 销售端
const salesTabs = [
  { key: 'dashboard', title: '工作台', icon: <AppOutline /> },
  { key: 'clients', title: '客户', icon: <UserOutline /> },
  { key: 'orders', title: '订单', icon: <UnorderedListOutline /> },
  { key: 'profile', title: '我的', icon: <UserOutline /> },
];

// 起运国仓管
const warehouseCNTabs = [
  { key: 'dashboard', title: '工作台', icon: <AppOutline /> },
  { key: 'inbound', title: '入库', icon: <ScanningOutline /> },
  { key: 'packing', title: '装箱', icon: <ScanningOutline /> },
  { key: 'profile', title: '我的', icon: <UserOutline /> },
];

// 目的国仓管
const warehouseUSTabs = [
  { key: 'dashboard', title: '工作台', icon: <AppOutline /> },
  { key: 'inbound', title: '入库', icon: <ScanningOutline /> },
  { key: 'delivery', title: '配送', icon: <TruckOutline /> },
  { key: 'profile', title: '我的', icon: <UserOutline /> },
];
```

---

## 五、数据模型复用

### 5.1 从 Web 端复用的类型

```typescript
// 直接复制 /client/src/types/core.ts
export type Role = 'ADMIN' | 'SALES' | 'WAREHOUSE_CN' | 'OPS_CN' |
                   'OPS_US' | 'WAREHOUSE_US' | 'FINANCE' | 'BOSS';

export interface Client { ... }
export interface Order { ... }
export interface Job { ... }
export interface ShippingUnit { ... }
export interface InboundRecord { ... }
```

### 5.2 从 Web 端复用的 Mock 数据

```typescript
// 直接复制 /client/src/data/mock.ts
export const MOCK_CLIENTS = [ ... ];
export const MOCK_ORDERS = [ ... ];
export const MOCK_JOBS = [ ... ];
export const MOCK_SHIPPING_UNITS = [ ... ];
```

### 5.3 App 端特有的类型

```typescript
// /app/src/types/app.ts
export interface ScanResult {
  code: string;
  type: 'QR_CODE' | 'BARCODE';
  timestamp: string;
}

export interface InboundForm {
  trackingNo: string;
  pieces: number;
  weight: number;
  volume?: number;
  photos: string[];
  remark?: string;
}

export interface DeliveryForm {
  orderId: string;
  deliveryMethod: 'PICKUP' | 'DELIVERY';
  deliveryDate: string;
  remark?: string;
}
```

---

## 六、开发计划

### 6.1 第一阶段：项目搭建 (1 天)

**任务清单**:
- [ ] 创建 Vite + React + TypeScript 项目
- [ ] 安装 Ant Design Mobile
- [ ] 配置路由 (React Router DOM v7)
- [ ] 配置 Vite 端口为 1234
- [ ] 创建基础目录结构
- [ ] 复制 Web 端的类型定义和 Mock 数据
- [ ] 创建登录页和路由守卫

### 6.2 第二阶段：销售端开发 (3 天)

**Day 1**: 工作台 + 客户管理
- [ ] 销售工作台
- [ ] 客户列表（公海池、我的客户）
- [ ] 客户详情

**Day 2**: 订单管理
- [ ] 订单列表
- [ ] 创建订单
- [ ] 订单详情

**Day 3**: 运费计算 + 个人中心
- [ ] 运费计算器
- [ ] 个人中心
- [ ] 销售端联调测试

### 6.3 第三阶段：起运国仓管开发 (3 天)

**Day 1**: 工作台 + 入库管理
- [ ] 仓管工作台
- [ ] 扫码入库功能
- [ ] 入库记录列表

**Day 2**: 装箱管理
- [ ] 扫码装箱功能
- [ ] 集装箱列表
- [ ] 装载率计算

**Day 3**: 库存查询 + 个人中心
- [ ] 库存查询
- [ ] 个人中心
- [ ] 起运国仓管联调测试

### 6.4 第四阶段：目的国仓管开发 (2 天)

**Day 1**: 入库管理
- [ ] 工作台
- [ ] 扫码入库
- [ ] 入库记录

**Day 2**: 配送管理
- [ ] 配送列表
- [ ] 配送详情
- [ ] 通知客户功能
- [ ] 目的国仓管联调测试

### 6.5 第五阶段：优化与测试 (1 天)

- [ ] 整体 UI 优化
- [ ] 性能优化
- [ ] 扫码功能测试
- [ ] 移动端适配测试
- [ ] Bug 修复

**总计**: 10 天完成 App 端 Mock 版本

---

## 七、技术要点

### 7.1 扫码功能实现

使用 `html5-qrcode` 库：

```typescript
import { Html5Qrcode } from 'html5-qrcode';

const scanner = new Html5Qrcode("reader");
scanner.start(
  { facingMode: "environment" }, // 后置摄像头
  {
    fps: 10,
    qrbox: { width: 250, height: 250 }
  },
  (decodedText) => {
    // 扫码成功回调
    console.log(`扫码结果: ${decodedText}`);
  },
  (errorMessage) => {
    // 扫码失败回调
  }
);
```

### 7.2 移动端适配

```css
/* 使用 viewport 单位 */
html {
  font-size: 16px;
}

/* 使用 rem 单位 */
.container {
  padding: 1rem;
}

/* 使用 Ant Design Mobile 的响应式组件 */
```

### 7.3 本地存储

```typescript
// utils/storage.ts
export const storage = {
  setToken: (token: string) => localStorage.setItem('token', token),
  getToken: () => localStorage.getItem('token'),
  setUser: (user: any) => localStorage.setItem('user', JSON.stringify(user)),
  getUser: () => JSON.parse(localStorage.getItem('user') || '{}'),
  clear: () => localStorage.clear(),
};
```

---

**文档完成时间**: 2026-02-02
**预计开发周期**: 10 天
**预览地址**: http://localhost:1234
