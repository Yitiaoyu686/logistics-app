// 设计 Token — 喵喵国际物流
// 风格：克制专业，深色 Header + 白色内容区
// 颜色原则：
//   - 橙色(#FF6B35) 只用于底部中央 FAB 按钮，全局唯一强调
//   - 主操作按钮用深色(#1A1F36)
//   - 状态色只用于文字，不大面积铺背景
//   - 任务卡片左侧竖条统一用浅色，不五颜六色

export const colors = {
  // Brand — 仅用于 FAB 按钮
  brand: '#FF6B35',
  brandShadow: 'rgba(255,107,53,0.35)',

  // Primary — 深色，用于主操作按钮、激活态、链接
  primary: '#1A1F36',
  primaryDark: '#1A1F36',
  primaryLight: '#F0F1F5',

  // Header
  headerStart: '#1A1F36',
  headerEnd: '#252B45',

  // Status — 只用于文字和小点，不大面积铺色
  success: '#059669',
  successLight: '#F0FDF4',
  warning: '#D97706',
  warningLight: '#FFFBEB',
  danger: '#DC2626',
  dangerLight: '#FEF2F2',
  info: '#2563EB',
  infoLight: '#EFF6FF',

  // Neutral — 主要用色
  bg: '#F4F5F7',
  card: '#FFFFFF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  text: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  disabled: '#D1D5DB',

  // Task card 左侧竖条 — 统一浅色，靠图标区分类型
  taskBorder: '#E5E7EB',

  // 保留少量语义色，仅用于状态文字
  taskInbound: '#2563EB',
  taskPacking: '#059669',
  taskDispatch: '#7C3AED',
  taskTransfer: '#0891B2',
  taskOrphan: '#D97706',
  taskExecute: '#1A1F36',
  taskDelivery: '#DB2777',
  taskPickup: '#0D9488',
  taskPreview: '#4F46E5',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  xxl: 28,
  full: 999,
};

export const font = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 26,
  xxxl: 32,
  mono: 'Courier',
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 6,
  },
  brand: {
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
};
