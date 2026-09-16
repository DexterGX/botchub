"use client";

import { useActionState, useState } from "react";
import { setDisplayNameAction } from "@/lib/profile-actions";
import { INITIAL_PROFILE_STATE } from "@/lib/profile-action-state";

const inputClasses =
  "mt-1.5 w-full rounded-full border border-black/[.12] bg-white px-4 py-2 text-sm outline-none focus:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900";

interface DisplayNameFormProps {
  currentDisplayName: string;
}

/**
 * Renaming goes through the set_display_name() call, same as onboarding.
 * There used to also be a "reroll" button here (resubmitting the current
 * name to get a new random #tag) — removed per Diego's ask, since giving
 * visitors an easy way to change their tag whenever they liked meant
 * people could hop tags often enough to make the tag a poor way to tell
 * two accounts apart.
 */
export function DisplayNameForm({
  currentDisplayName,
}: DisplayNameFormProps) {
  const [state, formAction, isPending] = useActionState(
    setDisplayNameAction,
    INITIAL_PROFILE_STATE
  );
  const [value, setValue] = useState(currentDisplayName);
  const hasChanged = value.trim() !== currentDisplayName && value.trim().length > 0;

  return (
    <div className="mt-6">
      <label htmlFor="displayName" className="block text-sm font-medium">
        Display name
      </label>
      <form action={formAction} className="mt-1.5 flex gap-2">
        <input
          id="displayName"
          name="displayName"
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          minLength={2}
          maxLength={32}
          className={`${inputClasses} mt-0 flex-1`}
        />
        {hasChanged && (
          <button
            type="submit"
            disabled={isPending}
            className="shrink-0 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
          >
            {isPending ? "Saving…" : "Save"}
          </button>
        )}
      </form>

      {state.error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
    </div>
  );
}
