// Split out for the same reason as lib/auth-action-state.ts: a "use
// server" file may only export async functions, so the shared initial
// state for useActionState() lives in its own plain module.
export interface ProfileActionState {
  error: string | null;
}

export const INITIAL_PROFILE_STATE: ProfileActionState = { error: null };
