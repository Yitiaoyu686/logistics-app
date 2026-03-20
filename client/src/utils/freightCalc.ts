// ========== 运费计费逻辑工具库 ==========

// ========== 类型定义 ==========

/** 货物品类 */
export type CargoCategory =
  | 'NORMAL'        // 普货
  | 'ELECTRONIC'    // 带电产品
  | 'MAGNETIC'      // 带磁产品
  | 'FOOD'          // 食品
  | 'COSMETIC'      // 化妆品
  | 'CHEMICAL'      // 化工品（非危险品）
  | 'MEDICINE'      // 药品
  | 'HEALTH'        // 保健品
  | 'MOBILE_PHONE'; // 手机

/** 品类附加费率映射 */
export type SurchargeRateMap = Record<Exclude<CargoCategory, 'NORMAL'>, number>;

/** 续重阶梯定义 */
export interface WeightTier {
  minWeight: number;         // 区间最小续重 (kg)
  maxWeight: number | null;  // 区间最大续重，null 表示无上限
  unitPrice: number;         // 该区间单价 (元/kg)
}

/** 空运计费配置 */
export interface AirFreightConfig {
  volumetricDivisor: number;         // 体积重除数，默认 6000
  firstWeightPrice: number;          // 首重单价 (元/kg)，默认 63
  continuationTiers: WeightTier[];   // 续重阶梯
  surchargeRates: SurchargeRateMap;  // 品类附加费率
  packagingSurchargePerKg: number;   // 木箱包装附加费单价 (元/kg)，默认 2
}

/** 海运拼箱计费配置 */
export interface SeaLCLConfig {
  volumeWeightRatio: number; // 1m³ = N kg，默认 700
  unitPricePerCBM: number;   // 每立方米单价
}

/** 文件寄送配置 */
export interface DocumentFeeConfig {
  prepaidCNY: number;    // 预付价格（人民币），默认 150
  collectUSD: number;    // 到付价格（美元），默认 21
  maxWeightKg: number;   // 限重（kg），默认 0.5
}

/** 计费重量结果 */
export interface ChargeableWeightResult {
  actualWeight: number;
  volumetricWeight: number | null;
  chargeableWeight: number;
  basis: 'ACTUAL' | 'VOLUMETRIC' | 'ACTUAL_ONLY';
}

/** 进位后重量结果 */
export interface RoundedWeightResult {
  originalWeight: number;
  roundedWeight: number;
  firstWeight: number;         // 首重 (1kg)
  continuationWeight: number;  // 续重
}

/** 空运运费计算明细 */
export interface AirFreightBreakdown {
  chargeableWeight: ChargeableWeightResult;
  roundedWeight: RoundedWeightResult;
  firstWeightFee: number;          // 首重费用
  continuationWeightFee: number;   // 续重费用
  continuationUnitPrice: number;   // 续重适用单价
  continuationTierIndex: number;   // 命中的阶梯索引
  baseFreight: number;             // 基础运费 = 首重 + 续重
  surchargeRate: number;           // 附加费率 (0 表示无)
  surchargeCategory: CargoCategory | null; // 适用的品类
  surchargeAmount: number;         // 附加费金额
  isMixedCargo: boolean;           // 是否混装
  packagingSurcharge: number;      // 包装附加费
  totalFreight: number;            // 总运费
}

/** 海运拼箱计费结果 */
export interface SeaLCLBreakdown {
  actualVolume: number;
  grossWeight: number;
  density: number;
  cargoType: 'LIGHT' | 'HEAVY';
  convertedVolume: number;
  chargeableVolume: number;
  unitPrice: number;
  totalFreight: number;
}

/** 文件寄送计费结果 */
export interface DocumentFeeResult {
  paymentType: 'PREPAID' | 'COLLECT';
  amount: number;
  currency: 'CNY' | 'USD';
  overweight: boolean;
}

// ========== 品类中文名映射 ==========

export const CARGO_CATEGORY_LABELS: Record<CargoCategory, string> = {
  NORMAL: '普货',
  ELECTRONIC: '带电产品',
  MAGNETIC: '带磁产品',
  FOOD: '食品',
  COSMETIC: '化妆品',
  CHEMICAL: '化工品',
  MEDICINE: '药品',
  HEALTH: '保健品',
  MOBILE_PHONE: '手机',
};

// ========== 默认配置常量 ==========

export const DEFAULT_AIR_CONFIG: AirFreightConfig = {
  volumetricDivisor: 6000,
  firstWeightPrice: 63,
  continuationTiers: [
    { minWeight: 1, maxWeight: 5, unitPrice: 60 },
    { minWeight: 5, maxWeight: 20, unitPrice: 57 },
    { minWeight: 20, maxWeight: null, unitPrice: 55 },
  ],
  surchargeRates: {
    ELECTRONIC: 0.10,
    MAGNETIC: 0.10,
    FOOD: 0.10,
    COSMETIC: 0.10,
    CHEMICAL: 0.25,
    MEDICINE: 0.40,
    HEALTH: 0.40,
    MOBILE_PHONE: 0.60,
  },
  packagingSurchargePerKg: 2,
};

export const DEFAULT_SEA_LCL_CONFIG: SeaLCLConfig = {
  volumeWeightRatio: 700,
  unitPricePerCBM: 1800,
};

export const DEFAULT_DOC_CONFIG: DocumentFeeConfig = {
  prepaidCNY: 150,
  collectUSD: 21,
  maxWeightKg: 0.5,
};

// ========== 计算函数 ==========

/** 保留2位小数 */
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * 空运计费重量判定 (R1)
 * 比较实际毛重和体积重量，取较大值
 */
export function calcChargeableWeight(
  actualWeightKg: number,
  lengthCm: number | null,
  widthCm: number | null,
  heightCm: number | null,
  divisor: number = 6000,
): ChargeableWeightResult {
  // 任一尺寸缺失 → 仅按实际重量
  if (lengthCm == null || widthCm == null || heightCm == null
    || lengthCm <= 0 || widthCm <= 0 || heightCm <= 0) {
    return {
      actualWeight: actualWeightKg,
      volumetricWeight: null,
      chargeableWeight: actualWeightKg,
      basis: 'ACTUAL_ONLY',
    };
  }

  const volumetricWeight = round2((lengthCm * widthCm * heightCm) / divisor);
  const chargeableWeight = Math.max(actualWeightKg, volumetricWeight);

  return {
    actualWeight: actualWeightKg,
    volumetricWeight,
    chargeableWeight,
    basis: chargeableWeight === volumetricWeight && volumetricWeight !== actualWeightKg
      ? 'VOLUMETRIC'
      : 'ACTUAL',
  };
}

/**
 * 重量进位规则 (R2)
 * 首重：1kg（整公斤进位）
 * 续重：不足0.5按0.5计，超0.5不足1按1计
 */
export function roundWeight(weightKg: number): RoundedWeightResult {
  if (weightKg <= 0) {
    return { originalWeight: weightKg, roundedWeight: 0, firstWeight: 0, continuationWeight: 0 };
  }

  const firstWeight = 1; // 首重固定1kg

  if (weightKg <= 1) {
    return {
      originalWeight: weightKg,
      roundedWeight: 1,
      firstWeight: 1,
      continuationWeight: 0,
    };
  }

  // 续重部分进位：Math.ceil(w * 2) / 2 实现0.5进位
  const rawContinuation = weightKg - firstWeight;
  const roundedContinuation = Math.ceil(rawContinuation * 2) / 2;

  return {
    originalWeight: weightKg,
    roundedWeight: round2(firstWeight + roundedContinuation),
    firstWeight,
    continuationWeight: roundedContinuation,
  };
}

/**
 * 解析混装最高附加费率 (R6)
 * 多品类取最高附加费率，仅含普货时返回0
 */
export function resolveMixedCargoRate(
  categories: CargoCategory[],
  surchargeRates: SurchargeRateMap,
): { rate: number; category: CargoCategory | null; isMixed: boolean } {
  // 过滤掉普货
  const nonNormal = categories.filter(c => c !== 'NORMAL');

  if (nonNormal.length === 0) {
    return { rate: 0, category: null, isMixed: false };
  }

  // 判断是否混装：含普货和非普货，或含多种非普货
  const isMixed = categories.length > 1;

  // 找最高附加费率
  let maxRate = 0;
  let maxCategory: CargoCategory | null = null;
  for (const cat of nonNormal) {
    const rate = surchargeRates[cat as Exclude<CargoCategory, 'NORMAL'>] ?? 0;
    if (rate > maxRate) {
      maxRate = rate;
      maxCategory = cat;
    }
  }

  return { rate: maxRate, category: maxCategory, isMixed };
}

/**
 * 完整空运运费计算 (R1-R6)
 */
export function calcAirFreight(
  actualWeightKg: number,
  lengthCm: number | null,
  widthCm: number | null,
  heightCm: number | null,
  categories: CargoCategory[],
  hasWoodenBox: boolean,
  config: AirFreightConfig,
): AirFreightBreakdown {
  // Step 1: 计费重量判定
  const chargeableWeight = calcChargeableWeight(
    actualWeightKg, lengthCm, widthCm, heightCm, config.volumetricDivisor,
  );

  // Step 2: 进位
  const roundedWeight = roundWeight(chargeableWeight.chargeableWeight);

  // Step 3: 首重续重阶梯
  const firstWeightFee = round2(roundedWeight.firstWeight * config.firstWeightPrice);

  // 续重阶梯匹配：按续重总量找到最后一个 minWeight ≤ 续重的区间
  let continuationUnitPrice = 0;
  let continuationTierIndex = -1;
  const cw = roundedWeight.continuationWeight;

  if (cw > 0 && config.continuationTiers.length > 0) {
    for (let i = config.continuationTiers.length - 1; i >= 0; i--) {
      if (cw >= config.continuationTiers[i].minWeight) {
        continuationUnitPrice = config.continuationTiers[i].unitPrice;
        continuationTierIndex = i;
        break;
      }
    }
    // 如果续重不足最低阶梯，使用第一个阶梯
    if (continuationTierIndex === -1) {
      continuationUnitPrice = config.continuationTiers[0].unitPrice;
      continuationTierIndex = 0;
    }
  }

  const continuationWeightFee = round2(cw * continuationUnitPrice);
  const baseFreight = round2(firstWeightFee + continuationWeightFee);

  // Step 4: 附加费（基于基础运费）
  const { rate: surchargeRate, category: surchargeCategory, isMixed: isMixedCargo } =
    resolveMixedCargoRate(categories, config.surchargeRates);
  const surchargeAmount = round2(baseFreight * surchargeRate);

  // Step 5: 包装附加费（基于计费重量，独立于品类附加费）
  const packagingSurcharge = hasWoodenBox
    ? round2(roundedWeight.roundedWeight * config.packagingSurchargePerKg)
    : 0;

  // Step 6: 总运费
  const totalFreight = round2(baseFreight + surchargeAmount + packagingSurcharge);

  return {
    chargeableWeight,
    roundedWeight,
    firstWeightFee,
    continuationWeightFee,
    continuationUnitPrice,
    continuationTierIndex,
    baseFreight,
    surchargeRate,
    surchargeCategory,
    surchargeAmount,
    isMixedCargo,
    packagingSurcharge,
    totalFreight,
  };
}

/**
 * 海运拼箱计费体积和运费 (R7)
 */
export function calcSeaLCLFreight(
  actualVolumeCBM: number,
  grossWeightKg: number,
  config: SeaLCLConfig,
): SeaLCLBreakdown {
  const density = round2(grossWeightKg / actualVolumeCBM);
  const cargoType: 'LIGHT' | 'HEAVY' = density <= config.volumeWeightRatio ? 'LIGHT' : 'HEAVY';
  const convertedVolume = round2(grossWeightKg / config.volumeWeightRatio);
  const chargeableVolume = round2(Math.max(actualVolumeCBM, convertedVolume));
  const totalFreight = round2(chargeableVolume * config.unitPricePerCBM);

  return {
    actualVolume: actualVolumeCBM,
    grossWeight: grossWeightKg,
    density,
    cargoType,
    convertedVolume,
    chargeableVolume,
    unitPrice: config.unitPricePerCBM,
    totalFreight,
  };
}

/**
 * 文件寄送费用 (R10)
 */
export function calcDocumentFee(
  weightKg: number,
  paymentType: 'PREPAID' | 'COLLECT',
  config: DocumentFeeConfig,
): DocumentFeeResult {
  const overweight = weightKg > config.maxWeightKg;

  if (paymentType === 'PREPAID') {
    return { paymentType, amount: config.prepaidCNY, currency: 'CNY', overweight };
  }
  return { paymentType, amount: config.collectUSD, currency: 'USD', overweight };
}
