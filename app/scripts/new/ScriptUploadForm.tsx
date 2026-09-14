"use client";

import { useActionState } from "react";
import { uploadScriptAction } from "@/lib/script-upload-actions";
import { INITIAL_PROFILE_STATE } from "@/lib/profile-action-state";
import { SCRIPT_TYPE_LABELS } from "@/lib/types";

const inputClasses =
  "mt-1.5 w-full rounded-lg border border-black/[.12] bg-white px-4 py-2 text-sm outline-none focus:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900";

export function ScriptUploadForm() {
  const [state, formAction, isPending] = useActionState(
    uploadScriptAction,
    INITIAL_PROFILE_STATE,
  );

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <div>
        <label htmlFor="scriptFile" className="block text-sm font-medium">
          Script JSON file
        </label>
        <input
          id="scriptFile"
          name="scriptFile"
          type="file"
          accept="application/json,.json"
          className="mt-1.5 block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-foreground file:px-4 file:py-2 file:text-sm file:font-medium file:text-background hover:file:bg-[#383838] dark:hover:file:bg-[#ccc]"
        />
      </div>

      <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
        <div className="h-px flex-1 bg-black/[.08] dark:bg-white/[.145]" />
        or paste it directly
        <div className="h-px flex-1 bg-black/[.08] dark:bg-white/[.145]" />
      </div>

      <div>
        <label htmlFor="scriptJson" className="block text-sm font-medium">
          Script JSON
        </label>
        <textarea
          id="scriptJson"
          name="scriptJson"
          rows={8}
          placeholder='[{"id": "_meta", "name": "My Script"}, "washerwoman", "imp", ...]'
          className={`${inputClasses} font-mono text-xs`}
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          If you choose a file above, this is ignored. Capped at 200KB.
        </p>
      </div>

      <div>
        <label htmlFor="scriptType" className="block text-sm font-medium">
          Script type
        </label>
        <select
          id="scriptType"
          name="scriptType"
          defaultValue="full"
          className={inputClasses}
        >
          {Object.entries(SCRIPT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium">
          Description{" "}
          <span className="font-normal text-zinc-500 dark:text-zinc-400">
            (optional)
          </span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          maxLength={500}
          placeholder="A short blurb shown near the title."
          className={inputClasses}
        />
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium">
          Notes{" "}
          <span className="font-normal text-zinc-500 dark:text-zinc-400">
            (optional)
          </span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          maxLength={2000}
          placeholder="Anything that doesn't fit in a single character's ability — Bootlegger rules, Fabled/Loric reminders, house rules, etc. Shown at the top of the character list."
          className={inputClasses}
        />
      </div>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {isPending ? "Uploading…" : "Upload script"}
      </button>
    </form>
  );
}
