import React from 'react';
import { LegacyTaskManager } from './LegacyTaskManager';

interface DestJobManagerProps {
  businessMode?: 'ALL' | 'AIR' | 'SEA';
}

export const DestJobManager: React.FC<DestJobManagerProps> = ({ businessMode = 'ALL' }) => {
  return <LegacyTaskManager mode="DEST" businessMode={businessMode} />;
};
