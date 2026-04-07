// Convert old-format container numbers (AK1, BK2) to real container number format
// Sea freight: same prefix = same container (AK1,AK2,AK3 all become CSLU2185436)
const PREFIX_TO_CONTAINER: Record<string, string> = {
  'AK': 'CSLU2185436', 'BK': 'MSKU7834521', 'CK': 'CMAU4567890',
  'DK': 'OOLU3456789', 'EK': 'EGLV5678901', 'FK': 'HLXU6789012',
  'GK': 'MSCU8901234', 'HK': 'TCLU9012345', 'IK': 'APLU0123456',
  'JK': 'TRLU1234567', 'KK': 'BMOU2345678', 'LK': 'FCIU3456789',
  'MK': 'GESU4567890', 'NK': 'SEGU5678901',
};

export function toRealContainerNo(unitNo: string): string {
  const s = String(unitNo || '').trim();
  // Already real format (4 letters + 7 digits)
  if (/^[A-Z]{4}\d{7}$/.test(s)) return s;
  // Convert old format: same prefix maps to same container number
  const match = s.match(/^([A-Z]+)\d*$/);
  if (match) {
    return PREFIX_TO_CONTAINER[match[1]] || s;
  }
  return s;
}
