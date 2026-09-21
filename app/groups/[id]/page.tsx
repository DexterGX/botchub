import { Fragment } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getGroupById,
  getGroupMembership,
  getMyJoinRequestStatus,
  getGroupLeaderboard,
  getGroupHistoryPage,
  getPendingJoinRequests,
} from "@/lib/queries";
import { formatGroupPlaytime, rankGroupRows } from "@/lib/types";
import { Podium } from "@/app/groups/components/Podium";
import { UserAvatar } from "@/app/groups/components/UserAvatar";
import { PendingRequestsPanel } from "@/app/groups/components/PendingRequestsPanel";
import { RulesPanel } from "@/app/groups/components/RulesPanel";
import { HistoryCard } from "@/app/groups/components/HistoryCard";
import { JoinGroupButton } from "@/app/groups/components/JoinGroupButton";
import { SettingsPanel } from "@/app/groups/components/SettingsPanel";
import { CopyableCode } from "@/app/groups/components/CopyableCode";
import { CoverImageLightbox } from "@/app/groups/components/CoverImageLightbox";

type Tab = "players" | "rules" | "history" | "settings";
const BASE_TABS: { value: Tab; label: string }[] = [
  { value: "players", label: "Players" },
  { value: "rules", label: "Rules" },
  { value: "history", label: "History" },
];

interface GroupDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; page?: string }>;
}

export default async function GroupDetailPage({
  params,
  searchParams,
}: GroupDetailPageProps) {
  const { id } = await params;
  const { tab: tabParam, page: pageParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const group = await getGroupById(id);
  if (!group) notFound();

  const [role, myRequestStatus] = await Promise.all([
    getGroupMembership(id, user.id),
    getMyJoinRequestStatus(id, user.id),
  ]);
  const isOwner = group.owner_id === user.id;
  const isMember = isOwner || role !== null;

  // Settings is owner-only — appending it only for the owner means a
  // non-owner's ?tab=settings guess falls through the validation below to
  // "players" instead of ever reaching SettingsPanel.
  const tabs = isOwner
    ? [...BASE_TABS, { value: "settings" as const, label: "Settings" }]
    : BASE_TABS;

  const tab: Tab = tabs.some((t) => t.value === tabParam)
    ? (tabParam as Tab)
    : "players";
  const page = Math.max(1, Number(pageParam) || 1);

  const [leaderboard, pendingRequests, historyPage] = await Promise.all([
    isMember ? getGroupLeaderboard(id) : Promise.resolve([]),
    isOwner ? getPendingJoinRequests(id) : Promise.resolve([]),
    isMember && tab === "history"
      ? getGroupHistoryPage(id, page)
      : Promise.resolve(null),
  ]);

  function tabHref(next: Tab) {
    return `/groups/${id}?tab=${next}`;
  }

  // Standard competition ("1224") ranking, Diego's ask: two players tied
  // on points share a placement, and the next distinct total picks up at
  // the position after both of them (1, 1, 3, 4 — not 1, 1, 2, 3). Shared
  // with Podium (see rankGroupRows) so the two never disagree about who's
  // tied — that mismatch was exactly Diego's "the podium doesn't seem
  // like [the list]" report.
  const ranks = rankGroupRows(leaderboard);
  const leaderboardRanks = leaderboard.map((row, i) => ({ row, rank: ranks[i] }));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      {group.cover_image_url && (
        // Diego's ask (2026-09-21): a little bigger here than the card's
        // own h-28/h-32 banner, plus click-to-view-full-size (see
        // CoverImageLightbox) — this is the one spot in the app where the
        // cover photo is the main focus of the page, not a small preview.
        <div className="mb-4">
          <CoverImageLightbox
            src={group.cover_image_url}
            alt={`${group.name}'s cover photo`}
            className="h-44 w-full rounded-2xl object-cover"
          />
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{group.name}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Playtime: {formatGroupPlaytime(group.playtime_start, group.playtime_end)}
          </p>
        </div>
        <CopyableCode code={group.invite_code} />
      </div>

      {!isMember && (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl border border-black/[.08] p-4 dark:border-white/[.145]">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Join this group to see its leaderboard and history.
          </p>
          <JoinGroupButton
            groupId={id}
            visibility={group.visibility}
            initialStatus={myRequestStatus === "pending" ? "pending" : "none"}
          />
        </div>
      )}

      {isMember && (
        <>
          <div className="mt-8">
            <Podium rows={leaderboard} />
          </div>

          <div className="mt-4 flex justify-center gap-2">
            {tabs.map((t) => (
              <Link
                key={t.value}
                href={tabHref(t.value)}
                className={`rounded-xl px-5 py-2 text-sm font-medium transition-colors ${
                  tab === t.value
                    ? "bg-foreground text-background"
                    : "bg-black/[.05] text-zinc-600 hover:bg-black/[.08] dark:bg-white/[.06] dark:text-zinc-400 dark:hover:bg-white/[.1]"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>

          <div className="mt-6">
            {tab === "players" && (
              <div>
                <SectionDivider label="Top Ranking" />

                {isOwner && (
                  <PendingRequestsPanel initialRequests={pendingRequests} />
                )}

                {leaderboard.length === 0 ? (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    No members yet.
                  </p>
                ) : (
                  <div className="rounded-2xl border border-black/[.08] p-2 dark:border-white/[.145]">
                    <ol>
                      {leaderboardRanks.map(({ row, rank }, index) => {
                        const isLeftMember = row.status === "left";
                        const isYou = row.user_id === user.id;
                        return (
                          <Fragment key={row.user_id}>
                            {index > 0 && <RowDivider />}
                            <li
                              className={`flex items-center gap-3 rounded-xl p-2 ${
                                isLeftMember ? "opacity-60" : ""
                              }`}
                            >
                              <RankBadge rank={rank} />
                              <UserAvatar
                                displayName={row.display_name}
                                avatarUrl={row.avatar_url}
                                avatarCharacterIconUrl={row.avatar_character_icon_url}
                                size={36}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="truncate font-medium">
                                    {row.display_name ?? "Unknown"}
                                  </span>
                                  {isYou && (
                                    <span className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                                      You
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-zinc-500 dark:text-zinc-500">
                                  {row.wins}W · {row.losses}L
                                  {row.storyteller_games > 0 &&
                                    ` · ${row.storyteller_games} ST`}
                                </div>
                              </div>
                              {isLeftMember && (
                                <span className="shrink-0 rounded-full bg-black/[.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:bg-white/[.08] dark:text-zinc-400">
                                  Quit
                                </span>
                              )}
                              <span className="shrink-0 text-sm font-semibold tabular-nums">
                                🪙 {row.points} pts
                              </span>
                            </li>
                          </Fragment>
                        );
                      })}
                    </ol>
                  </div>
                )}
              </div>
            )}

            {tab === "rules" && (
              <div>
                <SectionDivider label="Rules" />
                <RulesPanel group={group} />
              </div>
            )}

            {tab === "history" && historyPage && (
              <div>
                <SectionDivider label="History" />

                {historyPage.rows.length === 0 ? (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    No games logged to this group yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {historyPage.rows.map((row) => (
                      <HistoryCard
                        key={`${row.game_id}-${row.player_user_id ?? "st"}`}
                        row={row}
                      />
                    ))}
                  </ul>
                )}

                {historyPage.totalPages > 1 && (
                  <div className="mt-6 flex items-center justify-center gap-4 text-sm">
                    {page > 1 ? (
                      <Link
                        href={`/groups/${id}?tab=history&page=${page - 1}`}
                        className="rounded-full border border-black/[.12] px-4 py-2 font-medium transition-colors hover:border-zinc-400 dark:border-white/[.15] dark:hover:border-zinc-600"
                      >
                        ← Prev
                      </Link>
                    ) : (
                      <span className="cursor-not-allowed rounded-full border border-black/[.12] px-4 py-2 font-medium text-zinc-400 dark:border-white/[.15] dark:text-zinc-600">
                        ← Prev
                      </span>
                    )}
                    <span className="text-zinc-500 dark:text-zinc-400">
                      Page {page} of {historyPage.totalPages}
                    </span>
                    {page < historyPage.totalPages ? (
                      <Link
                        href={`/groups/${id}?tab=history&page=${page + 1}`}
                        className="rounded-full border border-black/[.12] px-4 py-2 font-medium transition-colors hover:border-zinc-400 dark:border-white/[.15] dark:hover:border-zinc-600"
                      >
                        Next →
                      </Link>
                    ) : (
                      <span className="cursor-not-allowed rounded-full border border-black/[.12] px-4 py-2 font-medium text-zinc-400 dark:border-white/[.15] dark:text-zinc-600">
                        Next →
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === "settings" && isOwner && (
              <div>
                <SectionDivider label="Settings" />
                <SettingsPanel group={group} members={leaderboard} />
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}

/** The small "◆ Top Ranking ◆" label under the tab row — originally the
 * Players tab only (Diego's ask, matching the Dribbble reference's
 * section-header treatment above its own ranked list), now reused at the
 * top of every tab (Rules, History, and the owner-only Settings) for a
 * consistent look across all of them. */
function SectionDivider({ label }: { label: string }) {
  return (
    <div className="mb-4 flex items-center justify-center gap-3 text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
      <span className="h-px w-10 bg-amber-500/30" aria-hidden="true" />
      <span>◆ {label} ◆</span>
      <span className="h-px w-10 bg-amber-500/30" aria-hidden="true" />
    </div>
  );
}

/** Divider between leaderboard rows — Diego's ask: a line "almost
 * reaching the borders" that "gets thinner as it stretches", rather than
 * a plain full-width rule. A gradient (solid in the middle, fading to
 * transparent at both ends) reads as thinning outward, and stopping a
 * little short of the row's own edges is what "almost reaching" means
 * here — a true edge-to-edge line wouldn't have anywhere left to fade
 * into. */
function RowDivider() {
  return (
    <div
      aria-hidden="true"
      className="mx-2 h-px bg-gradient-to-r from-transparent via-black/[.14] to-transparent dark:via-white/[.16]"
    />
  );
}

function ordinalSuffix(rank: number): string {
  const lastTwo = rank % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return "th";
  switch (rank % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

/** Replaces the plain "1", "2", "3"... with a small colored badge (gold/
 * silver/bronze for the top 3, neutral below that) showing the rank and
 * its ordinal suffix — Diego's ask, the reference image's laurel-wreath
 * treatment adapted to this app's flatter icon style rather than an
 * illustrated wreath. */
function RankBadge({ rank }: { rank: number }) {
  const toneClass =
    rank === 1
      ? "bg-amber-400 text-amber-950 ring-2 ring-amber-300 dark:ring-amber-500/60"
      : rank === 2
        ? "bg-zinc-300 text-zinc-800 ring-2 ring-zinc-200 dark:bg-zinc-400 dark:ring-zinc-300/60"
        : rank === 3
          ? "bg-orange-400 text-orange-950 ring-2 ring-orange-300 dark:ring-orange-500/60"
          : "bg-black/[.06] text-zinc-500 dark:bg-white/[.08] dark:text-zinc-400";

  return (
    <span
      className={`flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-full leading-none ${toneClass}`}
    >
      <span className="text-sm font-bold">{rank}</span>
      <span className="text-[8px] font-semibold uppercase tracking-wide">
        {ordinalSuffix(rank)}
      </span>
    </span>
  );
}
