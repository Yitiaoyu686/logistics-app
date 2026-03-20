import React from 'react';
import { Segmented } from 'antd';
import type { BusinessMode, BusinessModeWithAll } from '../hooks/useBusinessMode';

interface BusinessModeSwitcherProps {
  mode: BusinessMode | BusinessModeWithAll;
  options: readonly { label: string; value: string }[];
  onChange: (value: any) => void;
  style?: React.CSSProperties;
}

/** 页面顶部的空运/海运(或全部/空运/海运)切换器 */
export const BusinessModeSwitcher: React.FC<BusinessModeSwitcherProps> = ({
  mode, options, onChange, style
}) => {
  return (
    <div style={{ marginBottom: 16, ...style }}>
      <Segmented
        value={mode}
        options={options as any}
        onChange={onChange}
        size="large"
      />
    </div>
  );
};
