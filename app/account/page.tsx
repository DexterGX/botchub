import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/lib/auth-actions";
import {
  getMyGameStats,
  getMyGamesPage,
  getMyLikedScripts,
  getMyScriptCount,
  getOfficialCharactersForFilter,
} from "@/lib/queries";
import { COUNTRIES } from "@/lib/geo";
import { TEAM_ORDER } from "@/lib/types";
import { DisplayNameForm } from "./DisplayNameForm";
import { ProfileDetailsForm } from "./ProfileDetailsForm";
import { AvatarPicker } from "./AvatarPicker";
import { AvatarLightbox } from "./AvatarLightbox";
import { AccountDesktopShell } from "./AccountDesktopShell";
import { StatsOverview } from "./StatsOverview";
import { FavoriteScripts } from "./FavoriteScripts";

export const metadata = {
  title: "Account — BOTChub",
};

interface AccountPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const { tab } = await searchParams;
  // Below `lg`, the page now shows exactly one section at a time — Diego's
  // ask was to stop cramming settings/games/stats into one long scroll on
  // mobile the way the >=lg layout never does, and instead let the header's
  // hamburger (MobileNav) / tablet dropdown (AccountMenu) navigate between
  // them via this same `tab` param, mirroring the >=lg sidebar's own
  // Overview/Profile details split rather than inventing a second scheme.
  const activeTab: "overview" | "profile" | "favorites" =
    tab === "profile" ? "profile" : tab === "favorites" ? "favorites" : "overview";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  // Nested closures below (Avatar) don't get TS's narrowing of `user` from
  // the check above — capture it once here so they don't need `!`/`?`.
  const authedUser = user;

  // Recent games shown directly on the Overview tab — a small taste, not
  // the full paginated list (that's what /games/history, linked from
  // there, is for).
  const RECENT_GAMES_LIMIT = 5;

  const [
    { data: profile },
    { data: privateInfo },
    characters,
    gameStats,
    scriptsCount,
    recentGamesPage,
    likedScripts,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "display_name, tag, avatar_url, avatar_character_id, country, region",
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("profile_private")
      .select("full_name, birthday")
      .eq("id", user.id)
      .maybeSingle(),
    // Reused for the avatar picker grid below — same official-character
    // list (with icon_url) the /scripts character filters already fetch.
    getOfficialCharactersForFilter(),
    getMyGameStats(user.id),
    getMyScriptCount(user.id),
    getMyGamesPage(user.id, 1, RECENT_GAMES_LIMIT),
    getMyLikedScripts(user.id),
  ]);

  const recentGames = recentGamesPage.games;

  const charactersByTeam = TEAM_ORDER.map((team) => ({
    team,
    characters: characters.filter((c) => c.team === team),
  })).filter((group) => group.characters.length > 0);

  const avatarCharacter = profile?.avatar_character_id
    ? characters.find((c) => c.character_id === profile.avatar_character_id)
    : undefined;

  const countryName = profile?.country
    ? (COUNTRIES.find((c) => c.code === profile.country)?.name ??
      profile.country)
    : null;
  const locationLine = [profile?.region, countryName]
    .filter(Boolean)
    .join(", ");

  const memberSince = new Date(user.created_at).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const nameTag = profile?.display_name ? (
    <>
      {profile.display_name}
      <span className="text-zinc-500 dark:text-zinc-400">
        #{profile.tag}
      </span>
    </>
  ) : (
    "BOTChub member"
  );

  // A plain function, not a component: it's called directly (renderAvatar(80))
  // rather than used as JSX (<Avatar />), specifically so it isn't "a
  // component defined during render" — this closes over avatarCharacter/
  // profile/authedUser instead of taking them as props.
  function renderAvatar(size: number) {
    return avatarCharacter?.icon_url ? (
      <Image
        src={avatarCharacter.icon_url}
        alt={avatarCharacter.name}
        width={size}
        height={size}
        className="h-full w-full object-contain"
      />
    ) : profile?.avatar_url ? (
      // External avatar URL from the OAuth provider — not worth a
      // remotePatterns entry for one small profile-page image.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatar_url}
        alt=""
        className="h-full w-full rounded-full object-cover"
      />
    ) : (
      // Scales with `size` rather than a fixed text-2xl — this now also
      // renders at 256px in the AvatarLightbox's enlarged view below, where
      // a fixed small font would look lost in the middle of a huge circle.
      <span
        className="font-semibold"
        style={{ fontSize: `${size * 0.42}px` }}
      >
        {(profile?.display_name ?? authedUser.email ?? "?")
          .charAt(0)
          .toUpperCase()}
      </span>
    );
  }

  const avatarAlt = profile?.display_name
    ? `${profile.display_name}'s profile photo`
    : "profile photo";

  // Shared between the mobile and desktop AvatarLightbox `large` props
  // below — a solid, opaque circle (not the small trigger's faint
  // `bg-black/[.06]` tint) so a token icon's own transparent PNG padding
  // shows this solid color instead of whatever's behind the modal.
  const avatarLarge = (
    <div className="flex h-56 w-56 items-center justify-center overflow-hidden rounded-full bg-zinc-100 shadow-2xl dark:bg-zinc-800">
      {renderAvatar(224)}
    </div>
  );

  const profileDetailsSection = (
    <>
      <DisplayNameForm currentDisplayName={profile?.display_name ?? ""} />
      <ProfileDetailsForm
        defaultFullName={privateInfo?.full_name ?? ""}
        defaultBirthday={privateInfo?.birthday ?? ""}
        defaultCountry={profile?.country ?? ""}
        defaultRegion={profile?.region ?? ""}
      />
    </>
  );

  const logoutButton = (
    <form action={signOutAction}>
      <button
        type="submit"
        className="w-full rounded-full border border-black/[.12] px-5 py-2.5 text-sm font-medium transition-colors hover:border-zinc-400 dark:border-white/[.15] dark:hover:border-zinc-600"
      >
        Log out
      </button>
    </form>
  );

  return (
    <main className="flex flex-1 flex-col justify-center lg:justify-start">
      {/* Narrow single-column layout, unchanged in spirit from the original
          /account — this is what phones and small/medium windows get. The
          >=lg breakpoint below gets the richer, GitHub/Riot-account-style
          layout instead of trying to force one layout to do both jobs. */}
      <div className="mx-auto w-full max-w-sm px-6 py-16 lg:hidden">
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>

        <div className="relative mt-8 rounded-2xl border border-black/[.08] dark:border-white/[.145]">
          {/* The gradient wash gets its own overflow-hidden layer instead of
              putting overflow-hidden on the card itself — the card also
              hosts the AvatarPicker's popover, which needs to be able to
              draw outside the card's rounded corners instead of being
              clipped by them. */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-transparent" />
          </div>

          <div className="relative flex items-center gap-4 p-5">
            <AvatarLightbox
              alt={avatarAlt}
              trigger={
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/[.06] ring-2 ring-black/[.06] dark:bg-white/[.08] dark:ring-white/[.1]">
                  {renderAvatar(80)}
                </div>
              }
              large={avatarLarge}
            />

            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{nameTag}</div>
              <div className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                {user.email}
              </div>
              {locationLine && (
                <div className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-500">
                  📍 {locationLine}
                </div>
              )}
              <div className="mt-0.5 truncate text-xs text-zinc-400 dark:text-zinc-600">
                Member since {memberSince}
              </div>
              <div className="mt-1.5">
                <AvatarPicker
                  charactersByTeam={charactersByTeam}
                  currentCharacterId={profile?.avatar_character_id ?? null}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Exactly one section at a time, chosen by `?tab=` — the hamburger
            (MobileNav) links here with the section already picked, same
            data/components the >=lg sidebar's tabs use, just navigated to
            instead of switched in place. */}
        <div className="mt-6">
          {activeTab === "overview" ? (
            <StatsOverview
              scriptsCount={scriptsCount}
              stats={gameStats}
              recentGames={recentGames}
            />
          ) : activeTab === "favorites" ? (
            <FavoriteScripts scripts={likedScripts} />
          ) : (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Profile details
              </h2>
              <div className="mt-3">{profileDetailsSection}</div>
            </div>
          )}
        </div>

        <div className="mt-6">{logoutButton}</div>
      </div>

      {/* >=lg: identity + section nav on the left, tab content on the
          right — the layout Diego asked for, closer to how GitHub's
          profile or Riot's account-management page is organized. */}
      <div className="hidden lg:block">
        <AccountDesktopShell
          sidebarHeader={
            <div className="text-center">
              <div className="mx-auto flex justify-center">
                <AvatarLightbox
                  alt={avatarAlt}
                  trigger={
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-black/[.06] ring-2 ring-black/[.06] dark:bg-white/[.08] dark:ring-white/[.1]">
                      {renderAvatar(96)}
                    </div>
                  }
                  large={avatarLarge}
                />
              </div>
              <div className="mt-3 truncate font-medium">{nameTag}</div>
              <div className="truncate text-sm text-zinc-600 dark:text-zinc-400">
                {user.email}
              </div>
              {locationLine && (
                <div className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-500">
                  📍 {locationLine}
                </div>
              )}
              <div className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">
                Member since {memberSince}
              </div>
              <div className="mt-3 flex justify-center">
                <AvatarPicker
                  charactersByTeam={charactersByTeam}
                  currentCharacterId={profile?.avatar_character_id ?? null}
                />
              </div>
            </div>
          }
          sidebarFooter={logoutButton}
          tabs={[
            {
              id: "overview",
              label: "Overview",
              description: "Stats & activity",
              content: (
                <StatsOverview
                  scriptsCount={scriptsCount}
                  stats={gameStats}
                  recentGames={recentGames}
                />
              ),
            },
            {
              id: "profile",
              label: "Profile details",
              description: "Name, birthday, location",
              content: (
                <div className="max-w-md">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Profile details
                  </h2>
                  <div className="mt-3">{profileDetailsSection}</div>
                </div>
              ),
            },
            {
              id: "favorites",
              label: "Favorites",
              description: "Scripts you've liked",
              content: <FavoriteScripts scripts={likedScripts} />,
            },
          ]}
        />
      </div>
    </main>
  );
}
