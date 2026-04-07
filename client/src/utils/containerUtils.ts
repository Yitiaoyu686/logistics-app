// Convert old-format container numbers (AK1, BK2) to real container number format (CSLU0000001)
const OWNER_CODE_MAP: Record<string, string> = {
  'AK': 'CSLU', 'BK': 'MSKU', 'CK': 'CMAU', 'DK': 'OOLU', 'EK': 'EGLV',
  'FK': 'HLXU', 'GK': 'MSCU', 'HK': 'TCLU', 'IK': 'APLU', 'JK': 'TRLU',
  'KK': 'BMOU', 'LK': 'FCIU', 'MK': 'GESU', 'NK': 'SEGU',
};

export function toRealContainerNo(unitNo: string): string {
  const s = String(unitNo || '').trim();
  // Already real format (4 letters + 7 digits)
  if (/^[A-Z]{4}\d{7}$/.test(s)) return s;
  // Convert old format: prefix(letters) + number
  const match = s.match(/^([A-Z]+)(\d+)$/);
  if (match) {
    const ownerCode = OWNER_CODE_MAP[match[1]] || 'XXLU';
    const serial = match[2].padStart(7, '0');
    return ownerCode + serial;
  }
  return s;
}
