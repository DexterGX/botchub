import Image from "next/image";

/** Shared avatar circle for the Groups feature — leaderboard rows, the
 * podium, pending-join-request cards, and history cards all show the same
 * three-tier fallback the account page already established: character
 * token icon (if the user picked one as their avatar) > OAuth photo URL >
 * first-letter initial. Takes the already-resolved icon_url rather than a
 * characters list, since callers (lib/queries.ts) resolve that once per
 * batch instead of once per avatar. */
export function UserAvatar({
  displayName,
  avatarUrl,
  avatarCharacterIconUrl,
  size = 40,
}: {
  displayName: string | null;
  avatarUrl: string | null;
  avatarCharacterIconUrl: string | null;
  size?: number;
}) {
  const initial = (displayName ?? "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/[.06] dark:bg-white/[.08]"
      style={{ width: size, height: size }}
    >
      {avatarCharacterIconUrl ? (
        <Image
          src={avatarCharacterIconUrl}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-contain"
        />
      ) : avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span
          className="font-semibold text-zinc-500 dark:text-zinc-400"
          style={{ fontSize: `${size * 0.42}px` }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}
