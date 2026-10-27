// Never render raw backend errors: database diagnostics can contain private data.
export function notificationStorageError(status: number, code?: unknown): string {
  if (status === 401) return 'Your Admin session expired. Sign in again, then reload.';
  if (status === 403) return 'This session is not authorized for notification administration. Use the approved Admin account.';
  if (code === 'SMART_SCHEMA_NOT_ACTIVATED') return 'Smart notification storage is not activated. The operator must verify the smart-notification migration and approve SMART_NOTIFICATIONS_SCHEMA_READY. Horoscope reminder activation is separate. Delivery remains disabled.';
  if (code === 'SMART_CATEGORY_NOT_INSTALLED') return 'This category policy is not installed. The operator must install a reviewed, disabled category policy before saving drafts. Do not enable delivery.';
  if (status === 400) return 'Check the category, language, editorial text and future expiry (within 31 days). Content must match the selected language.';
  if (status === 409) return 'The saved revision changed or the transition is not allowed. Reload and review the latest record before retrying.';
  return 'Notification storage could not be verified. Check backend availability and the reviewed schema rollout. Reload before retrying a write; it may already have completed. No delivery was enabled.';
}

export async function readNotificationResponse<T>(response: Response): Promise<T> {
  let result: { success?: boolean; data?: T; code?: unknown; message?: unknown };
  try { result = await response.json(); }
  catch { throw new Error(notificationStorageError(response.status)); }
  // Exact legacy messages only, for already-running backends that predate codes.
  // Do not display or substring-match arbitrary exception messages.
  const code = result.code ?? (result.message === 'Smart notification schema is not activated'
    ? 'SMART_SCHEMA_NOT_ACTIVATED' : result.message === 'Category policy has not been installed'
      ? 'SMART_CATEGORY_NOT_INSTALLED' : undefined);
  if (!response.ok || result.success !== true) throw new Error(notificationStorageError(response.status, code));
  return result.data as T;
}
