"use client";

import { useActionState, useState } from "react";
import { completeOnboardingAction } from "@/lib/profile-actions";
import { INITIAL_PROFILE_STATE } from "@/lib/profile-action-state";
import { COUNTRIES, US_STATES } from "@/lib/geo";

const inputClasses =
  "mt-1.5 w-full rounded-full border border-black/[.12] bg-white px-4 py-2 text-sm outline-none focus:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900";

interface OnboardingFormProps {
  defaultFullName: string;
  defaultBirthday: string;
  defaultCountry: string;
  defaultRegion: string;
}

/** Matches profile_private.referral_source's check constraint (see
 * supabase/migrations/20260917010000_profile_referral_source.sql). */
const REFERRAL_SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: "clocktower_con", label: "Clocktower Con" },
  { value: "discord", label: "Discord" },
  { value: "friends", label: "Friends" },
  { value: "other", label: "Other" },
];

export function OnboardingForm({
  defaultFullName,
  defaultBirthday,
  defaultCountry,
  defaultRegion,
}: OnboardingFormProps) {
  const [state, formAction, isPending] = useActionState(
    completeOnboardingAction,
    INITIAL_PROFILE_STATE
  );
  const [country, setCountry] = useState(defaultCountry);
  const [referralSource, setReferralSource] = useState("");

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <div>
        <label htmlFor="displayName" className="block text-sm font-medium">
          Display name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          required
          minLength={2}
          maxLength={32}
          placeholder="What should other players call you?"
          className={inputClasses}
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Doesn&apos;t have to be unique — you&apos;ll get a 4-digit tag
          (like <span className="font-mono">Storyteller#4821</span>) so
          people can tell accounts apart.
        </p>
      </div>

      <div>
        <label htmlFor="fullName" className="block text-sm font-medium">
          Name{" "}
          <span className="font-normal text-zinc-500 dark:text-zinc-400">
            (optional, private)
          </span>
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          defaultValue={defaultFullName}
          maxLength={100}
          className={inputClasses}
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Never shown publicly — only used later for finding you when
          logging games with people you know.
        </p>
      </div>

      <div>
        <label htmlFor="birthday" className="block text-sm font-medium">
          Birthday{" "}
          <span className="font-normal text-zinc-500 dark:text-zinc-400">
            (optional, private)
          </span>
        </label>
        <input
          id="birthday"
          name="birthday"
          type="date"
          defaultValue={defaultBirthday}
          className={inputClasses}
        />
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Never shown publicly — just so we can celebrate with you someday.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="country" className="block text-sm font-medium">
            Country{" "}
            <span className="font-normal text-zinc-500 dark:text-zinc-400">
              (optional)
            </span>
          </label>
          <select
            id="country"
            name="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className={inputClasses}
          >
            <option value="">—</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="region" className="block text-sm font-medium">
            State / Region{" "}
            <span className="font-normal text-zinc-500 dark:text-zinc-400">
              (optional)
            </span>
          </label>
          {country === "US" ? (
            <select
              id="region"
              name="region"
              defaultValue={defaultRegion}
              className={inputClasses}
            >
              <option value="">—</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="region"
              name="region"
              type="text"
              defaultValue={defaultRegion}
              maxLength={100}
              className={inputClasses}
            />
          )}
        </div>
      </div>

      <div>
        <label htmlFor="referralSource" className="block text-sm font-medium">
          How did you hear about BOTChub?{" "}
          <span className="font-normal text-zinc-500 dark:text-zinc-400">
            (optional)
          </span>
        </label>
        <select
          id="referralSource"
          name="referralSource"
          value={referralSource}
          onChange={(e) => setReferralSource(e.target.value)}
          className={inputClasses}
        >
          <option value="">—</option>
          {REFERRAL_SOURCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {referralSource === "other" && (
          <input
            id="referralSourceOther"
            name="referralSourceOther"
            type="text"
            maxLength={100}
            placeholder="Where, if you don't mind sharing"
            className={`${inputClasses} mt-2`}
          />
        )}
      </div>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {isPending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
