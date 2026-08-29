import { useEffect } from 'react';
import { installDataQualityListeners } from '@/lib/dataQuality';

export function DataQualityRecorder() {
  useEffect(() => installDataQualityListeners(), []);
  return null;
}
