// Split out for the same reason as lib/profile-action-state.ts and
// lib/auth-action-state.ts: a "use server" file may only export async
// functions, so the shared result shape + initial state for
// bulkUploadScriptsAction's useActionState() (see
// lib/script-upload-actions.ts) lives in its own plain module instead.

export interface BulkUploadFileResult {
  filename: string;
  ok: boolean;
  /** Set when ok is true. */
  scriptId?: string;
  scriptName?: string;
  /** Set when ok is false and the reason was "already in the library",
   * not a real failure — lets the UI show it in a neutral tone instead of
   * red. */
  skippedDuplicate?: boolean;
  error?: string;
}

export interface BulkUploadState {
  error: string | null;
  results: BulkUploadFileResult[] | null;
}

export const INITIAL_BULK_UPLOAD_STATE: BulkUploadState = {
  error: null,
  results: null,
};
