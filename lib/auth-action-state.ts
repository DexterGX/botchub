// Kept out of lib/auth-actions.ts on purpose: a "use server" file may only
// export async functions, so the shared initial state for useActionState()
// has to live in its own plain module.
export interface AuthActionState {
  error: string | null;
}

export const INITIAL_AUTH_STATE: AuthActionState = { error: null };
