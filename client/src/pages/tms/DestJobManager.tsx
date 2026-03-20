import React from 'react';
import { LegacyTaskManager } from './LegacyTaskManager';

interface DestJobManagerProps {
  businessMode?: 'ALL' | 'AIR' | 'SEA';
}

export const DestJobManager: React.FC<DestJobManagerProps> = () => {
  return <LegacyTaskManager mode="DEST" />;
};
