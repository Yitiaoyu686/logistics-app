import { useState } from 'react';

export type BusinessMode = 'AIR' | 'SEA';
export type BusinessModeWithAll = 'ALL' | 'AIR' | 'SEA';

/** 用于订单/仓储/办公等页面的空运/海运切换 */
export function useBusinessMode(defaultMode: BusinessMode = 'AIR') {
  const [mode, setMode] = useState<BusinessMode>(defaultMode);
  const options = [
    { label: '空运', value: 'AIR' as const },
    { label: '海运', value: 'SEA' as const },
  ];
  return { mode, setMode, options } as const;
}

/** 用于财务/经营分析页面的全部/空运/海运切换 */
export function useBusinessModeWithAll(defaultMode: BusinessModeWithAll = 'ALL') {
  const [mode, setMode] = useState<BusinessModeWithAll>(defaultMode);
  const options = [
    { label: '全部', value: 'ALL' as const },
    { label: '空运', value: 'AIR' as const },
    { label: '海运', value: 'SEA' as const },
  ];
  return { mode, setMode, options } as const;
}
