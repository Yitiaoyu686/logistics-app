// ========== 销售提成奖金计算工具库 ==========

// ========== 类型定义 ==========

/** 方案类型枚举 */
export type CommissionPlanType =
  | 'PLAN_A_ABCD'          // 广州主方案ABCD（空运，双指标互锁）
  | 'PLAN_B_SEA_VETERAN'   // 海运老员工方案（广州）
  | 'PLAN_C_NIGERIA_SEA'   // 尼日利亚海运方案
  | 'PLAN_D_NIGERIA_AIR';  // 尼日利亚空运方案

/** 币种 */
export type Currency = 'CNY' | 'NGN';

/** 方案类型中文名映射 */
export const PLAN_TYPE_LABELS: Record<CommissionPlanType, string> = {
  PLAN_A_ABCD: '广州主方案ABCD',
  PLAN_B_SEA_VETERAN: '海运老员工方案',
  PLAN_C_NIGERIA_SEA: '尼日利亚海运方案',
  PLAN_D_NIGERIA_AIR: '尼日利亚空运方案',
};

/** ABCD 阶梯等级 */
export type ABCDLevel = 'A' | 'B' | 'C' | 'D';

/** ABCD 阶梯定义 */
export interface ABCDTier {
  level: ABCDLevel;
  minTickets: number;             // 最低票数
  maxGrossProfit: number | null;  // 毛利上限(null=无上限)
  pricePerTicket: number;         // 每票单价(元)
  profitRate: number;             // 毛利提成比例
}

/** 方案一配置 */
export interface PlanABCDConfig {
  baseTickets: number;            // 基本任务票数(50)
  salaryMultiplier: number;       // 毛利基数=工资×N(3)
  tiers: ABCDTier[];
}

/** 海运老员工方案配置 */
export interface PlanSeaVeteranConfig {
  baseTask: number;               // 基本任务(6000元)
  tierBreakpoint: number;         // 分段点(35000元)
  lowerRate: number;              // 低段比例(0.4)
  upperRate: number;              // 高段比例(0.5)
}

/** 尼日利亚海运方案体积阶梯 */
export interface SeaVolumeTier {
  minCBM: number;
  maxCBM: number | null;
  pricePerCBM: number;            // NGN/m³
}

/** 尼日利亚海运方案配置 */
export interface PlanNigeriaSeaConfig {
  baseTaskCBM: number;            // 基本任务(30m³)
  tiers: SeaVolumeTier[];
}

/** 尼日利亚空运方案重量阶梯 */
export interface AirWeightTier {
  level: 'A' | 'B' | 'C';
  maxKg: number;
  pricePerKg: number;             // NGN/kg
}

/** 尼日利亚空运方案配置 */
export interface PlanNigeriaAirConfig {
  baseTaskKg: number;             // 基本任务(1000kg)
  tiers: AirWeightTier[];
}

/** 彩蛋奖金配置 */
export interface EasterEggBonusConfig {
  triggerWeightKg: number;        // 触发重量(40000kg)
  bonusAmount: number;            // 奖金总额(15000元)
  minPersonalWeightKg: number;    // 个人最低贡献(2000kg)
  minQualifiedCount: number;      // 最低达标人数(2)
}

/** 月度业绩数据(汇总后) */
export interface MonthlyPerformance {
  employeeId: string;
  month: string;                  // YYYY-MM
  totalTickets: number;
  totalGrossProfit: number;       // 总毛利(CNY)
  totalVolumeCBM: number;         // 总体积(m³)
  totalWeightKg: number;          // 总重量(kg)
  seaGrossProfit: number;         // 海运毛利
  airGrossProfit: number;         // 空运毛利
  excludedOrders: number;         // 被排除订单数(应收未回)
  receivableStatus: 'ALL_COLLECTED' | 'PARTIAL';
}

// ========== 计算结果类型 ==========

/** 方案一计算结果 */
export interface PlanABCDResult {
  planType: 'PLAN_A_ABCD';
  qualified: boolean;
  matchedLevel: ABCDLevel | null;
  ticketCount: number;
  grossProfit: number;
  profitBase: number;             // 毛利基数
  ticketCommission: number;       // 票数提成
  profitCommission: number;       // 毛利提成
  totalCommission: number;
  currency: 'CNY';
  degraded: boolean;              // 是否降级匹配
}

/** 方案二计算结果 */
export interface PlanSeaVeteranResult {
  planType: 'PLAN_B_SEA_VETERAN';
  qualified: boolean;
  seaGrossProfit: number;
  lowerBandAmount: number;        // 低段提成
  upperBandAmount: number;        // 高段提成
  seaCommission: number;
  airSupplementAmount: number;    // 空运补足金额
  totalCommission: number;
  currency: 'CNY';
}

/** 方案三阶梯明细 */
export interface VolumeTierBreakdown {
  tierLabel: string;
  volume: number;
  unitPrice: number;
  amount: number;
}

/** 方案三计算结果 */
export interface PlanNigeriaSeaResult {
  planType: 'PLAN_C_NIGERIA_SEA';
  qualified: boolean;
  totalVolumeCBM: number;
  tierBreakdown: VolumeTierBreakdown[];
  totalCommission: number;
  currency: 'NGN';
}

/** 方案四计算结果 */
export interface PlanNigeriaAirResult {
  planType: 'PLAN_D_NIGERIA_AIR';
  qualified: boolean;
  totalWeightKg: number;
  excessWeight: number;           // 超出基本任务重量
  matchedLevel: 'A' | 'B' | 'C' | null;
  unitPrice: number;
  totalCommission: number;
  currency: 'NGN';
}

/** 所有方案结果联合类型 */
export type CommissionPlanResult =
  | PlanABCDResult
  | PlanSeaVeteranResult
  | PlanNigeriaSeaResult
  | PlanNigeriaAirResult;

/** 彩蛋奖金成员分配 */
export interface EasterEggMemberAllocation {
  employeeId: string;
  weight: number;
  ratio: number;
  bonus: number;
}

/** 彩蛋奖金结果 */
export interface EasterEggBonusResult {
  triggered: boolean;
  teamTotalWeight: number;
  qualifiedMembers: EasterEggMemberAllocation[];
  invalidReason: string | null;
}

/** 坏账扣减结果 */
export interface BadDebtDeductionResult {
  originalAmount: number;
  badDebtAmount: number;
  deferredAmount: number;         // 递延扣减
  finalAmount: number;
}

/** 绩效建议 */
export type PerformanceSuggestion = 'RAISE' | 'CUT' | 'DISMISS' | null;

/** 绩效追踪结果 */
export interface PerformanceTrackResult {
  consecutiveQualified: number;
  consecutiveUnqualified: number;
  suggestion: PerformanceSuggestion;
}

// ========== 默认配置常量 ==========

export const DEFAULT_PLAN_ABCD_CONFIG: PlanABCDConfig = {
  baseTickets: 50,
  salaryMultiplier: 3,
  tiers: [
    { level: 'A', minTickets: 50,  maxGrossProfit: 15000,  pricePerTicket: 3,  profitRate: 0.15 },
    { level: 'B', minTickets: 200, maxGrossProfit: 30000,  pricePerTicket: 5,  profitRate: 0.20 },
    { level: 'C', minTickets: 350, maxGrossProfit: 100000, pricePerTicket: 8,  profitRate: 0.25 },
    { level: 'D', minTickets: 500, maxGrossProfit: null,   pricePerTicket: 13, profitRate: 0.35 },
  ],
};

export const DEFAULT_PLAN_SEA_VETERAN_CONFIG: PlanSeaVeteranConfig = {
  baseTask: 6000,
  tierBreakpoint: 35000,
  lowerRate: 0.40,
  upperRate: 0.50,
};

export const DEFAULT_PLAN_NIGERIA_SEA_CONFIG: PlanNigeriaSeaConfig = {
  baseTaskCBM: 30,
  tiers: [
    { minCBM: 30,  maxCBM: 100,  pricePerCBM: 5000 },
    { minCBM: 100, maxCBM: 200,  pricePerCBM: 9000 },
    { minCBM: 200, maxCBM: null, pricePerCBM: 15000 },
  ],
};

export const DEFAULT_PLAN_NIGERIA_AIR_CONFIG: PlanNigeriaAirConfig = {
  baseTaskKg: 1000,
  tiers: [
    { level: 'A', maxKg: 2500, pricePerKg: 120 },
    { level: 'B', maxKg: 4500, pricePerKg: 150 },
    { level: 'C', maxKg: 7500, pricePerKg: 200 },
  ],
};

export const DEFAULT_EASTER_EGG_CONFIG: EasterEggBonusConfig = {
  triggerWeightKg: 40000,
  bonusAmount: 15000,
  minPersonalWeightKg: 2000,
  minQualifiedCount: 2,
};

// ========== 工具函数 ==========

/** 保留2位小数 */
const round2 = (n: number): number => Math.round(n * 100) / 100;

// ========== 方案一：广州主方案ABCD ==========

/**
 * 方案一计算：双指标互锁阶梯提成
 * 从D向A逐级降级匹配，双指标（票数+毛利）同时满足
 */
export function calcPlanABCD(
  performance: MonthlyPerformance,
  salary: number,
  config: PlanABCDConfig,
): PlanABCDResult {
  const profitBase = round2(salary * config.salaryMultiplier);
  const { totalTickets, totalGrossProfit } = performance;
  const excessProfit = totalGrossProfit - profitBase;

  // 基本任务判定：票数≥50 且 毛利>基数
  if (totalTickets < config.baseTickets || excessProfit <= 0) {
    return {
      planType: 'PLAN_A_ABCD',
      qualified: false,
      matchedLevel: null,
      ticketCount: totalTickets,
      grossProfit: totalGrossProfit,
      profitBase,
      ticketCommission: 0,
      profitCommission: 0,
      totalCommission: 0,
      currency: 'CNY',
      degraded: false,
    };
  }

  // 从D向A逐级降级匹配
  let matchedTier: ABCDTier | null = null;
  let degraded = false;

  // 先找票数能达到的最高等级
  let highestTicketLevel = -1;
  for (let i = config.tiers.length - 1; i >= 0; i--) {
    if (totalTickets >= config.tiers[i].minTickets) {
      highestTicketLevel = i;
      break;
    }
  }

  if (highestTicketLevel < 0) {
    // 票数连A都达不到（理论上不会走到这里，因为已过基本任务判定）
    return {
      planType: 'PLAN_A_ABCD',
      qualified: false,
      matchedLevel: null,
      ticketCount: totalTickets,
      grossProfit: totalGrossProfit,
      profitBase,
      ticketCommission: 0,
      profitCommission: 0,
      totalCommission: 0,
      currency: 'CNY',
      degraded: false,
    };
  }

  // 从票数最高等级开始，查找毛利也满足的等级
  for (let i = highestTicketLevel; i >= 0; i--) {
    const tier = config.tiers[i];
    // D方案(maxGrossProfit=null)表示毛利>100000
    if (tier.maxGrossProfit === null) {
      // D方案：毛利需要超过前一级的上限
      matchedTier = tier;
      degraded = i < highestTicketLevel;
      break;
    } else if (excessProfit <= tier.maxGrossProfit) {
      matchedTier = tier;
      degraded = i < highestTicketLevel;
      break;
    }
  }

  // 如果所有级别都不匹配（毛利超出D但票数不够D），使用票数能达到的最高级
  if (!matchedTier) {
    matchedTier = config.tiers[highestTicketLevel];
    degraded = true;
  }

  const ticketCommission = round2(totalTickets * matchedTier.pricePerTicket);
  const profitCommission = round2(excessProfit * matchedTier.profitRate);
  const totalCommission = round2(ticketCommission + profitCommission);

  return {
    planType: 'PLAN_A_ABCD',
    qualified: true,
    matchedLevel: matchedTier.level,
    ticketCount: totalTickets,
    grossProfit: totalGrossProfit,
    profitBase,
    ticketCommission,
    profitCommission,
    totalCommission,
    currency: 'CNY',
    degraded,
  };
}

// ========== 方案二：海运老员工方案 ==========

/**
 * 方案二计算：毛利百分比阶梯提成
 * 6千~3.5万按40%，超3.5万按50%分段计算
 * 不足基本任务从空运提成补足
 */
export function calcPlanSeaVeteran(
  performance: MonthlyPerformance,
  airCommission: number,
  config: PlanSeaVeteranConfig,
): PlanSeaVeteranResult {
  const { seaGrossProfit } = performance;

  // 计算海运提成
  let lowerBandAmount = 0;
  let upperBandAmount = 0;
  let seaCommission = 0;

  if (seaGrossProfit >= config.baseTask) {
    // 达到基本任务
    if (seaGrossProfit <= config.tierBreakpoint) {
      lowerBandAmount = round2(seaGrossProfit * config.lowerRate);
    } else {
      lowerBandAmount = round2(config.tierBreakpoint * config.lowerRate);
      upperBandAmount = round2((seaGrossProfit - config.tierBreakpoint) * config.upperRate);
    }
    seaCommission = round2(lowerBandAmount + upperBandAmount);
  }

  // 不足基本任务 → 从空运提成补足差额
  let airSupplementAmount = 0;
  if (seaGrossProfit < config.baseTask) {
    const deficit = round2(config.baseTask - seaGrossProfit);
    airSupplementAmount = round2(Math.min(deficit, airCommission));
  }

  const totalCommission = round2(seaCommission + airSupplementAmount);

  return {
    planType: 'PLAN_B_SEA_VETERAN',
    qualified: seaGrossProfit >= config.baseTask,
    seaGrossProfit,
    lowerBandAmount,
    upperBandAmount,
    seaCommission,
    airSupplementAmount,
    totalCommission,
    currency: 'CNY',
  };
}

// ========== 方案三：尼日利亚海运方案 ==========

/**
 * 方案三计算：体积阶梯奖金（分段累进）
 * 30-100m³ NGN 5000/m³, 100-200m³ NGN 9000/m³, 200+m³ NGN 15000/m³
 */
export function calcPlanNigeriaSea(
  performance: MonthlyPerformance,
  config: PlanNigeriaSeaConfig,
): PlanNigeriaSeaResult {
  const { totalVolumeCBM } = performance;

  if (totalVolumeCBM < config.baseTaskCBM) {
    return {
      planType: 'PLAN_C_NIGERIA_SEA',
      qualified: false,
      totalVolumeCBM,
      tierBreakdown: [],
      totalCommission: 0,
      currency: 'NGN',
    };
  }

  // 分段累进计算
  const tierBreakdown: VolumeTierBreakdown[] = [];
  let remainingVolume = totalVolumeCBM;
  let totalCommission = 0;

  for (const tier of config.tiers) {
    if (remainingVolume <= 0) break;

    const tierMax = tier.maxCBM ?? Infinity;
    const tierRange = tierMax - tier.minCBM;
    const volumeInTier = Math.min(remainingVolume - tier.minCBM, tierRange);

    if (remainingVolume > tier.minCBM) {
      const effectiveVolume = tier.maxCBM
        ? round2(Math.min(remainingVolume - tier.minCBM, tier.maxCBM - tier.minCBM))
        : round2(remainingVolume - tier.minCBM);

      if (effectiveVolume > 0) {
        const amount = round2(effectiveVolume * tier.pricePerCBM);
        tierBreakdown.push({
          tierLabel: `${tier.minCBM}-${tier.maxCBM ?? '∞'}m³`,
          volume: effectiveVolume,
          unitPrice: tier.pricePerCBM,
          amount,
        });
        totalCommission = round2(totalCommission + amount);
      }
    }
  }

  return {
    planType: 'PLAN_C_NIGERIA_SEA',
    qualified: true,
    totalVolumeCBM,
    tierBreakdown,
    totalCommission,
    currency: 'NGN',
  };
}

// ========== 方案四：尼日利亚空运方案 ==========

/**
 * 方案四计算：重量阶梯奖金
 * 超出基本任务部分按最高匹配阶梯单价计算
 */
export function calcPlanNigeriaAir(
  performance: MonthlyPerformance,
  config: PlanNigeriaAirConfig,
): PlanNigeriaAirResult {
  const { totalWeightKg } = performance;

  if (totalWeightKg < config.baseTaskKg) {
    return {
      planType: 'PLAN_D_NIGERIA_AIR',
      qualified: false,
      totalWeightKg,
      excessWeight: 0,
      matchedLevel: null,
      unitPrice: 0,
      totalCommission: 0,
      currency: 'NGN',
    };
  }

  const excessWeight = round2(totalWeightKg - config.baseTaskKg);

  // 按总重量匹配阶梯（从高到低）
  let matchedTier: AirWeightTier | null = null;
  for (let i = config.tiers.length - 1; i >= 0; i--) {
    if (totalWeightKg <= config.tiers[i].maxKg) {
      matchedTier = config.tiers[i];
    }
  }
  // 如果超过最高阶梯，使用最高阶梯
  if (!matchedTier) {
    matchedTier = config.tiers[config.tiers.length - 1];
  }

  const totalCommission = round2(excessWeight * matchedTier.pricePerKg);

  return {
    planType: 'PLAN_D_NIGERIA_AIR',
    qualified: true,
    totalWeightKg,
    excessWeight,
    matchedLevel: matchedTier.level,
    unitPrice: matchedTier.pricePerKg,
    totalCommission,
    currency: 'NGN',
  };
}

// ========== 彩蛋奖金 ==========

/**
 * 彩蛋奖金计算：团队重量目标奖励
 * 团队总重量≥40吨触发，个人≥2000kg参与，合格人数≥2
 */
export function calcEasterEggBonus(
  teamPerformances: MonthlyPerformance[],
  config: EasterEggBonusConfig,
): EasterEggBonusResult {
  const teamTotalWeight = round2(
    teamPerformances.reduce((sum, p) => sum + p.totalWeightKg, 0)
  );

  // 未达触发重量
  if (teamTotalWeight < config.triggerWeightKg) {
    return {
      triggered: false,
      teamTotalWeight,
      qualifiedMembers: [],
      invalidReason: `团队总重量 ${teamTotalWeight}kg 未达 ${config.triggerWeightKg}kg 触发标准`,
    };
  }

  // 筛选合格成员
  const qualifiedPerformances = teamPerformances.filter(
    p => p.totalWeightKg >= config.minPersonalWeightKg
  );

  // 合格人数不足
  if (qualifiedPerformances.length < config.minQualifiedCount) {
    return {
      triggered: false,
      teamTotalWeight,
      qualifiedMembers: [],
      invalidReason: `达标人数 ${qualifiedPerformances.length} 人，不足 ${config.minQualifiedCount} 人最低要求`,
    };
  }

  // 按比例分配
  const qualifiedTotalWeight = qualifiedPerformances.reduce(
    (sum, p) => sum + p.totalWeightKg, 0
  );

  const qualifiedMembers: EasterEggMemberAllocation[] = qualifiedPerformances.map(p => {
    const ratio = round2(p.totalWeightKg / qualifiedTotalWeight);
    return {
      employeeId: p.employeeId,
      weight: p.totalWeightKg,
      ratio,
      bonus: round2(config.bonusAmount * ratio),
    };
  });

  return {
    triggered: true,
    teamTotalWeight,
    qualifiedMembers,
    invalidReason: null,
  };
}

// ========== 应收款校验 ==========

/** Mock JOB 数据（用于应收款过滤） */
export interface MonthlyJobItem {
  jobNo: string;
  type: 'AIR' | 'SEA';
  tickets: number;
  grossProfit: number;
  volumeCBM: number;
  weightKg: number;
  receivableCollected: boolean;
  badDebtAmount: number;
}

/**
 * 应收款过滤：排除未全部回收的订单
 */
export function filterByReceivableStatus(
  jobs: MonthlyJobItem[],
): { validJobs: MonthlyJobItem[]; excludedCount: number; excludedAmount: number } {
  const validJobs = jobs.filter(j => j.receivableCollected);
  const excludedJobs = jobs.filter(j => !j.receivableCollected);

  return {
    validJobs,
    excludedCount: excludedJobs.length,
    excludedAmount: round2(excludedJobs.reduce((sum, j) => sum + j.grossProfit, 0)),
  };
}

/**
 * 从 JOB 列表聚合为月度业绩
 */
export function aggregateMonthlyData(
  employeeId: string,
  month: string,
  jobs: MonthlyJobItem[],
): MonthlyPerformance {
  const { validJobs, excludedCount } = filterByReceivableStatus(jobs);

  return {
    employeeId,
    month,
    totalTickets: validJobs.reduce((sum, j) => sum + j.tickets, 0),
    totalGrossProfit: round2(validJobs.reduce((sum, j) => sum + j.grossProfit, 0)),
    totalVolumeCBM: round2(validJobs.reduce((sum, j) => sum + j.volumeCBM, 0)),
    totalWeightKg: round2(validJobs.reduce((sum, j) => sum + j.weightKg, 0)),
    seaGrossProfit: round2(validJobs.filter(j => j.type === 'SEA').reduce((sum, j) => sum + j.grossProfit, 0)),
    airGrossProfit: round2(validJobs.filter(j => j.type === 'AIR').reduce((sum, j) => sum + j.grossProfit, 0)),
    excludedOrders: excludedCount,
    receivableStatus: excludedCount === 0 ? 'ALL_COLLECTED' : 'PARTIAL',
  };
}

// ========== 坏账扣减 ==========

/**
 * 坏账扣减：从奖金扣除，不足则递延
 */
export function applyBadDebtDeduction(
  commissionAmount: number,
  badDebtAmount: number,
  previousDeferred: number,
): BadDebtDeductionResult {
  const totalDeduction = round2(badDebtAmount + previousDeferred);

  if (commissionAmount >= totalDeduction) {
    return {
      originalAmount: commissionAmount,
      badDebtAmount,
      deferredAmount: 0,
      finalAmount: round2(commissionAmount - totalDeduction),
    };
  }

  return {
    originalAmount: commissionAmount,
    badDebtAmount,
    deferredAmount: round2(totalDeduction - commissionAmount),
    finalAmount: 0,
  };
}

// ========== 绩效追踪 ==========

/**
 * 绩效追踪：连续达标/未达标判定
 */
export function trackPerformance(
  monthlyResults: Array<{ month: string; qualified: boolean }>,
): PerformanceTrackResult {
  if (monthlyResults.length === 0) {
    return { consecutiveQualified: 0, consecutiveUnqualified: 0, suggestion: null };
  }

  // 按月份倒序排列
  const sorted = [...monthlyResults].sort((a, b) => b.month.localeCompare(a.month));

  let consecutiveQualified = 0;
  let consecutiveUnqualified = 0;

  // 从最近月份开始计数
  if (sorted[0].qualified) {
    for (const r of sorted) {
      if (r.qualified) consecutiveQualified++;
      else break;
    }
  } else {
    for (const r of sorted) {
      if (!r.qualified) consecutiveUnqualified++;
      else break;
    }
  }

  let suggestion: PerformanceSuggestion = null;
  if (consecutiveQualified >= 3) suggestion = 'RAISE';
  else if (consecutiveUnqualified >= 5) suggestion = 'DISMISS';
  else if (consecutiveUnqualified >= 3) suggestion = 'CUT';

  return { consecutiveQualified, consecutiveUnqualified, suggestion };
}

/** 绩效建议中文标签 */
export const PERFORMANCE_SUGGESTION_LABELS: Record<Exclude<PerformanceSuggestion, null>, { text: string; color: string }> = {
  RAISE: { text: '连续达标3月-建议加薪', color: 'gold' },
  CUT: { text: '连续未达标3月-建议减薪', color: 'red' },
  DISMISS: { text: '连续未达5月-建议辞退', color: '#cf1322' },
};
