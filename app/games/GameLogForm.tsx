"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { logGameAction } from "@/lib/game-actions";
import { INITIAL_GAME_STATE } from "@/lib/game-action-state";
import {
  DURATION_OPTIONS,
  type Alignment,
  type Character,
  type Duration,
  type LastPhase,
  type LogType,
  type ScriptPickerRow,
} from "@/lib/types";
import { SegmentedControl } from "./components/SegmentedControl";
import { ToggleChip } from "./components/ToggleChip";
import { TagInput } from "./components/TagInput";
import { CharacterPickerField } from "./components/CharacterPickerField";
import { ScriptPickerField } from "./components/ScriptPickerField";

const GOOD_EVIL_OPTIONS: { value: Alignment; label: string }[] = [
  { value: "good", label: "Good" },
  { value: "evil", label: "Evil" },
];

const goodPillClass =
  "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500";
const evilPillClass =
  "border-rose-600 bg-rose-600 text-white dark:border-rose-500 dark:bg-rose-500";

/** Both Good and Evil pills need their own color, but SegmentedControl only
 * takes one selectedClassName — this renders the row as two independent
 * controls glued together visually isn't worth it, so instead the pill
 * color is picked per-selection via a small wrapper that swaps
 * selectedClassName based on which value is currently chosen. Good enough
 * for a 2-option row; not worth generalizing further for just this case. */
function AlignmentControl({
  name,
  value,
  onChange,
  disabled,
}: {
  name: string;
  value: Alignment | null;
  onChange: (v: Alignment) => void;
  disabled?: boolean;
}) {
  return (
    <SegmentedControl
      name={name}
      options={GOOD_EVIL_OPTIONS}
      value={value}
      onChange={onChange}
      disabled={disabled}
      selectedClassName={value === "evil" ? evilPillClass : goodPillClass}
    />
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
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

export function GameLogForm({
  mode,
  characters,
  scripts,
  groupCodeSuggestions,
}: {
  mode: LogType;
  characters: Character[];
  scripts: ScriptPickerRow[];
  /** Invite codes of groups the signed-in user belongs to — powers the
   * autocomplete dropdown on the Group code(s) field below. */
  groupCodeSuggestions: string[];
}) {
  const isDetailed = mode === "detailed";
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    logGameAction,
    INITIAL_GAME_STATE,
  );

  const [scriptId, setScriptId] = useState<string | null>(null);
  const [externalScriptName, setExternalScriptName] = useState<string | null>(
    null,
  );
  const [isStoryteller, setIsStoryteller] = useState(false);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [selfAlignment, setSelfAlignment] = useState<Alignment | null>(null);
  const [winningTeam, setWinningTeam] = useState<Alignment | null>(null);
  const [storytellerMistakes, setStorytellerMistakes] = useState(false);
  const [duration, setDuration] = useState<Duration | null>(null);
  const [groupCodes, setGroupCodes] = useState<string[]>([]);
  const [finalThree, setFinalThree] = useState(false);
  const [lastPhase, setLastPhase] = useState<LastPhase | null>(null);
  const [lastPhaseNumber, setLastPhaseNumber] = useState(1);
  const [playerNames, setPlayerNames] = useState<string[]>([]);

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="logType" value={mode} />

      <Field label="Script played">
        <ScriptPickerField
          scripts={scripts}
          value={scriptId}
          onChange={setScriptId}
          externalName={externalScriptName}
          onExternalNameChange={setExternalScriptName}
        />
      </Field>

      <ToggleChip
        name="selfIsStoryteller"
        label="I was the Storyteller"
        checked={isStoryteller}
        onChange={setIsStoryteller}
        activeClassName="border-purple-600 bg-purple-600/15 text-purple-700 dark:border-purple-500 dark:text-purple-400"
      />

      <Field
        label="Your character"
        hint={isStoryteller ? "Not applicable — you ran this one." : undefined}
      >
        <CharacterPickerField
          characters={characters}
          value={characterId}
          onChange={setCharacterId}
          disabled={isStoryteller}
        />
      </Field>

      <Field label="Your alignment">
        <AlignmentControl
          name="selfAlignment"
          value={selfAlignment}
          onChange={setSelfAlignment}
          disabled={isStoryteller}
        />
      </Field>

      <Field label="Which team won">
        <AlignmentControl
          name="winningTeam"
          value={winningTeam}
          onChange={setWinningTeam}
        />
      </Field>

      <ToggleChip
        name="storytellerMistakes"
        label="Any Storyteller mistakes?"
        checked={storytellerMistakes}
        onChange={setStorytellerMistakes}
      />

      <Field label="How long did it last?">
        <SegmentedControl
          name="duration"
          options={DURATION_OPTIONS}
          value={duration}
          onChange={setDuration}
          selectedClassName="border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500"
        />
      </Field>

      {isDetailed && (
        <>
          <Field
            label="Players"
            hint="Free text for now — pulling from your friends list is coming later."
          >
            <TagInput
              name="playerNames"
              values={playerNames}
              onChange={setPlayerNames}
              placeholder="Type a name and press Enter…"
            />
          </Field>

          <Field label="Last Day/Night reached">
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl
                name="lastPhase"
                options={[
                  { value: "day" as LastPhase, label: "Day" },
                  { value: "night" as LastPhase, label: "Night" },
                ]}
                value={lastPhase}
                onChange={setLastPhase}
                selectedClassName="border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500"
              />
              <div className="flex items-center gap-1.5 rounded-full border border-black/[.12] px-1.5 py-1 dark:border-white/[.15]">
                <button
                  type="button"
                  onClick={() => setLastPhaseNumber((n) => Math.max(1, n - 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-sm hover:bg-black/[.04] dark:hover:bg-white/[.06]"
                  aria-label="Decrease"
                >
                  −
                </button>
                <input
                  type="hidden"
                  name="lastPhaseNumber"
                  value={lastPhaseNumber}
                />
                <span className="w-6 text-center text-sm font-medium tabular-nums">
                  {lastPhaseNumber}
                </span>
                <button
                  type="button"
                  onClick={() => setLastPhaseNumber((n) => Math.min(20, n + 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-sm hover:bg-black/[.04] dark:hover:bg-white/[.06]"
                  aria-label="Increase"
                >
                  +
                </button>
              </div>
            </div>
          </Field>

          <ToggleChip
            name="finalThree"
            label="Final 3 reached?"
            checked={finalThree}
            onChange={setFinalThree}
          />
        </>
      )}

      <Field label="Date">
        <input
          type="date"
          name="playedAt"
          defaultValue={todayIso}
          max={todayIso}
          className="rounded-full border border-black/[.12] bg-white px-4 py-2 text-sm outline-none focus:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900"
        />
      </Field>

      <Field
        label="Group code(s)"
        hint="Tag this game to one or more of your groups' leaderboards — optional, and only works with a code from a group you've already joined."
      >
        <TagInput
          name="groupCodes"
          values={groupCodes}
          onChange={setGroupCodes}
          placeholder="Type a code and press Enter…"
          uppercase
          suggestions={groupCodeSuggestions}
        />
      </Field>

      <Field label="Notes">
        <textarea
          name="notes"
          rows={3}
          placeholder="Anything else worth remembering about this game…"
          className="w-full rounded-2xl border border-black/[.12] bg-white px-4 py-2.5 text-sm outline-none focus:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900"
        />
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
          {isPending ? "Logging…" : "Log game"}
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
