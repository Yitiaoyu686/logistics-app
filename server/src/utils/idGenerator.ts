const counters: Record<string, number> = {};

function nextSeq(prefix: string, digits: number = 5): string {
  counters[prefix] = (counters[prefix] || 0) + 1;
  return String(counters[prefix]).padStart(digits, '0');
}

function dateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export function generateOrderNo(businessLine: 'SEA' | 'AIR'): string {
  const prefix = businessLine === 'SEA' ? 'S' : 'A';
  return `${prefix}-${dateStr()}${nextSeq('order')}`;
}

export function generateSubOrderNo(masterOrderNo: string, lineNo: number): string {
  return `${masterOrderNo}-${String(lineNo).padStart(2, '0')}`;
}

export function generateJobNo(businessLine: 'SEA' | 'AIR'): string {
  const prefix = businessLine === 'SEA' ? 'S-JOB' : 'A-JOB';
  return `${prefix}${dateStr().substring(2)}${nextSeq('job')}`;
}

export function generateDpnNo(): string {
  return `DPN-${dateStr()}-${nextSeq('dpn', 4)}`;
}

export function generateTransferNo(businessLine: 'SEA' | 'AIR'): string {
  const prefix = businessLine === 'SEA' ? 'S-T' : 'A-T';
  return `${prefix}-${dateStr()}-${nextSeq('transfer', 4)}`;
}

export function generatePickupNo(): string {
  return `P-${dateStr()}-${nextSeq('pickup', 4)}`;
}

export function generateInboundNo(): string {
  return `IB-${dateStr()}-${nextSeq('inbound', 4)}`;
}

export function generateFeeNo(businessLine: 'SEA' | 'AIR'): string {
  const prefix = businessLine === 'SEA' ? 'F-S' : 'F-A';
  return `${prefix}-${dateStr()}-${nextSeq('fee', 4)}`;
}

export function uuid(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}
