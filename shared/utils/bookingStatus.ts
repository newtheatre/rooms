/**
 * What a series-wide action covers, shared so the admin preview and the write
 * cannot disagree. Statuses: docs/data-model.md#status-lifecycle
 */

/** Still holding a slot, so a series-wide change applies to it. */
export function isOpenStatus(
  status: 'PENDING' | 'CONFIRMED' | 'AWAITING_EXTERNAL' | 'REJECTED' | 'CANCELLED'
): boolean {
  return status !== 'REJECTED' && status !== 'CANCELLED'
}
