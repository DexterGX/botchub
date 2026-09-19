"use client";

import { useActionState, useEffect, useState, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createGroupAction } from "@/lib/group-actions";
import { INITIAL_GROUP_STATE } from "@/lib/group-action-state";
import {
  DEFAULT_GROUP_POINTS_CONFIG,
  type GroupVisibility,
} from "@/lib/types";
import { ToggleChip } from "@/app/games/components/ToggleChip";
import { SegmentedControl } from "@/app/games/components/SegmentedControl";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium">{label}</label>
      {hint && (
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">{hint}</p>
      )}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

const inputClasses =
  "w-full rounded-xl border border-black/[.12] bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900";

/** One points-distribution row (Wins / Losses / Storyteller) — a
 * ToggleChip to count it at all, plus its normal point value and a
 * separate "if there was a Storyteller mistake" value, per Diego's exact
 * spec ("box for if there was ST Mistake ... the Win Points would be +1
 * instead of +3"). */
function PointsRow({
  label,
  countName,
  counted,
  onCountedChange,
  pointsName,
  points,
  onPointsChange,
  mistakeName,
  mistakePoints,
  onMistakePointsChange,
  activeClassName,
}: {
  label: string;
  countName: string;
  counted: boolean;
  onCountedChange: (v: boolean) => void;
  pointsName: string;
  points: number;
  onPointsChange: (v: number) => void;
  mistakeName: string;
  mistakePoints: number;
  onMistakePointsChange: (v: number) => void;
  activeClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-black/[.08] p-4 dark:border-white/[.145]">
      <ToggleChip
        name={countName}
        label={label}
        checked={counted}
        onChange={onCountedChange}
        activeClassName={activeClassName}
      />

      {counted && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Points
            </span>
            <input
              type="number"
              name={pointsName}
              value={points}
              onChange={(e) => onPointsChange(Number(e.target.value))}
              className={`mt-1 ${inputClasses}`}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Points if a Storyteller mistake was noted
            </span>
            <input
              type="number"
              name={mistakeName}
              value={mistakePoints}
              onChange={(e) => onMistakePointsChange(Number(e.target.value))}
              className={`mt-1 ${inputClasses}`}
            />
          </label>
        </div>
      )}
      {!counted && (
        <>
          <input type="hidden" name={pointsName} value={points} />
          <input type="hidden" name={mistakeName} value={mistakePoints} />
        </>
      )}
    </div>
  );
}

export function CreateGroupForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    createGroupAction,
    INITIAL_GROUP_STATE,
  );

  const [hasPlaytime, setHasPlaytime] = useState(false);
  const [visibility, setVisibility] = useState<GroupVisibility>("private");
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);

  // Revoke the previous object URL whenever it's replaced or the form
  // unmounts — these aren't garbage-collected on their own and this form
  // is the only thing holding a reference to one.
  useEffect(() => {
    return () => {
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    };
  }, [coverPreviewUrl]);

  function handleCoverChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setCoverPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  const cfg = DEFAULT_GROUP_POINTS_CONFIG;
  const [countWins, setCountWins] = useState(cfg.countWins);
  const [winPoints, setWinPoints] = useState(cfg.winPoints);
  const [winPointsMistake, setWinPointsMistake] = useState(cfg.winPointsMistake);
  const [countLosses, setCountLosses] = useState(cfg.countLosses);
  const [lossPoints, setLossPoints] = useState(cfg.lossPoints);
  const [lossPointsMistake, setLossPointsMistake] = useState(cfg.lossPointsMistake);
  const [countStoryteller, setCountStoryteller] = useState(cfg.countStoryteller);
  const [storytellerPoints, setStorytellerPoints] = useState(cfg.storytellerPoints);
  const [storytellerPointsMistake, setStorytellerPointsMistake] = useState(
    cfg.storytellerPointsMistake,
  );

  return (
    <form action={formAction} className="space-y-6">
      <Field label="Group name">
        <input
          type="text"
          name="name"
          required
          maxLength={80}
          className={inputClasses}
          placeholder="e.g. Thursday Night Clocktower"
        />
      </Field>

      <Field label="Description" hint="Optional — shown on the group's page.">
        <textarea
          name="description"
          rows={3}
          className={inputClasses}
          placeholder="What's this group about?"
        />
      </Field>

      <Field
        label="Cover photo"
        hint="Optional — shown as the group's banner. JPG, PNG, or WebP, up to 5MB."
      >
        {coverPreviewUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not a remote image next/image can optimize
          <img
            src={coverPreviewUrl}
            alt=""
            className="mb-2 h-28 w-full rounded-xl object-cover"
          />
        )}
        <input
          name="coverImage"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleCoverChange}
          className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-foreground file:px-4 file:py-2 file:text-sm file:font-medium file:text-background hover:file:bg-[#383838] dark:hover:file:bg-[#ccc]"
        />
      </Field>

      <Field label="Playtime">
        <ToggleChip
          name="hasPlaytime"
          label="Set a start/end date"
          checked={hasPlaytime}
          onChange={setHasPlaytime}
        />
        {hasPlaytime ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Starts
              </span>
              <input
                type="date"
                name="playtimeStart"
                className={`mt-1 ${inputClasses}`}
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Ends
              </span>
              <input
                type="date"
                name="playtimeEnd"
                className={`mt-1 ${inputClasses}`}
              />
            </label>
          </div>
        ) : (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
            No set date — the group runs open-ended.
          </p>
        )}
      </Field>

      <Field
        label="Who can join"
        hint="Private groups need your approval for every request. Public groups let anyone join instantly."
      >
        <SegmentedControl
          name="visibility"
          options={[
            { value: "private" as GroupVisibility, label: "Private" },
            { value: "public" as GroupVisibility, label: "Public" },
          ]}
          value={visibility}
          onChange={setVisibility}
        />
      </Field>

      <Field
        label="Points distribution"
        hint="Check what counts toward the leaderboard and set the point values."
      >
        <div className="space-y-3">
          <PointsRow
            label="Wins"
            countName="countWins"
            counted={countWins}
            onCountedChange={setCountWins}
            pointsName="winPoints"
            points={winPoints}
            onPointsChange={setWinPoints}
            mistakeName="winPointsMistake"
            mistakePoints={winPointsMistake}
            onMistakePointsChange={setWinPointsMistake}
            activeClassName="border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500"
          />
          <PointsRow
            label="Losses"
            countName="countLosses"
            counted={countLosses}
            onCountedChange={setCountLosses}
            pointsName="lossPoints"
            points={lossPoints}
            onPointsChange={setLossPoints}
            mistakeName="lossPointsMistake"
            mistakePoints={lossPointsMistake}
            onMistakePointsChange={setLossPointsMistake}
            activeClassName="border-rose-600 bg-rose-600 text-white dark:border-rose-500 dark:bg-rose-500"
          />
          <PointsRow
            label="Storyteller"
            countName="countStoryteller"
            counted={countStoryteller}
            onCountedChange={setCountStoryteller}
            pointsName="storytellerPoints"
            points={storytellerPoints}
            onPointsChange={setStorytellerPoints}
            mistakeName="storytellerPointsMistake"
            mistakePoints={storytellerPointsMistake}
            onMistakePointsChange={setStorytellerPointsMistake}
            activeClassName="border-purple-600 bg-purple-600 text-white dark:border-purple-500 dark:bg-purple-500"
          />
        </div>
      </Field>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {isPending ? "Creating…" : "Create group"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm font-medium text-zinc-600 hover:underline dark:text-zinc-400"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
