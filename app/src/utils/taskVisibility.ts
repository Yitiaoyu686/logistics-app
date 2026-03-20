const ORIGIN_UNSHIPPED_JOB_STATUS_SET = new Set([
  'PLANNED',
  'IN_PROGRESS',
])

const DEST_SHIPPED_UNIT_STATUS_SET = new Set([
  'SEALED',
  'SHIPPED',
  'IN_TRANSIT',
  'ARRIVED',
])

export const isOriginWarehouseVisibleJob = (status?: string | null) => {
  if (!status) return true
  return ORIGIN_UNSHIPPED_JOB_STATUS_SET.has(status)
}

export const isDestWarehouseVisibleUnit = (status?: string | null) => {
  if (!status) return false
  return DEST_SHIPPED_UNIT_STATUS_SET.has(status)
}
