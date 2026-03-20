import React, { useState, useMemo, useEffect } from 'react';
import { Layout, Menu, Button, Avatar, Space, Tag, Result, Card, Tabs, Select, message, Statistic, Row, Col, List, Timeline, Badge, theme, Dropdown, Breadcrumb } from 'antd';
import {
  DesktopOutlined, TeamOutlined, FileTextOutlined, HomeOutlined,
  RocketOutlined, GlobalOutlined, BankOutlined,
  BarChartOutlined, SettingOutlined, UserOutlined, BellOutlined,
  MenuUnfoldOutlined, MenuFoldOutlined,
  ClockCircleOutlined,
  LogoutOutlined
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import LoginPage from './pages/auth/LoginPage';
import { MyCustomers, PublicPool } from './pages/crm/CRMModules';
import { SalesDashboard } from './pages/sales/SalesDashboard';
import { FinanceDashboard } from './pages/finance/FinanceDashboard';
import { JobCostAudit } from './pages/finance/JobCostAudit';
import { PayableManagement } from './pages/finance/PayableManagement';
import { ReceivableManagement } from './pages/finance/ReceivableManagement';
import { PettyCashApply } from './pages/finance/PettyCashApply';
import { PettyCashVerify } from './pages/finance/PettyCashVerify';
import { CommissionRuleManagement } from './pages/finance/CommissionRuleManagement';
import { CommissionCalculation } from './pages/finance/CommissionCalculation';
import { SalaryPayment } from './pages/finance/SalaryPayment';
import { FeeInput } from './pages/finance/FeeInput';
import { FeeApproval } from './pages/finance/FeeApproval';
import { JobProfitDashboard } from './pages/finance/JobProfitDashboard';
import { CostReport } from './pages/finance/CostReport';
import { OrderReport } from './pages/finance/OrderReport';
import { ReceivableAging } from './pages/finance/ReceivableAging';
import { PaymentSchedule } from './pages/finance/PaymentSchedule';
import { CashFlowDaily } from './pages/finance/CashFlowDaily';
import { TodoList } from './pages/dashboard/TodoList';
import { AlertCenter } from './pages/dashboard/AlertCenter';
import { PriceCalculator } from './pages/sales/PriceCalculator';
import OrderListV2 from './pages/oms/OrderListV2';
import { OriginTaskManager } from './pages/tms/OriginTaskManager';
import { DestJobManager } from './pages/tms/DestJobManager';
import { JobCostInputPOL } from './pages/tms/JobCostInputPOL';
import { OrderFeeInput } from './pages/tms/OrderFeeInput';
import { JobCostInputPOD } from './pages/tms/JobCostInputPOD';
import { DPNCost } from './pages/tms/DPNCost';
import { InboundList } from './pages/wms/origin/InboundList';
import { InboundScan } from './pages/wms/origin/InboundScan';
import { StockList } from './pages/wms/origin/StockList';
import { ContainerMgt } from './pages/wms/origin/ContainerMgt';
import { AirCargoMgt } from './pages/wms/origin/AirCargoMgt';
import { ReturnProcess } from './pages/wms/origin/ReturnProcess';
import { NoOrderExpress } from './pages/wms/origin/NoOrderExpress';
import { TransferList } from './pages/wms/origin/TransferList';
import { DestInboundList } from './pages/wms/destination/DestInboundList';
import { DeliveryList } from './pages/wms/destination/DeliveryList';
import { PickupList } from './pages/wms/destination/PickupList';
import { DestStockList } from './pages/wms/destination/DestStockList';
import { DestTransferList } from './pages/wms/destination/DestTransferList';
import { DPNManageList } from './pages/wms/destination/DPNManageList';
import { RegionManagement } from './pages/system/RegionManagement';
import { SupplierManagement } from './pages/system/SupplierManagement';
import { ExpressCompanyManagement } from './pages/system/ExpressCompanyManagement';
import { CarrierManagement } from './pages/system/CarrierManagement';
import { GoodsCategoryManagement } from './pages/system/GoodsCategoryManagement';
import { TransitWarehouseManagement } from './pages/system/TransitWarehouseManagement';
import { WarehouseManagement } from './pages/system/WarehouseManagement';
import { RouteManagement } from './pages/system/RouteManagement';
import { FeeTypeManagement } from './pages/system/FeeTypeManagement';
import { ExchangeRateManagement } from './pages/system/ExchangeRateManagement';
import { LogisticsNodeManagement } from './pages/system/LogisticsNodeManagement';
import { UserManagement } from './pages/system/UserManagement';
import { RoleManagement } from './pages/system/RoleManagement';
import { PermissionManagement } from './pages/system/PermissionManagement';
import { DepartmentManagement } from './pages/system/DepartmentManagement';
import { WorkflowConfigPage } from './pages/system/WorkflowConfig';
import { FreightRateRule } from './pages/system/FreightRateRule';
import { ExecutiveDashboard } from './pages/analytics/ExecutiveDashboard';
import { CustomerValueAnalysis } from './pages/analytics/CustomerValueAnalysis';
import { RouteProfitAnalysis } from './pages/analytics/RouteProfitAnalysis';
import { TransitPerformance } from './pages/analytics/TransitPerformance';
import { CostStructureAnalysis } from './pages/analytics/CostStructureAnalysis';
import { WebFullFlowRunner } from './pages/integration/WebFullFlowRunner';

const { Header, Content, Sider } = Layout;

// --- 1. 角色定义 ---
type UserRole = 'ADMIN' | 'SALES' | 'WAREHOUSE_CN' | 'OPS_CN' | 'OPS_US' | 'WAREHOUSE_US' | 'FINANCE' | 'BOSS';
type DomainKey = 'ALL' | 'SEA' | 'AIR' | 'SYS';

const ROLE_NAMES: Record<UserRole, string> = {
  ADMIN: '系统管理员',
  SALES: '销售人员',
  WAREHOUSE_CN: '起运国仓管',
  OPS_CN: '起运国操作',
  OPS_US: '目的国操作',
  WAREHOUSE_US: '达国仓管',
  FINANCE: '财务人员',
  BOSS: '管理层'
};

const DOMAIN_CONFIG: { key: DomainKey; label: string; roles?: UserRole[] }[] = [
  {
    key: 'ALL',
    label: '综合协同',
    roles: ['FINANCE', 'ADMIN', 'BOSS']
  },
  {
    key: 'SEA',
    label: '海运业务',
    roles: ['SALES', 'WAREHOUSE_CN', 'OPS_CN', 'OPS_US', 'WAREHOUSE_US', 'FINANCE', 'ADMIN', 'BOSS']
  },
  {
    key: 'AIR',
    label: '空运业务',
    roles: ['SALES', 'WAREHOUSE_CN', 'OPS_CN', 'OPS_US', 'WAREHOUSE_US', 'FINANCE', 'ADMIN', 'BOSS']
  },
  {
    key: 'SYS',
    label: '系统管理',
    roles: ['ADMIN']
  }
];

function notNull<T>(value: T | null): value is T {
  return value !== null;
}

// --- 2. 菜单配置定义 ---
interface MenuItemConfig {
  key: string;
  label: string;
  icon?: React.ReactNode;
  roles?: UserRole[];
  domains?: DomainKey[];
  children?: MenuItemConfig[];
  tabs?: { key: string; label: string, roles?: UserRole[]; domains?: DomainKey[] }[];
}

// --- 3. 菜单配置 ---
const MENU_CONFIG: MenuItemConfig[] = [
  {
    key: 'dashboard',
    label: '工作台',
    icon: <DesktopOutlined />,
    domains: ['ALL', 'SEA', 'AIR'],
    tabs: [
      { key: 'dashboard_overview', label: '工作概览' },
      { key: 'dashboard_todo', label: '待办事项' },
      { key: 'dashboard_alert', label: '预警中心' },
      { key: 'dashboard_web_full_flow', label: '全流程联调' }
    ]
  },
  {
    key: 'crm', label: '客户中心', icon: <TeamOutlined />,
    domains: ['SEA', 'AIR'],
    roles: ['SALES', 'OPS_CN', 'ADMIN'],
    tabs: [
      { key: 'crm_my', label: '我的客户' },
      { key: 'crm_public', label: '公海池' }
      // { key: 'crm_price', label: '报价查询' },
      // { key: 'crm_promo', label: '推广素材' }
    ]
  },
  {
    key: 'oms', label: '订单中心', icon: <FileTextOutlined />,
    domains: ['SEA', 'AIR'],
    roles: ['SALES', 'WAREHOUSE_CN', 'OPS_CN', 'OPS_US', 'WAREHOUSE_US', 'ADMIN'],
    tabs: [
      { key: 'oms_order_list', label: '订单列表' }
    ]
  },
  {
    key: 'wms_origin', label: '起运国仓储', icon: <HomeOutlined />,
    domains: ['SEA', 'AIR'],
    roles: ['WAREHOUSE_CN', 'OPS_CN', 'ADMIN'],
    tabs: [
      { key: 'wms_in_record', label: '入库记录' },
      { key: 'wms_stock_list', label: '库存列表' },
      { key: 'wms_stock_noorder', label: '无订单快递' },
      { key: 'wms_box_sea', label: '集中装箱', domains: ['SEA'] },
      { key: 'wms_box_air', label: '集中装箱', domains: ['AIR'] },
      { key: 'wms_transfer_list', label: '调拨记录' },
      { key: 'wms_stock_return', label: '退运处理' }
    ]
  },
  {
    key: 'tms_line', label: '起运国办', icon: <RocketOutlined />,
    domains: ['SEA', 'AIR'],
    roles: ['OPS_CN', 'ADMIN', 'SALES'],
    tabs: [
      { key: 'tms_origin_task', label: '任务管理', roles: ['OPS_CN', 'ADMIN'] },
      { key: 'tms_cost_pol_list', label: 'JOB成本', roles: ['OPS_CN', 'ADMIN'] },
      { key: 'tms_order_fee_list', label: '订单费用', roles: ['OPS_CN', 'ADMIN'] }
    ]
  },
  {
    key: 'tms_dest', label: '到达国办', icon: <RocketOutlined />,
    domains: ['SEA', 'AIR'],
    roles: ['OPS_US', 'ADMIN'],
    tabs: [
      { key: 'tms_dest_job_list', label: '任务管理', roles: ['OPS_US', 'ADMIN'] },
      { key: 'tms_cost_pod_list', label: 'JOB成本' },
      { key: 'tms_dpn_cost_list', label: 'DPN成本' }
    ]
  },
  {
    key: 'wms_dest', label: '到达国仓储', icon: <GlobalOutlined />,
    domains: ['SEA', 'AIR'],
    roles: ['WAREHOUSE_US', 'OPS_US', 'ADMIN'],
    tabs: [
      { key: 'wms_dest_in_list', label: '货物入库' },
      { key: 'wms_dest_stock_list', label: '库存查询' },
      { key: 'wms_dest_dpn_manage', label: 'DPN管理' },
      { key: 'wms_delivery_list', label: '配送列表' },
      { key: 'wms_pickup_list', label: '自提列表' },
      { key: 'wms_dest_transfer_list', label: '调拨记录' }
    ]
  },
  {
    key: 'finance', label: '财务中心', icon: <BankOutlined />,
    domains: ['ALL'],
    roles: ['FINANCE', 'ADMIN', 'BOSS'],
    children: [
      {
        key: 'finance_cost',
        label: '费用与成本',
        tabs: [
          { key: 'fin_fee_input', label: '费用录入', roles: ['ADMIN', 'FINANCE', 'BOSS'] },
          { key: 'fin_fee_approval', label: '费用审批' },
          { key: 'fin_job_profit', label: '任务盈亏看板' },
          { key: 'fin_job_audit', label: '任务成本总览' }
        ]
      },
      {
        key: 'finance_arap',
        label: '往来账款',
        tabs: [
          { key: 'fin_payable', label: '应付账款' },
          { key: 'fin_receivable', label: '应收账款' },
          { key: 'fin_receivable_aging', label: '应收账龄' },
          { key: 'fin_payable_schedule', label: '付款计划' }
        ]
      },
      {
        key: 'finance_petty_cash',
        label: '备用金',
        tabs: [
          { key: 'fin_petty_apply', label: '备用金申请' },
          { key: 'fin_petty_verify', label: '备用金核销', roles: ['FINANCE', 'ADMIN'] }
        ]
      },
      {
        key: 'finance_compensation',
        label: '提成与薪资',
        tabs: [
          { key: 'fin_commission', label: '销售提成' },
          { key: 'fin_salary', label: '薪资发放' },
          { key: 'fin_commission_rules', label: '提成规则' }
        ]
      },
      {
        key: 'finance_reports',
        label: '财务报表',
        tabs: [
          { key: 'fin_cost_report', label: '成本明细报表' },
          { key: 'fin_order_report', label: '订单明细报表' },
          { key: 'fin_cashflow_daily', label: '收支管理' }
        ]
      }
    ]
  },
  {
    key: 'analytics', label: '经营分析', icon: <BarChartOutlined />,
    domains: ['ALL'],
    roles: ['BOSS', 'ADMIN'],
    tabs: [
      { key: 'analytics_executive', label: '经营看板' },
      { key: 'analytics_customer_value', label: '客户价值分析' },
      { key: 'analytics_route_profit', label: '线路盈利分析' },
      { key: 'analytics_transit', label: '物流时效分析' },
      { key: 'analytics_cost_structure', label: '成本结构分析' }
    ]
  },
  {
    key: 'set_org',
    label: '组织管理（站点）',
    icon: <GlobalOutlined />,
    domains: ['SYS'],
    roles: ['ADMIN'],
    tabs: [
      { key: 'set_base_warehouse_mgmt', label: '站点管理' },
      { key: 'set_org_department', label: '部门管理' }
    ]
  },
  {
    key: 'set_user',
    label: '用户管理',
    icon: <TeamOutlined />,
    domains: ['SYS'],
    roles: ['ADMIN'],
    tabs: [
      { key: 'set_auth_user', label: '用户列表' }
    ]
  },
  {
    key: 'set_auth',
    label: '角色权限',
    icon: <UserOutlined />,
    domains: ['SYS'],
    roles: ['ADMIN'],
    tabs: [
      { key: 'set_auth_role', label: '角色管理' },
      { key: 'set_auth_permission', label: '权限配置' }
    ]
  },
  {
    key: 'set_base',
    label: '基础设置',
    icon: <SettingOutlined />,
    domains: ['SYS'],
    roles: ['ADMIN'],
    tabs: [
      { key: 'set_base_region', label: '国家/城市（快递信息）' },
      { key: 'set_base_route', label: '线路管理（路线模板）' },
      { key: 'set_base_logistics_node', label: '物流环节（节点字典）' },
      { key: 'set_base_supplier', label: '供应商管理' },
      { key: 'set_base_express', label: '快递公司' },
      { key: 'set_base_carrier', label: '承运人管理' },
      { key: 'set_base_goods', label: '货物分类' },
      { key: 'set_base_rate', label: '运费规则' },
      { key: 'set_base_feetype', label: '费用类型' },
      { key: 'set_base_exchange', label: '汇率管理' },
    ]
  },
  {
    key: 'set_workflow',
    label: '流程管理',
    icon: <RocketOutlined />,
    domains: ['SYS'],
    roles: ['ADMIN'],
    tabs: [
      { key: 'set_workflow_list', label: '审批流程' }
    ]
  },
  {
    key: 'set_message',
    label: '消息通知',
    icon: <BellOutlined />,
    domains: ['SYS'],
    roles: ['ADMIN'],
    tabs: [
      { key: 'set_message_publish', label: '消息发布' },
      { key: 'set_message_template', label: '推送模板' },
      { key: 'set_message_sms', label: '短信推送' }
    ]
  }
];

// --- 4. 聚合的工作台组件 ---
const RoleBasedDashboard = ({ role }: { role: UserRole }) => {
  if (role === 'SALES') return <SalesDashboard />;
  if (role === 'FINANCE') return <FinanceDashboard />;

  const getStats = () => {
    return [
      { title: '待处理任务', value: 0, color: '#1890ff' },
      { title: '异常提醒', value: 0, color: '#cf1322' },
      { title: '系统公告', value: 0, color: '#722ed1' },
      { title: '待审核单据', value: 0, color: '#faad14' }
    ];
  };

  return (
    <div style={{ background: '#f0f2f5', padding: '0', minHeight: '100%' }}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card bordered={false} title="数据概览">
            <Row gutter={16}>
              {getStats().map((s, i) => (
                <Col span={6} key={i}>
                  <Statistic title={s.title} value={s.value} valueStyle={{ color: s.color }} />
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
        <Col span={16}>
          <Card bordered={false} title="待办事项" extra={<Button type="link">查看更多</Button>}>
            <List
              itemLayout="horizontal"
              dataSource={[] as { title: string; time: string }[]}
              renderItem={(item) => (
                <List.Item actions={[<Button type="link">去处理</Button>]}>
                  <List.Item.Meta
                    avatar={<Badge dot color="red"><ClockCircleOutlined /></Badge>}
                    title={item.title}
                    description={item.time}
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card bordered={false} title="操作轨迹" style={{ height: '100%' }}>
            <Timeline
              items={[]}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

const ComingSoon = ({ title }: { title: string }) => (
  <Result status="404" title={title} subTitle="该功能模块建设中..." />
);

// --- 5. 主应用组件 ---
const App: React.FC = () => {
  const isNgrokHost = typeof window !== 'undefined' && window.location.hostname.endsWith('.ngrok-free.dev');

  const [collapsed, setCollapsed] = useState(false);
  const [activeMenuKey, setActiveMenuKey] = useState('dashboard');
  const [activeTabKey, setActiveTabKey] = useState('dashboard_overview');
  const [activeDomain, setActiveDomain] = useState<DomainKey>('ALL');

  // 认证状态
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // 仓库状态
  const [userWarehouses, setUserWarehouses] = useState<any[]>([]);
  const [currentWarehouseId, setCurrentWarehouseId] = useState<string>('');

  const currentRole = (currentUser?.role || 'ADMIN') as UserRole;

  // 初始化时检查 localStorage
  useEffect(() => {
    if (isNgrokHost) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }

    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        setCurrentUser(user);
        setIsAuthenticated(true);
        // 加载仓库列表
        if (user.warehouses) {
          setUserWarehouses(user.warehouses);
        }
      } catch {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setAuthLoading(false);
  }, [isNgrokHost]);

  const handleLoginSuccess = (user: any, _token: string) => {
    const loginRole = (user?.role || 'ADMIN') as UserRole;
    const allowedDomains = DOMAIN_CONFIG.filter(domain => !domain.roles || domain.roles.includes(loginRole));

    setCurrentUser(user);
    setIsAuthenticated(true);
    setActiveDomain(allowedDomains[0]?.key || 'ALL');
    setActiveMenuKey('');
    setActiveTabKey('');
    // 初始化仓库列表
    setUserWarehouses(user.warehouses || []);
    setCurrentWarehouseId('');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setCurrentUser(null);
    setUserWarehouses([]);
    setCurrentWarehouseId('');
    setActiveDomain('ALL');
    setActiveMenuKey('dashboard');
    setActiveTabKey('dashboard_overview');
    message.success('已退出登录');
  };

  const { token: { colorBgContainer, borderRadiusLG } } = theme.useToken();

  const availableDomains = useMemo(
    () => DOMAIN_CONFIG.filter(domain => !domain.roles || domain.roles.includes(currentRole)),
    [currentRole]
  );

  const businessMode: 'ALL' | 'AIR' | 'SEA' =
    activeDomain === 'SEA' ? 'SEA' : activeDomain === 'AIR' ? 'AIR' : 'ALL';

  // 权限过滤（必须在条件返回之前，保持 hooks 顺序一致）
  const filteredMenuConfig = useMemo(() => {
    const filter = (items: MenuItemConfig[]): MenuItemConfig[] => {
      return items
        .map((item): MenuItemConfig | null => {
          const filteredTabs = item.tabs 
            ? item.tabs.filter(t => {
              const hasTabRolePermission = !t.roles || t.roles.includes(currentRole);
              const hasTabDomainPermission = !t.domains || t.domains.includes(activeDomain);
              return hasTabRolePermission && hasTabDomainPermission;
            })
            : undefined;

          const filteredChildren = item.children 
            ? filter(item.children) 
            : undefined;

          const hasRolePermission = !item.roles || item.roles.includes(currentRole);
          const hasDomainPermission = !item.domains || item.domains.includes(activeDomain);

          if (!hasRolePermission || !hasDomainPermission) return null;

          const hasValidTabs = filteredTabs && filteredTabs.length > 0;
          const hasValidChildren = filteredChildren && filteredChildren.length > 0;

          // 允许没有 Tabs 也没有 Children 的节点（直接链接）
          // 但前提是它在原始配置中就没有 Children/Tabs (如 oms_order_mgt 现在变成了叶子节点)
          // 我们可以通过检查 original item 是否有 children/tabs 来决定
          const originalHasChildren = item.children && item.children.length > 0;
          const originalHasTabs = item.tabs && item.tabs.length > 0;

          if (originalHasChildren && !hasValidChildren && !originalHasTabs) return null; // 原来有子菜单，现在过滤没了 -> 隐藏
          if (originalHasTabs && !hasValidTabs) return null; // 原来有Tabs，现在过滤没了 -> 隐藏

          return { ...item, children: filteredChildren, tabs: filteredTabs };
        })
        .filter(notNull);
    };
    return filter(MENU_CONFIG);
  }, [currentRole, activeDomain]);

  useEffect(() => {
    if (availableDomains.length === 0) return;
    const hasActiveDomain = availableDomains.some(domain => domain.key === activeDomain);
    if (!hasActiveDomain) {
      setActiveDomain(availableDomains[0].key);
    }
  }, [availableDomains, activeDomain]);

  useEffect(() => {
    if (filteredMenuConfig.length === 0) {
      if (activeMenuKey) setActiveMenuKey('');
      if (activeTabKey) setActiveTabKey('');
      return;
    }

    let currentNode: MenuItemConfig | null = null;
    for (const module of filteredMenuConfig) {
      if (module.key === activeMenuKey) {
        currentNode = module;
        break;
      }
      const found = module.children?.find(sub => sub.key === activeMenuKey);
      if (found) {
        currentNode = found;
        break;
      }
    }

    if (!currentNode) {
      const firstModule = filteredMenuConfig[0];
      const firstNode = firstModule.children?.[0] || firstModule;
      const nextTabKey = firstNode.tabs?.[0]?.key || '';

      if (activeMenuKey !== firstNode.key) setActiveMenuKey(firstNode.key);
      if (activeTabKey !== nextTabKey) setActiveTabKey(nextTabKey);
      return;
    }

    if (currentNode.tabs && currentNode.tabs.length > 0) {
      const hasActiveTab = currentNode.tabs.some(tab => tab.key === activeTabKey);
      if (!hasActiveTab && activeTabKey !== currentNode.tabs[0].key) {
        setActiveTabKey(currentNode.tabs[0].key);
      }
    } else if (activeTabKey) {
      setActiveTabKey('');
    }
  }, [filteredMenuConfig, activeMenuKey, activeTabKey]);

  // 生成侧边栏项
  const menuItems: MenuProps['items'] = filteredMenuConfig.map(item => ({
    key: item.key,
    icon: item.icon,
    label: item.label,
    children: item.children?.map(sub => ({
      key: sub.key,
      label: sub.label,
    }))
  }));

  const domainMenuItems: MenuProps['items'] = availableDomains.map(domain => ({
    key: domain.key,
    label: domain.label
  }));

  // 查找当前选中的配置
  const currentSubMenu = useMemo(() => {
    for (const module of filteredMenuConfig) {
      if (module.key === activeMenuKey) return module;
      const found = module.children?.find(sub => sub.key === activeMenuKey);
      if (found) return found;
    }
    return null;
  }, [activeMenuKey, filteredMenuConfig]);

  const breadcrumbItems = useMemo(() => {
    const domainLabel = availableDomains.find(domain => domain.key === activeDomain)?.label || '综合协同';
    const items: { title: string }[] = [{ title: '首页' }, { title: domainLabel }];
    for (const module of filteredMenuConfig) {
      if (module.key === activeMenuKey) {
        items.push({ title: module.label });
        break;
      }
      const found = module.children?.find(sub => sub.key === activeMenuKey);
      if (found) {
        items.push({ title: module.label });
        items.push({ title: found.label });
        break;
      }
    }
    return items;
  }, [activeDomain, activeMenuKey, availableDomains, filteredMenuConfig]);

  // 未登录或加载中，显示登录页（放在所有 hooks 之后）
  if (authLoading) return null;
  if (!isAuthenticated) return <LoginPage onLoginSuccess={handleLoginSuccess} />;

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    let sub: MenuItemConfig | null = null;
    for (const module of filteredMenuConfig) {
      if (module.key === e.key) {
        if (module.children && module.children.length > 0) {
          const firstChild = module.children[0];
          setActiveMenuKey(firstChild.key);
          setActiveTabKey(firstChild.tabs?.[0]?.key || '');
          return;
        }
        sub = module;
        break;
      }
      const foundChild = module.children?.find(s => s.key === e.key) || null;
      sub = foundChild;
      if (sub) break;
    }

    setActiveMenuKey(e.key);
    if (sub && sub.tabs && sub.tabs.length > 0) {
      setActiveTabKey(sub.tabs[0].key);
    } else {
      setActiveTabKey('');
    }
  };

  const currentTabs = currentSubMenu?.tabs || [];
  const showTabs = currentTabs.length > 1;
  const contentTabKey = showTabs
    ? activeTabKey
    : (currentTabs[0]?.key || activeMenuKey);
  const isDashboardRoot = activeMenuKey === 'dashboard' && !activeTabKey;

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} width={220}>
        <div style={{ height: 32, margin: 16, background: 'rgba(255,255,255,0.2)', borderRadius: 6, textAlign: 'center', color: '#fff', lineHeight: '32px', fontWeight: 'bold' }}>
          {collapsed ? 'TMS' : '跨境物流系统'}
        </div>
        <Menu 
          theme="dark" 
          mode="inline" 
          selectedKeys={activeMenuKey ? [activeMenuKey] : []}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
          <Space size="middle" style={{ flex: 1, minWidth: 0 }}>
            <Button type="text" icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />} onClick={() => setCollapsed(!collapsed)} />
            <div style={{ minWidth: 360, flex: 1 }}>
              <Menu
                mode="horizontal"
                selectedKeys={[activeDomain]}
                items={domainMenuItems}
                onClick={({ key }) => setActiveDomain(key as DomainKey)}
                style={{ borderBottom: 'none' }}
              />
            </div>
          </Space>
          <Space>
            <span style={{ color: '#666' }}>{currentUser?.realName || currentUser?.username}</span>
            {userWarehouses.length > 0 && (
              <Select
                value={currentWarehouseId || undefined}
                onChange={(val) => setCurrentWarehouseId(val || '')}
                style={{ width: 150 }}
                placeholder="全部仓库"
                allowClear
                size="small"
                options={userWarehouses.map((w: any) => ({ value: w.id, label: w.name }))}
              />
            )}
            <Tag color="blue">{ROLE_NAMES[currentRole] || currentRole}</Tag>
            <Dropdown
              menu={{
                items: [
                  { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true }
                ],
                onClick: ({ key }) => { if (key === 'logout') handleLogout(); }
              }}
              placement="bottomRight"
            >
              <Avatar icon={<UserOutlined />} style={{ cursor: 'pointer', backgroundColor: '#667eea' }} />
            </Dropdown>
          </Space>
        </Header>
        <Content style={{ margin: '16px', overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: 8, padding: '0 4px', flex: '0 0 auto' }}>
            <Breadcrumb items={breadcrumbItems} />
          </div>
          {filteredMenuConfig.length === 0 ? (
            <Result status="403" title="当前业务域无可访问菜单" subTitle="请联系管理员分配角色或切换业务域" />
          ) : (
            <div
              className="app-content-shell"
              style={{
                padding: isDashboardRoot ? 0 : 16,
                background: isDashboardRoot ? 'transparent' : colorBgContainer,
                borderRadius: borderRadiusLG,
                minHeight: 0,
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {showTabs ? (
                <>
                  <Tabs
                    type="card"
                    activeKey={activeTabKey}
                    onChange={setActiveTabKey}
                    items={currentTabs.map(tab => ({
                      key: tab.key,
                      label: tab.label,
                    }))}
                    style={{ flex: '0 0 auto' }}
                  />
                  <div className="app-content-scroll" style={{ flex: 1, minHeight: 0, overflow: 'auto', paddingRight: 4 }}>
                    <ContentRenderer tabKey={activeTabKey || contentTabKey} currentRole={currentRole} warehouseId={currentWarehouseId} businessMode={businessMode} />
                  </div>
                </>
              ) : (
                <div className="app-content-scroll" style={{ flex: 1, minHeight: 0, overflow: 'auto', paddingRight: 4 }}>
                  <ContentRenderer tabKey={contentTabKey} currentRole={currentRole} warehouseId={currentWarehouseId} businessMode={businessMode} />
                </div>
              )}
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  );
};

const ContentRenderer = ({ tabKey, currentRole, warehouseId, businessMode }: { tabKey: string, currentRole: UserRole, warehouseId?: string, businessMode?: 'ALL' | 'AIR' | 'SEA' }) => {
  // 工作台tabs
  if (tabKey === 'dashboard_overview') return <RoleBasedDashboard role={currentRole} />;
  if (tabKey === 'dashboard_todo') return <TodoList />;
  if (tabKey === 'dashboard_alert') return <AlertCenter />;
  if (tabKey === 'dashboard_web_full_flow') return <WebFullFlowRunner />;

  // 已实现的页面
  switch (tabKey) {
    case 'crm_public': return <PublicPool />;
    case 'crm_my': return <MyCustomers />;
    case 'crm_price': return <PriceCalculator />;
    case 'oms_order_mgt': return <OrderListV2 businessMode={businessMode} />;
    case 'oms_order_list': return <OrderListV2 businessMode={businessMode} />;
    case 'oms_list': return <OrderListV2 businessMode={businessMode} />;
    case 'tms_dest_job_list': return <DestJobManager businessMode={businessMode} />;
    // WMS - 起运国仓储
    case 'wms_in_scan': return <InboundScan />;
    case 'wms_in_record': return <InboundList warehouseId={warehouseId} businessMode={businessMode} />;
    case 'wms_stock_list': return <StockList warehouseId={warehouseId} businessMode={businessMode} />;
    case 'wms_stock_return': return <ReturnProcess warehouseId={warehouseId} businessMode={businessMode} />;
    case 'wms_stock_noorder': return <NoOrderExpress warehouseId={warehouseId} businessMode={businessMode} />;
    case 'wms_box_sea': return <ContainerMgt warehouseId={warehouseId} businessMode={businessMode} />;
    case 'wms_box_air': return <AirCargoMgt warehouseId={warehouseId} businessMode={businessMode} />;
    case 'wms_box_list': return <ContainerMgt warehouseId={warehouseId} businessMode={businessMode} />;
    case 'wms_transfer_list': return <TransferList warehouseId={warehouseId} businessMode={businessMode} />;
    // WMS - 到达国仓储
    case 'wms_dest_in_list': return <DestInboundList warehouseId={warehouseId} businessMode={businessMode} />;
    case 'wms_dest_in_confirm': return <DestInboundList warehouseId={warehouseId} businessMode={businessMode} />;
    case 'wms_delivery_create': return <DeliveryList warehouseId={warehouseId} businessMode={businessMode} />;
    case 'wms_delivery_list': return <DPNManageList businessMode={businessMode} />;
    case 'wms_delivery_track': return <DeliveryList warehouseId={warehouseId} businessMode={businessMode} />;
    case 'wms_pickup_list': return <PickupList warehouseId={warehouseId} businessMode={businessMode} />;
    case 'wms_dest_stock_list': return <DestStockList warehouseId={warehouseId} businessMode={businessMode} />;
    case 'wms_dest_dpn_manage': return <DPNManageList businessMode={businessMode} />;
    case 'wms_dest_transfer_list': return <DestTransferList warehouseId={warehouseId} businessMode={businessMode} />;
    // 财务中心
    case 'fin_fee_input': return <FeeInput />;
    case 'fin_fee_approval': return <FeeApproval />;
    case 'fin_job_profit': return <JobProfitDashboard businessMode={businessMode} />;
    case 'fin_job_audit': return <JobCostAudit businessMode={businessMode} />;
    case 'fin_payable': return <PayableManagement businessMode={businessMode} />;
    case 'fin_receivable': return <ReceivableManagement businessMode={businessMode} />;
    case 'fin_receivable_pol': return <ReceivableManagement businessMode={businessMode} />;
    case 'fin_receivable_pod': return <ReceivableManagement businessMode={businessMode} />;
    case 'fin_petty_apply': return <PettyCashApply />;
    case 'fin_petty_verify': return <PettyCashVerify />;
    case 'fin_commission': return <CommissionCalculation />;
    case 'fin_salary': return <SalaryPayment />;
    case 'fin_commission_rules': return <CommissionRuleManagement />;
    case 'fin_receivable_aging': return <ReceivableAging />;
    case 'fin_payable_schedule': return <PaymentSchedule />;
    case 'fin_cashflow_daily': return <CashFlowDaily />;
    // 财务中心 - 报表
    case 'fin_cost_report': return <CostReport businessMode={businessMode} />;
    case 'fin_order_report': return <OrderReport businessMode={businessMode} />;
    // 经营分析
    case 'analytics_executive': return <ExecutiveDashboard businessMode={businessMode} />;
    case 'analytics_customer_value': return <CustomerValueAnalysis />;
    case 'analytics_route_profit': return <RouteProfitAnalysis businessMode={businessMode} />;
    case 'analytics_transit': return <TransitPerformance businessMode={businessMode} />;
    case 'analytics_cost_structure': return <CostStructureAnalysis businessMode={businessMode} />;
    // 系统设置
    case 'set_base_region': return <RegionManagement />;
    case 'set_base_supplier': return <SupplierManagement />;
    case 'set_base_express': return <ExpressCompanyManagement />;
    case 'set_base_carrier': return <CarrierManagement />;
    case 'set_base_goods': return <GoodsCategoryManagement />;
    case 'set_base_route': return <RouteManagement />;
    case 'set_base_warehouse_mgmt': return <WarehouseManagement />;
    case 'set_org_department': return <DepartmentManagement />;
    case 'set_base_warehouse': return <TransitWarehouseManagement />;
    case 'set_base_feetype': return <FeeTypeManagement />;
    case 'set_base_exchange': return <ExchangeRateManagement />;
    case 'set_base_logistics_node': return <LogisticsNodeManagement />;
    case 'set_auth_user': return <UserManagement />;
    case 'set_auth_role': return <RoleManagement />;
    case 'set_auth_permission': return <PermissionManagement />;
    case 'set_base_rate': return <FreightRateRule />;
    case 'set_workflow_list': return <WorkflowConfigPage />;
    // 起运国办
    case 'tms_origin_task': return <OriginTaskManager />;
    case 'tms_cost_pol_list': return <JobCostInputPOL businessMode={businessMode} />;
    case 'tms_receivable_pol_list': return <ReceivableManagement businessMode={businessMode} />;
    case 'tms_order_fee_list': return <OrderFeeInput businessMode={businessMode} />;
    // 到达国办 - 新增页面
    case 'tms_cost_pod_list': return <JobCostInputPOD businessMode={businessMode} />;
    case 'tms_dpn_cost_list': return <DPNCost businessMode={businessMode} />;
    case 'tms_receivable_pod_list': return <ReceivableManagement businessMode={businessMode} />;
    default: return <ComingSoon title={tabKey} />;
  }
};

export default App;
