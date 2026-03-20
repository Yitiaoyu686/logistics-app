import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from '@/pages/auth/Login'
import WarehouseSelect from '@/pages/auth/WarehouseSelect'
import Dashboard from '@/pages/warehouse-cn/Dashboard'
import TaskHub from '@/pages/warehouse-cn/TaskHub'
import Profile from '@/pages/profile/Profile'
import NotificationSettings from '@/pages/profile/NotificationSettings'
import OperationHistory from '@/pages/profile/OperationHistory'
import GeneralSettings from '@/pages/profile/GeneralSettings'
import EditProfile from '@/pages/profile/EditProfile'
import ChangePassword from '@/pages/profile/ChangePassword'
import AboutPage from '@/pages/profile/About'
import InboundScan from '@/pages/inbound/InboundScan'
import InboundForm from '@/pages/inbound/InboundForm'
import InboundSuccess from '@/pages/inbound/InboundSuccess'
import PendingInboundList from '@/pages/inbound/PendingInboundList'
import InboundTaskDetail from '@/pages/inbound/InboundTaskDetail'
import InboundOrderDetail from '@/pages/inbound/InboundOrderDetail'
import PackingTaskDetail from '@/pages/packing/PackingTaskDetail'
import PackingScan from '@/pages/packing/PackingScan'
import InboundPrint from '@/pages/inbound/InboundPrint'
import TransferCreate from '@/pages/warehouse-cn/TransferCreate'
import TransferDetail from '@/pages/warehouse-cn/TransferDetail'
import StockDetail from '@/pages/warehouse-cn/StockDetail'
import InboundHistory from '@/pages/warehouse-cn/InboundHistory'
import ContainerCreate from '@/pages/warehouse-cn/ContainerCreate'
import PackingRecords from '@/pages/warehouse-cn/PackingRecords'
import NoOrderExpress from '@/pages/warehouse-cn/NoOrderExpress'
import ExpressMatchOrder from '@/pages/warehouse-cn/ExpressMatchOrder'
import ReturnRecords from '@/pages/warehouse-cn/ReturnRecords'
import ReturnDetail from '@/pages/warehouse-cn/ReturnDetail'
import ScanOrder from '@/pages/warehouse-cn/ScanOrder'
import TaskPlanDetail from '@/pages/warehouse-cn/TaskPlanDetail'
import BottomTabBar from '@/components/BottomTabBar'
import GlobalNotification from '@/components/GlobalNotification'
// 到达国仓储页面
import DashboardUS from '@/pages/warehouse-us/Dashboard'
import TaskHubUS from '@/pages/warehouse-us/TaskHub'
import InboundScanUS from '@/pages/warehouse-us/inbound/InboundScan'
import InboundRecords from '@/pages/warehouse-us/inbound/InboundRecords'
import InboundRecordDetail from '@/pages/warehouse-us/inbound/InboundRecordDetail'
import DeliveryCreate from '@/pages/warehouse-us/delivery/DeliveryCreate'
import DeliveryList from '@/pages/warehouse-us/delivery/DeliveryList'
import DeliveryDetail from '@/pages/warehouse-us/delivery/DeliveryDetail'
import ContainerTaskList from '@/pages/warehouse-us/container/ContainerTaskList'
import ContainerTaskDetail from '@/pages/warehouse-us/container/ContainerTaskDetail'
import TransferListUS from '@/pages/warehouse-us/transfer/TransferList'
import TransferDetailUS from '@/pages/warehouse-us/transfer/TransferDetail'
import TransferCreateUS from '@/pages/warehouse-us/transfer/TransferCreate'
import StockDetailUS from '@/pages/warehouse-us/stock/StockDetail'
import ScanOrderUS from '@/pages/warehouse-us/ScanOrder'
// 销售端页面
import SalesDashboard from '@/pages/sales/Dashboard'
import SalesWorkHub from '@/pages/sales/WorkHub'
import ShippingTaskDetail from '@/pages/sales/ShippingTaskDetail'
import CustomerDetail from '@/pages/sales/CustomerDetail'
import CustomerCreate from '@/pages/sales/CustomerCreate'
import SalesOrderDetail from '@/pages/sales/OrderDetail'
import SalesOrderCreate from '@/pages/sales/OrderCreate'
import QuoteTool from '@/pages/sales/QuoteTool'
import ReminderHistory from '@/pages/sales/ReminderHistory'

function App() {
  const isAuthenticated = () => {
    return !!localStorage.getItem('user') && !!localStorage.getItem('token')
  }

  const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    if (!isAuthenticated()) {
      return <Navigate to="/login" replace />
    }
    return <>{children}</>
  }

  const RoleRedirect = () => {
    const user = localStorage.getItem('user')
    if (!user) return <Navigate to="/login" replace />
    try {
      const { role } = JSON.parse(user)
      if (role === 'SALES') return <Navigate to="/sales/dashboard" replace />
      if (role === 'WAREHOUSE_US') return <Navigate to="/warehouse-us/dashboard" replace />
    } catch {}
    return <Navigate to="/dashboard" replace />
  }

  const MainLayout = ({ children }: { children: React.ReactNode }) => {
    return (
      <>
        {children}
        <BottomTabBar />
      </>
    )
  }

  return (
    <BrowserRouter>
      <GlobalNotification />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/warehouse-select" element={<WarehouseSelect />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Dashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/task-hub"
          element={
            <ProtectedRoute>
              <MainLayout>
                <TaskHub />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks"
          element={
            <ProtectedRoute>
              <Navigate to="/task-hub?tab=packing" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tasks/:taskId"
          element={
            <ProtectedRoute>
              <TaskPlanDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Profile />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        {/* 个人中心子页面路由 */}
        <Route
          path="/profile/notifications"
          element={
            <ProtectedRoute>
              <NotificationSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/history"
          element={
            <ProtectedRoute>
              <OperationHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/settings"
          element={
            <ProtectedRoute>
              <GeneralSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/edit"
          element={
            <ProtectedRoute>
              <EditProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/about"
          element={
            <ProtectedRoute>
              <AboutPage />
            </ProtectedRoute>
          }
        />
        {/* 入库相关路由 */}
        <Route
          path="/inbound/task/:taskId"
          element={
            <ProtectedRoute>
              <InboundTaskDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inbound/pending"
          element={
            <ProtectedRoute>
              <PendingInboundList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inbound/order/:orderId"
          element={
            <ProtectedRoute>
              <InboundOrderDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inbound/scan"
          element={
            <ProtectedRoute>
              <InboundScan />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inbound/form"
          element={
            <ProtectedRoute>
              <InboundForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inbound/success"
          element={
            <ProtectedRoute>
              <InboundSuccess />
            </ProtectedRoute>
          }
        />
        {/* 面单打印路由 */}
        <Route
          path="/inbound/print"
          element={
            <ProtectedRoute>
              <InboundPrint />
            </ProtectedRoute>
          }
        />
        {/* 装箱相关路由 */}
        <Route
          path="/packing/task/:taskId"
          element={
            <ProtectedRoute>
              <PackingTaskDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/packing/scan"
          element={
            <ProtectedRoute>
              <PackingScan />
            </ProtectedRoute>
          }
        />
        {/* 调拨相关路由 */}
        <Route
          path="/transfer/create"
          element={
            <ProtectedRoute>
              <TransferCreate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transfer/detail/:transferId"
          element={
            <ProtectedRoute>
              <TransferDetail />
            </ProtectedRoute>
          }
        />
        {/* 库存相关路由 */}
        <Route
          path="/stock/detail/:subOrderNo"
          element={
            <ProtectedRoute>
              <StockDetail />
            </ProtectedRoute>
          }
        />
        {/* 入库记录路由 */}
        <Route
          path="/inbound/history"
          element={
            <ProtectedRoute>
              <InboundHistory />
            </ProtectedRoute>
          }
        />
        {/* 集装箱相关路由 */}
        <Route
          path="/container/create"
          element={
            <ProtectedRoute>
              <ContainerCreate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/container/edit/:containerId"
          element={
            <ProtectedRoute>
              <ContainerCreate />
            </ProtectedRoute>
          }
        />
        {/* 装箱记录路由 */}
        <Route
          path="/packing/records"
          element={
            <ProtectedRoute>
              <PackingRecords />
            </ProtectedRoute>
          }
        />
        {/* 无订单快递路由 */}
        <Route
          path="/no-order-express"
          element={
            <ProtectedRoute>
              <NoOrderExpress />
            </ProtectedRoute>
          }
        />
        {/* 快递匹配订单路由 */}
        <Route
          path="/express/match-order/:expressId"
          element={
            <ProtectedRoute>
              <ExpressMatchOrder />
            </ProtectedRoute>
          }
        />
        {/* 退运记录路由 */}
        <Route
          path="/return-records"
          element={
            <ProtectedRoute>
              <ReturnRecords />
            </ProtectedRoute>
          }
        />
        {/* 退运详情路由 */}
        <Route
          path="/return/detail/:id"
          element={
            <ProtectedRoute>
              <ReturnDetail />
            </ProtectedRoute>
          }
        />
        {/* 扫码查询路由 */}
        <Route
          path="/scan-order"
          element={
            <ProtectedRoute>
              <ScanOrder />
            </ProtectedRoute>
          }
        />
        {/* 到达国仓储路由 */}
        <Route
          path="/warehouse-us/dashboard"
          element={
            <ProtectedRoute>
              <MainLayout>
                <DashboardUS />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/warehouse-us/task-hub"
          element={
            <ProtectedRoute>
              <MainLayout>
                <TaskHubUS />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/warehouse-us/profile"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Profile />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route path="/warehouse-us/profile/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
        <Route path="/warehouse-us/profile/history" element={<ProtectedRoute><OperationHistory /></ProtectedRoute>} />
        <Route path="/warehouse-us/profile/settings" element={<ProtectedRoute><GeneralSettings /></ProtectedRoute>} />
        <Route path="/warehouse-us/profile/edit" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
        <Route path="/warehouse-us/profile/password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
        <Route path="/warehouse-us/profile/about" element={<ProtectedRoute><AboutPage /></ProtectedRoute>} />
        {/* 到达国入库路由 */}
        <Route
          path="/warehouse-us/inbound/scan"
          element={
            <ProtectedRoute>
              <InboundScanUS />
            </ProtectedRoute>
          }
        />
        <Route
          path="/warehouse-us/inbound/records"
          element={
            <ProtectedRoute>
              <InboundRecords />
            </ProtectedRoute>
          }
        />
        <Route
          path="/warehouse-us/inbound/record/:id"
          element={
            <ProtectedRoute>
              <InboundRecordDetail />
            </ProtectedRoute>
          }
        />
        {/* 到达国配送路由 */}
        <Route
          path="/warehouse-us/delivery/create"
          element={
            <ProtectedRoute>
              <DeliveryCreate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/warehouse-us/delivery/list"
          element={
            <ProtectedRoute>
              <MainLayout>
                <DeliveryList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/warehouse-us/delivery/detail/:dpnNo"
          element={
            <ProtectedRoute>
              <DeliveryDetail />
            </ProtectedRoute>
          }
        />
        {/* 到达国集装箱任务路由 */}
        <Route
          path="/warehouse-us/container/list"
          element={
            <ProtectedRoute>
              <MainLayout>
                <ContainerTaskList />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/warehouse-us/container/task/:taskId"
          element={
            <ProtectedRoute>
              <ContainerTaskDetail />
            </ProtectedRoute>
          }
        />
        {/* 到达国调拨路由 */}
        <Route
          path="/warehouse-us/transfer/create"
          element={
            <ProtectedRoute>
              <TransferCreateUS />
            </ProtectedRoute>
          }
        />
        <Route
          path="/warehouse-us/transfer/list"
          element={
            <ProtectedRoute>
              <MainLayout>
                <TransferListUS />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/warehouse-us/transfer/detail/:id"
          element={
            <ProtectedRoute>
              <TransferDetailUS />
            </ProtectedRoute>
          }
        />
        {/* 到达国扫码查询路由 */}
        <Route
          path="/warehouse-us/scan-order"
          element={
            <ProtectedRoute>
              <ScanOrderUS />
            </ProtectedRoute>
          }
        />
        {/* 到达国库存路由 */}
        <Route
          path="/warehouse-us/stock/detail/:orderNo"
          element={
            <ProtectedRoute>
              <StockDetailUS />
            </ProtectedRoute>
          }
        />
        {/* 销售端路由 */}
        <Route
          path="/sales/dashboard"
          element={
            <ProtectedRoute>
              <MainLayout>
                <SalesDashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/task-hub"
          element={
            <ProtectedRoute>
              <MainLayout>
                <SalesWorkHub />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/profile"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Profile />
              </MainLayout>
            </ProtectedRoute>
          }
        />
        <Route path="/sales/profile/notifications" element={<ProtectedRoute><NotificationSettings /></ProtectedRoute>} />
        <Route path="/sales/profile/history" element={<ProtectedRoute><OperationHistory /></ProtectedRoute>} />
        <Route path="/sales/profile/settings" element={<ProtectedRoute><GeneralSettings /></ProtectedRoute>} />
        <Route path="/sales/profile/edit" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
        <Route path="/sales/profile/password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
        <Route path="/sales/profile/about" element={<ProtectedRoute><AboutPage /></ProtectedRoute>} />
        <Route
          path="/sales/task/:taskId"
          element={
            <ProtectedRoute>
              <ShippingTaskDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/customer/create"
          element={
            <ProtectedRoute>
              <CustomerCreate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/customer/:customerId"
          element={
            <ProtectedRoute>
              <CustomerDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/order/create"
          element={
            <ProtectedRoute>
              <SalesOrderCreate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/order/:orderId"
          element={
            <ProtectedRoute>
              <SalesOrderDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/quote"
          element={
            <ProtectedRoute>
              <QuoteTool />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/quote/:taskId"
          element={
            <ProtectedRoute>
              <QuoteTool />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/reminder/:paymentId"
          element={
            <ProtectedRoute>
              <ReminderHistory />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<RoleRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
