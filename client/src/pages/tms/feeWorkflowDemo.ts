export type UiFeeStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'CANCELLED';
export type ChangeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ChangeType = 'ADD' | 'UPDATE' | 'REMOVE';

export interface ChangeFeeItem {
  id: string;
  feeType: string;
  changeType: ChangeType;
  currency: string;
  feeDirection?: 'PAYABLE' | 'RECEIVABLE';
  originalAmount?: number;
  newAmount?: number;
  remark?: string;
}

export interface FeeChangeRequest {
  id: string;
  feeId: string;
  feeNo: string;
  reason: string;
  items: ChangeFeeItem[];
  status: ChangeRequestStatus;
  createdAt: string;
  applicant: string;
  reviewedAt?: string;
  reviewer?: string;
  reviewComment?: string;
}

export interface FeeWorkflowState {
  draftOverrides: Record<string, boolean>;
  changeRequests: Record<string, FeeChangeRequest>;
  deletedFeeIds: Record<string, boolean>;
}

const STORAGE_KEY = 'tms_fee_workflow_demo_v1';

const EMPTY_STATE: FeeWorkflowState = {
  draftOverrides: {},
  changeRequests: {},
  deletedFeeIds: {},
};

export const UI_STATUS_CONFIG: Record<UiFeeStatus, { text: string; color: string }> = {
  DRAFT: { text: '草稿', color: 'default' },
  PENDING: { text: '待审核', color: 'warning' },
  APPROVED: { text: '已审核', color: 'success' },
  REJECTED: { text: '已驳回', color: 'error' },
  PAID: { text: '已支付', color: 'processing' },
  CANCELLED: { text: '已作废', color: 'default' },
};

export const CHANGE_REQUEST_STATUS_CONFIG: Record<
  ChangeRequestStatus,
  { text: string; color: string }
> = {
  PENDING: { text: '更改待审', color: 'processing' },
  APPROVED: { text: '更改已批', color: 'success' },
  REJECTED: { text: '更改驳回', color: 'error' },
  CANCELLED: { text: '更改撤销', color: 'default' },
};

export const loadFeeWorkflowState = (): FeeWorkflowState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...EMPTY_STATE };
    }
    const parsed = JSON.parse(raw) as Partial<FeeWorkflowState>;
    return {
      draftOverrides: parsed.draftOverrides || {},
      changeRequests: parsed.changeRequests || {},
      deletedFeeIds: parsed.deletedFeeIds || {},
    };
  } catch {
    return { ...EMPTY_STATE };
  }
};

export const persistFeeWorkflowState = (state: FeeWorkflowState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const cloneWorkflowState = (state: FeeWorkflowState): FeeWorkflowState => ({
  draftOverrides: { ...state.draftOverrides },
  changeRequests: { ...state.changeRequests },
  deletedFeeIds: { ...state.deletedFeeIds },
});

export const getUiFeeStatus = (
  backendStatus: string,
  feeId: string,
  workflowState: FeeWorkflowState
): UiFeeStatus => {
  if (workflowState.deletedFeeIds[feeId]) {
    return 'CANCELLED';
  }

  if (workflowState.draftOverrides[feeId]) {
    return 'DRAFT';
  }

  if (backendStatus === 'APPROVED') return 'APPROVED';
  if (backendStatus === 'REJECTED') return 'REJECTED';
  if (backendStatus === 'PAID') return 'PAID';
  if (backendStatus === 'CANCELLED') return 'CANCELLED';
  return 'PENDING';
};

export const createChangeRequest = (
  state: FeeWorkflowState,
  payload: { feeId: string; feeNo: string; reason: string; applicant: string; items: Omit<ChangeFeeItem, 'id'>[] }
): FeeWorkflowState => {
  const next = cloneWorkflowState(state);
  next.changeRequests[payload.feeId] = {
    id: `CR-${Date.now()}-${payload.feeId}`,
    feeId: payload.feeId,
    feeNo: payload.feeNo,
    reason: payload.reason,
    items: payload.items.map((item, idx) => ({
      ...item,
      id: `CRI-${Date.now()}-${idx + 1}`,
    })),
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    applicant: payload.applicant,
  };
  return next;
};

export const reviewChangeRequest = (
  state: FeeWorkflowState,
  payload: { feeId: string; status: Exclude<ChangeRequestStatus, 'PENDING'>; reviewer: string; reviewComment?: string }
): FeeWorkflowState => {
  const next = cloneWorkflowState(state);
  const current = next.changeRequests[payload.feeId];
  if (!current) {
    return state;
  }
  next.changeRequests[payload.feeId] = {
    ...current,
    status: payload.status,
    reviewer: payload.reviewer,
    reviewedAt: new Date().toISOString(),
    reviewComment: payload.reviewComment,
  };
  if (payload.status === 'APPROVED') {
    next.draftOverrides[payload.feeId] = true;
  }
  return next;
};
