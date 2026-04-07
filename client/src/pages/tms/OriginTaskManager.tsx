import React from 'react';
import { LegacyTaskManager } from './LegacyTaskManager';

interface OriginTaskManagerProps {
  businessMode?: 'ALL' | 'AIR' | 'SEA';
}

export const OriginTaskManager: React.FC<OriginTaskManagerProps> = ({ businessMode = 'ALL' }) => {
  return <LegacyTaskManager mode="ORIGIN" businessMode={businessMode} />;
};
