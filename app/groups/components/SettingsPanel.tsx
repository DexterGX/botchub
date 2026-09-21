"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  updateGroupCoverAction,
  endGroupAction,
  transferGroupOwnershipAction,
} from "@/lib/group-actions";
import { INITIAL_GROUP_STATE } from "@/lib/group-action-state";
import type { Group, GroupLeaderboardRow } from "@/lib/types";
import { ImageCropperModal } from "@/components/ImageCropperModal";
import {
  GROUP_COVER_ASPECT,
  GROUP_COVER_OUTPUT_HEIGHT,
  GROUP_COVER_OUTPUT_WIDTH,
} from "@/lib/cropImage";

const fieldClasses =
  "rounded-2xl border border-black/[.08] p-4 dark:border-white/[.145]";

/** Settings tab (owner-only, gated in app/groups/[id]/page.tsx) — Diego's
 * three asks: update the group's logo, transfer ownership to another
 * member, or permanently end the group. Ownership transfer and ending the
 * group both go through a same-panel two-click confirm (click once to
 * arm, click again to actually do it) rather than a native confirm()
 * popup, matching this app's existing UI conventions elsewhere. Takes
 * `members` as the already-fetched leaderboard rather than a new query —
 * the leaderboard already lists every current member (including
 * zero-point ones), which is exactly the "who can I hand this to" list. */
export function SettingsPanel({
  group,
  members,
}: {
  group: Group;
  members: GroupLeaderboardRow[];
}) {
  const router = useRouter();

  // --- Group logo ---------------------------------------------------------
  const updateCoverAction = updateGroupCoverAction.bind(null, group.id);
  const [coverState, coverFormAction, isCoverPending] = useActionState(
    updateCoverAction,
    INITIAL_GROUP_STATE,
  );
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  // True from the moment a file is picked until the next submit is kicked
  // off, so "✓ Saved" only shows for a submission that actually just
  // completed — never for a freshly-picked, not-yet-submitted file. Both
  // flips happen in plain event handlers (never inside an effect), so
  // there's no cascading-setState-in-effect concern here.
  const [coverDirty, setCoverDirty] = useState(false);
  // Raw, just-picked file's object URL, shown inside the cropper modal —
  // separate from `coverPreviewUrl` (the final, already-cropped preview
  // shown on the form itself) so cancelling the cropper never disturbs
  // whatever cropped cover was already staged.
  const [cropperSrc, setCropperSrc] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    };
  }, [coverPreviewUrl]);

  useEffect(() => {
    return () => {
      if (cropperSrc) URL.revokeObjectURL(cropperSrc);
    };
  }, [cropperSrc]);

  // "Saved" reads off the action's own settled state (a fresh object once
  // it completes, still the imported constant on first render) rather than
  // a separate flag mirrored in an effect. A successful submit also
  // revalidates the group's own server data, which flows back into the
  // `group` prop and updates the banner cover photo up top on its own.
  const coverSaved =
    !isCoverPending &&
    !coverDirty &&
    coverState !== INITIAL_GROUP_STATE &&
    !coverState.error;

  // Opens the cropper on the raw picked file instead of using it directly
  // — the actual `coverImage` input value (and therefore `coverPreviewUrl`)
  // only gets set once the crop is confirmed, in handleCropConfirm below.
  function handleCoverChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropperSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function handleCropCancel() {
    setCropperSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (coverInputRef.current) coverInputRef.current.value = "";
  }

  // Swaps the cropped Blob onto the real file input via the DataTransfer
  // API so `updateGroupCoverAction`'s existing `formData.get("coverImage")`
  // handling needs no changes at all — it just sees a File, same as if the
  // user had picked an already-cropped image directly.
  function handleCropConfirm(blob: Blob) {
    const croppedFile = new File([blob], "cover.jpg", { type: "image/jpeg" });
    if (coverInputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(croppedFile);
      coverInputRef.current.files = dt.files;
    }

    setCoverDirty(true);
    setCoverPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(croppedFile);
    });

    setCropperSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }

  // --- Transfer ownership --------------------------------------------------
  // `members` (the leaderboard) now also includes left members (grayed out
  // on the Players tab) — someone who's left can't be handed ownership, so
  // they're filtered out here same as the current owner.
  const otherMembers = members.filter(
    (m) => m.user_id !== group.owner_id && m.status === "active",
  );
  const [selectedNewOwner, setSelectedNewOwner] = useState("");
  const [confirmingTransfer, setConfirmingTransfer] = useState(false);
  const [transferPending, setTransferPending] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  async function handleTransferConfirm() {
    if (!selectedNewOwner) return;
    setTransferPending(true);
    setTransferError(null);
    const result = await transferGroupOwnershipAction(group.id, selectedNewOwner);
    setTransferPending(false);
    if (!result.ok) {
      setTransferError(result.error ?? "Something went wrong.");
      return;
    }
    // No longer the owner — the Settings tab won't render for this user
    // once the page re-fetches, so land back on the group's main view.
    router.push(`/groups/${group.id}`);
    router.refresh();
  }

  // --- End this group -------------------------------------------------------
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [endPending, setEndPending] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);

  async function handleEndConfirm() {
    setEndPending(true);
    setEndError(null);
    const result = await endGroupAction(group.id);
    setEndPending(false);
    if (!result.ok) {
      setEndError(result.error ?? "Something went wrong.");
      return;
    }
    router.push("/groups");
  }

  return (
    <div className="space-y-4">
      <section className={fieldClasses}>
        <h3 className="font-semibold">Group logo</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Shown as the group&apos;s banner. JPG, PNG, or WebP, up to 5MB.
        </p>

        <form action={coverFormAction} className="mt-3">
          {(coverPreviewUrl || group.cover_image_url) && (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL or a user-supplied URL, neither worth a remotePatterns/optimizer round trip
            <img
              src={coverPreviewUrl ?? group.cover_image_url ?? undefined}
              alt=""
              className="mb-2 h-28 w-full rounded-xl object-cover"
            />
          )}
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={coverInputRef}
              name="coverImage"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleCoverChange}
              className="block text-sm file:mr-3 file:rounded-full file:border-0 file:bg-foreground file:px-4 file:py-2 file:text-sm file:font-medium file:text-background hover:file:bg-[#383838] dark:hover:file:bg-[#ccc]"
            />
            <button
              type="submit"
              disabled={isCoverPending || !coverPreviewUrl}
              onClick={() => setCoverDirty(false)}
              className="shrink-0 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {isCoverPending ? "Saving…" : "Save logo"}
            </button>
            {coverSaved && (
              <span className="text-sm text-emerald-700 dark:text-emerald-400">
                ✓ Saved
              </span>
            )}
          </div>
          {coverState.error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {coverState.error}
            </p>
          )}
        </form>
      </section>

      <section className={fieldClasses}>
        <h3 className="font-semibold">Transfer ownership</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Hand this group to another member — you&apos;ll become a regular
          member afterward.
        </p>

        {otherMembers.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-500">
            No other members to transfer to yet.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={selectedNewOwner}
              onChange={(e) => {
                setSelectedNewOwner(e.target.value);
                setConfirmingTransfer(false);
              }}
              className="rounded-xl border border-black/[.12] bg-white px-3 py-2 text-sm outline-none focus:border-zinc-400 dark:border-white/[.15] dark:bg-zinc-900"
            >
              <option value="">Choose a member…</option>
              {otherMembers.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.display_name ?? "Unknown"}
                </option>
              ))}
            </select>

            {!confirmingTransfer ? (
              <button
                type="button"
                disabled={!selectedNewOwner}
                onClick={() => setConfirmingTransfer(true)}
                className="rounded-full border border-black/[.12] px-3 py-1.5 text-sm font-semibold transition-colors hover:border-zinc-400 disabled:opacity-60 dark:border-white/[.15] dark:hover:border-zinc-600"
              >
                Transfer
              </button>
            ) : (
              <>
                <span className="text-sm text-amber-700 dark:text-amber-400">
                  Are you sure?
                </span>
                <button
                  type="button"
                  onClick={handleTransferConfirm}
                  disabled={transferPending}
                  className="rounded-full bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60 dark:bg-amber-500"
                >
                  {transferPending ? "Transferring…" : "Yes, transfer"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingTransfer(false)}
                  className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
        {transferError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {transferError}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-rose-600/30 bg-rose-500/[.03] p-4 dark:border-rose-500/30 dark:bg-rose-500/[.05]">
        <h3 className="font-semibold text-rose-700 dark:text-rose-400">
          End this group
        </h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Permanently deletes the group, its members, and its leaderboard.
          Games already logged aren&apos;t deleted — they just stop counting
          toward this group.
        </p>

        {!confirmingEnd ? (
          <button
            type="button"
            onClick={() => setConfirmingEnd(true)}
            className="mt-3 rounded-full border border-rose-600 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-600 hover:text-white dark:border-rose-500 dark:text-rose-400"
          >
            End group
          </button>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-rose-700 dark:text-rose-400">
              This can&apos;t be undone. Are you sure?
            </span>
            <button
              type="button"
              onClick={handleEndConfirm}
              disabled={endPending}
              className="rounded-full bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {endPending ? "Ending…" : "Yes, end it"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingEnd(false)}
              className="text-sm text-zinc-600 hover:underline dark:text-zinc-400"
            >
              Cancel
            </button>
          </div>
        )}
        {endError && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {endError}
          </p>
        )}
      </section>

      {cropperSrc && (
        <ImageCropperModal
          imageSrc={cropperSrc}
          aspect={GROUP_COVER_ASPECT}
          outputWidth={GROUP_COVER_OUTPUT_WIDTH}
          outputHeight={GROUP_COVER_OUTPUT_HEIGHT}
          onCancel={handleCropCancel}
          onConfirm={handleCropConfirm}
        />
      )}
    </div>
  );
}
