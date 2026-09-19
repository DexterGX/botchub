// Split out for the same reason as lib/game-action-state.ts: a "use server"
// file may only export async functions, so the shared initial state for
// useActionState() lives in its own plain module.
export interface GroupActionState {
  error: string | null;
}

export const INITIAL_GROUP_STATE: GroupActionState = { error: null };
