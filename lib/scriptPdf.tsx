import path from "path";
import sharp from "sharp";
import {
  Document,
  Font,
  Image as PdfImage,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type {
  Character,
  ScriptJsonEntry,
  Team,
} from "@/lib/types";
import { TEAM_LABELS, TEAM_ORDER, isCharacterObjectEntry } from "@/lib/types";
import {
  buildNightOrder,
  type NightOrderEntry,
} from "@/lib/nightOrder";

/**
 * Renders a "printed script sheet" PDF for a script — the same kind of
 * document script.bloodontheclocktower.com generates, built from botchub's
 * own stored data instead of a third party's PDF.
 *
 * Structure (per Diego's side-by-side comparison against the official
 * export, an icon/layout pass, then a correction to both — see
 * build-plan.md's Phase 2 follow-up #10, #11 and #12 for the full history):
 *   1. Character sheet — every character on the script (Townsfolk, Outsider,
 *      Minion, Demon, Traveller — Fabled/Loric characters are NOT shown
 *      here, see page 2), grouped by team, split into two balanced columns.
 *      Each character is a row: its (large) icon on the left, vertically
 *      centered against the name+ability text block to its right.
 *   2. Quick reference — three columns: First Night wake order (icon+name
 *      only) on the left, Other Nights wake order on the right, and Jinxes
 *      + Fabled/Loric characters in the middle. The standard player-count
 *      table runs full-width across the bottom of the page, in its
 *      traditional horizontal orientation (player counts as columns,
 *      Townsfolk/Outsider/Minion/Demon as rows).
 *   3. First Night — full run sheet (icon + name + reminder text), a single
 *      column, tuned to fit even a long wake order on one page.
 *   4. Other Nights — same, its own page.
 * Pages 2-4 are each only emitted when they'd have real content (a script
 * with no night-order/jinx/fabled data doesn't get a blank page 2, etc).
 *
 * This is a deliberately ORIGINAL layout, not a port of the official site's
 * own Typst template — informed by its structure, but our own code, our own
 * color values, our own card style, and (per Diego's call after the
 * licensing issue was flagged) open-licensed font substitutes rather than
 * that site's paid fonts:
 *   - "LHF Unlovable" (their script-title font, a paid Letterhead Fonts
 *     face) → Pirata One (Google Fonts, OFL) for the same gothic/spooky
 *     title feel.
 *   - "Trade Gothic LT Std" (their body/name font, a paid Linotype face,
 *     used for essentially all the readable text) → Oswald (Google Fonts,
 *     OFL), a condensed grotesque sans with a similar look.
 *   - "Dumbledor  KERNED 02" (their section-label caps font, a novelty
 *     display face) → also substituted with Oswald (bold, tracked caps)
 *     rather than adding a third font family.
 *   - "OFL Sorts Mill Goudy" is, as the name says, already OFL-licensed —
 *     used for real here (byline/author text), same as their site.
 * Font files live in public/fonts/, fetched from the google/fonts GitHub
 * repo (Oswald's variable font instanced to static weights with fonttools;
 * Sorts Mill Goudy and Pirata One ship as static TTFs already).
 *
 * Per Diego's ink-saving note, the page background is plain white (no
 * tinted page fill), and character/token icons render as bare images with
 * no filled circle behind them — a missing icon falls back to a thin
 * outline ring with an initial letter instead of a solid badge.
 *
 * The player-count table (page 2) is the standard BOTC player-count →
 * Townsfolk/Outsider/Minion/Demon distribution table — official game-rule
 * data (the same numbers reprinted in every physical script's own rules
 * sheet and every third-party grimoire tool), not the official site's
 * creative/proprietary content, so it's safe to reproduce exactly.
 */

const FONTS_DIR = path.join(process.cwd(), "public", "fonts");

let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered) return;
  fontsRegistered = true;

  Font.register({
    family: "Oswald",
    fonts: [
      { src: path.join(FONTS_DIR, "Oswald-Regular.ttf"), fontWeight: 400 },
      { src: path.join(FONTS_DIR, "Oswald-Medium.ttf"), fontWeight: 500 },
      { src: path.join(FONTS_DIR, "Oswald-SemiBold.ttf"), fontWeight: 600 },
      { src: path.join(FONTS_DIR, "Oswald-Bold.ttf"), fontWeight: 700 },
    ],
  });

  Font.register({
    family: "Sorts Mill Goudy",
    fonts: [
      { src: path.join(FONTS_DIR, "SortsMillGoudy-Regular.ttf") },
      {
        src: path.join(FONTS_DIR, "SortsMillGoudy-Italic.ttf"),
        fontStyle: "italic",
      },
    ],
  });

  Font.register({
    family: "Pirata One",
    fonts: [{ src: path.join(FONTS_DIR, "PirataOne-Regular.ttf") }],
  });

  // react-pdf/pdfkit hyphenates by default, which looks bad for short
  // ability-text lines and character names — disable it globally.
  Font.registerHyphenationCallback((word) => [word]);
}

const GOOD_COLOR = "#1e4d78";
const EVIL_COLOR = "#7a1f1f";
const TRAVELLER_COLOR = "#5b2a86";
const FABLED_COLOR = "#8a5a10";
const GOLD = "#8a6d1f";
const INK = "#2a2622";
const HAIRLINE = "#ddd2b8";
const FALLBACK_RING = "#b9ad8f";
const FALLBACK_LETTER = "#8a7f63";

function nameColorFor(team: Team): string {
  if (team === "minion" || team === "demon") return EVIL_COLOR;
  if (team === "traveller") return TRAVELLER_COLOR;
  if (team === "fabled" || team === "loric") return FABLED_COLOR;
  return GOOD_COLOR;
}

// Teams shown on the page 1 character sheet — Fabled/Loric are special,
// script-wide rule modifiers rather than characters players are assigned,
// so (matching the official export) they're surfaced on the Quick
// Reference page instead, alongside Jinxes and the player-count table.
const SHEET_TEAM_ORDER: Team[] = TEAM_ORDER.filter(
  (t) => t !== "fabled" && t !== "loric",
);

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 32,
    paddingHorizontal: 30,
    backgroundColor: "#ffffff",
    fontFamily: "Oswald",
  },
  title: {
    fontFamily: "Pirata One",
    fontSize: 28,
    color: EVIL_COLOR,
    textAlign: "center",
  },
  byline: {
    fontFamily: "Sorts Mill Goudy",
    fontStyle: "italic",
    fontSize: 12,
    color: INK,
    textAlign: "center",
    marginTop: 2,
    marginBottom: 12,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
    marginBottom: 4,
  },
  dividerLine: {
    flexGrow: 1,
    height: 0.75,
    backgroundColor: GOLD,
  },
  dividerLabel: {
    fontFamily: "Oswald",
    fontWeight: 700,
    fontSize: 9,
    letterSpacing: 1.5,
    color: GOLD,
    borderWidth: 0.75,
    borderColor: GOLD,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginHorizontal: 6,
  },
  teamColumns: {
    flexDirection: "row",
  },
  teamColumn: {
    flex: 1,
    paddingHorizontal: 5,
  },
  charRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  charIconWrap: {
    marginRight: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  charTextWrap: {
    flex: 1,
  },
  charName: {
    fontFamily: "Oswald",
    fontWeight: 700,
    fontSize: 8.3,
    textAlign: "left",
  },
  charAbility: {
    fontFamily: "Oswald",
    fontWeight: 400,
    fontSize: 7.3,
    color: INK,
    lineHeight: 1.12,
    textAlign: "left",
    marginTop: 1,
  },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: "Oswald",
    fontSize: 7,
    color: "#8a8478",
  },
  colHeading: {
    fontFamily: "Oswald",
    fontWeight: 700,
    fontSize: 9,
    letterSpacing: 1,
    color: GOLD,
    textAlign: "center",
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 0.75,
    borderBottomColor: GOLD,
  },
  subHeading: {
    fontFamily: "Oswald",
    fontWeight: 700,
    fontSize: 7.5,
    letterSpacing: 0.5,
    color: GOLD,
    textAlign: "left",
    marginBottom: 4,
  },
  refThreeCol: {
    flexDirection: "row",
    marginTop: 6,
  },
  refColSide: {
    flex: 1,
    paddingHorizontal: 6,
  },
  refColMiddle: {
    flex: 1,
    paddingHorizontal: 8,
    borderLeftWidth: 0.5,
    borderLeftColor: HAIRLINE,
    borderRightWidth: 0.5,
    borderRightColor: HAIRLINE,
  },
  refRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  refIndex: {
    width: 12,
    fontFamily: "Oswald",
    fontSize: 7,
    color: "#a39c8a",
    textAlign: "right",
    marginRight: 4,
  },
  refIconGap: {
    marginRight: 5,
  },
  refName: {
    fontFamily: "Oswald",
    fontWeight: 500,
    fontSize: 8,
    color: INK,
    flexShrink: 1,
  },
  jinxRow: {
    marginBottom: 6,
  },
  jinxNames: {
    fontFamily: "Oswald",
    fontWeight: 700,
    fontSize: 8,
    color: INK,
  },
  jinxReason: {
    fontFamily: "Oswald",
    fontWeight: 400,
    fontSize: 7.3,
    color: INK,
    lineHeight: 1.15,
    marginTop: 1,
  },
  fabledCard: {
    marginBottom: 8,
  },
  fabledName: {
    fontFamily: "Oswald",
    fontWeight: 700,
    fontSize: 8.5,
    color: FABLED_COLOR,
    textAlign: "center",
  },
  fabledIconRow: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 3,
  },
  fabledAbility: {
    fontFamily: "Oswald",
    fontWeight: 400,
    fontSize: 7.3,
    color: INK,
    lineHeight: 1.18,
  },
  playerTableWide: {
    marginTop: 6,
    borderWidth: 0.75,
    borderColor: GOLD,
    borderRadius: 4,
  },
  playerTableWideHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 0.75,
    borderBottomColor: GOLD,
  },
  playerTableWideRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: HAIRLINE,
  },
  playerTableWideRowLast: {
    flexDirection: "row",
  },
  playerTableWideHeaderLabelCell: {
    width: 90,
    fontFamily: "Oswald",
    fontWeight: 700,
    fontSize: 7.5,
    color: GOLD,
    textAlign: "left",
    paddingVertical: 4,
    paddingLeft: 6,
  },
  playerTableWideHeaderCell: {
    flex: 1,
    fontFamily: "Oswald",
    fontWeight: 700,
    fontSize: 7.5,
    color: GOLD,
    textAlign: "center",
    paddingVertical: 4,
  },
  playerTableWideLabelCell: {
    width: 90,
    fontFamily: "Oswald",
    fontWeight: 700,
    fontSize: 7.5,
    color: GOLD,
    textAlign: "left",
    paddingVertical: 4,
    paddingLeft: 6,
  },
  playerTableWideCell: {
    flex: 1,
    fontFamily: "Oswald",
    fontWeight: 400,
    fontSize: 7.5,
    color: INK,
    textAlign: "center",
    paddingVertical: 4,
  },
  nightList: {
    marginTop: 8,
  },
  nightRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 3,
    paddingBottom: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: HAIRLINE,
  },
  nightIndex: {
    width: 16,
    fontFamily: "Oswald",
    fontSize: 7.5,
    color: "#a39c8a",
    textAlign: "right",
    marginRight: 6,
  },
  nightIconGap: {
    marginRight: 7,
  },
  nightTextWrap: {
    flex: 1,
  },
  nightName: {
    fontFamily: "Oswald",
    fontWeight: 700,
    fontSize: 8.3,
  },
  nightReminder: {
    fontFamily: "Oswald",
    fontWeight: 400,
    fontSize: 7.6,
    color: INK,
    lineHeight: 1.12,
    borderLeftWidth: 1,
    borderLeftColor: GOLD,
    paddingLeft: 6,
  },
});

/** Fetches a character icon and, if it's WebP (pdfkit/react-pdf can only
 * embed PNG or JPEG), converts it to PNG. Returns null on any failure so a
 * single broken/missing icon degrades to the fallback badge rather than
 * failing the whole PDF. */
async function loadIconBuffer(url: string | null): Promise<Buffer | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("webp") || url.endsWith(".webp")) {
      return await sharp(bytes).png().toBuffer();
    }
    return bytes;
  } catch {
    return null;
  }
}

interface CharacterIcon {
  characterId: string;
  buffer: Buffer | null;
}

/** Pre-fetches every icon this script needs (character sheet + night
 * order + fabled) once, up front, so the render pass below is synchronous —
 * @react-pdf components can't await mid-render. */
async function loadAllIcons(
  characters: Character[],
  nightEntries: NightOrderEntry[],
): Promise<Map<string, Buffer | null>> {
  const wanted = new Map<string, string | null>();
  for (const c of characters) wanted.set(c.id, c.icon_url);
  for (const e of nightEntries) wanted.set(e.key, e.iconUrl);

  const entries = Array.from(wanted.entries());
  const results: CharacterIcon[] = await Promise.all(
    entries.map(async ([characterId, url]) => ({
      characterId,
      buffer: await loadIconBuffer(url),
    })),
  );

  return new Map(results.map((r) => [r.characterId, r.buffer]));
}

/** A bare icon image at the given size — no filled badge behind it (per
 * Diego's ask to stop wasting ink on a dark circle). When no icon is
 * available, falls back to a thin outline ring with an initial letter
 * instead of a solid-color badge. */
function IconBadge({
  buffer,
  fallbackLetter,
  size,
}: {
  buffer: Buffer | null | undefined;
  fallbackLetter: string;
  size: number;
}) {
  if (buffer) {
    return <PdfImage src={buffer} style={{ width: size, height: size }} />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 0.75,
        borderColor: FALLBACK_RING,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          fontFamily: "Oswald",
          fontWeight: 700,
          fontSize: size * 0.4,
          color: FALLBACK_LETTER,
        }}
      >
        {fallbackLetter.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

const CHAR_ICON_SIZE = 28;

/** One character's row on the page 1 sheet: its (large) icon on the left,
 * vertically centered against the name+ability text block to its right —
 * the icon sits centered on the left side, between the name and the
 * description height-wise, not stacked in between them. */
function CharacterEntry({
  character,
  icon,
}: {
  character: Character;
  icon: Buffer | null | undefined;
}) {
  return (
    <View style={styles.charRow} wrap={false}>
      <View style={styles.charIconWrap}>
        <IconBadge buffer={icon} fallbackLetter={character.name} size={CHAR_ICON_SIZE} />
      </View>
      <View style={styles.charTextWrap}>
        <Text style={[styles.charName, { color: nameColorFor(character.team) }]}>
          {character.name}
        </Text>
        {character.ability && (
          <Text style={styles.charAbility}>{character.ability}</Text>
        )}
      </View>
    </View>
  );
}

/** Splits a list into two columns balanced by *estimated rendered height*
 * (not raw count), while keeping the original top-to-bottom reading order
 * intact within each column. The official tool measures actual rendered
 * text height to balance columns pixel-for-pixel; this approximates that
 * with a cheap line-count estimate, which is enough to noticeably reduce
 * the lopsided columns a plain count-split produces when items vary a lot
 * in height. Splits at the point that best balances total estimated
 * weight. */
function splitColumnsBalanced<T>(
  items: T[],
  weightOf: (item: T) => number,
): [T[], T[]] {
  const [left, right] = splitColumnsBalancedN(items, weightOf, 2);
  return [left, right ?? []];
}

/** Same idea as splitColumnsBalanced, generalized to N columns: walks the
 * list in order, closing out a column once it reaches its share of the
 * total estimated weight, so every column ends up roughly the same
 * height without reordering anything. Not a globally optimal partition
 * (a true min-max partition would need to look ahead), but a good enough
 * approximation for a character sheet, and — critically — it keeps each
 * column a contiguous, top-to-bottom slice, which a real optimal
 * partition wouldn't guarantee. */
function splitColumnsBalancedN<T>(
  items: T[],
  weightOf: (item: T) => number,
  columns: number,
): T[][] {
  if (columns <= 1 || items.length === 0) return [items];
  const weights = items.map(weightOf);
  const total = weights.reduce((a, b) => a + b, 0);
  const targetFirst = total / columns;

  // Find the split point (leaving at least one item for each remaining
  // column) whose running weight is closest to targetFirst, then recurse
  // on the remainder for the rest of the columns. A single greedy
  // fill-until-you-hit-the-target pass tends to overshoot on short lists
  // (e.g. splitting 4 items 3-and-1 instead of 2-and-2) because it can
  // only ever stop *after* crossing the target — checking every possible
  // split point up front avoids that.
  let running = 0;
  let bestIndex = 1;
  let bestDiff = Infinity;
  const maxIndex = items.length - (columns - 1);
  for (let i = 1; i <= maxIndex; i++) {
    running += weights[i - 1];
    const diff = Math.abs(running - targetFirst);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestIndex = i;
    }
  }

  const first = items.slice(0, bestIndex);
  const rest = splitColumnsBalancedN(items.slice(bestIndex), weightOf, columns - 1);
  return [first, ...rest];
}

// Estimated weight of one character's row, in "text line" units. In this
// row layout the icon runs alongside the text rather than stacking above
// or below it, so its height is only additive when the ability text is too
// short to cover it — modeled as a floor (CHAR_ICON_LINES) the name+ability
// block's own line count is compared against, same idea as the "icon
// height is free next to multi-line text" property this layout is meant to
// restore.
const CHARS_PER_ABILITY_LINE = 62;
const CHAR_ICON_LINES = 3.1;

function estimateCharacterWeight(character: Character): number {
  const abilityLines = character.ability
    ? Math.max(1, Math.ceil(character.ability.length / CHARS_PER_ABILITY_LINE))
    : 0;
  const textLines = 1 + abilityLines; // name line + ability lines
  return Math.max(textLines, CHAR_ICON_LINES) + 0.3;
}

function TeamSection({
  team,
  characters,
  icons,
}: {
  team: Team;
  characters: Character[];
  icons: Map<string, Buffer | null>;
}) {
  if (characters.length === 0) return null;
  const [left, right] = splitColumnsBalanced(characters, estimateCharacterWeight);

  return (
    <View wrap={false}>
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerLabel}>{TEAM_LABELS[team].toUpperCase()}</Text>
        <View style={styles.dividerLine} />
      </View>
      <View style={styles.teamColumns}>
        {[left, right].map((column, i) => (
          <View key={i} style={styles.teamColumn}>
            {column.map((c) => (
              <CharacterEntry key={c.id} character={c} icon={icons.get(c.id)} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function Footer({ scriptName }: { scriptName: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>{scriptName} — botchub.com (unofficial, community-made)</Text>
      <Text
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

const REF_ICON_SIZE = 20;

/** Compact single-line wake-order row for the page 2 quick reference — icon
 * + number + name only, no reminder text, so a full wake order fits in a
 * fraction of the space the detailed First/Other Night pages need. */
function ReferenceRow({
  index,
  entry,
  icon,
}: {
  index: number;
  entry: NightOrderEntry;
  icon: Buffer | null | undefined;
}) {
  return (
    <View style={styles.refRow} wrap={false}>
      <Text style={styles.refIndex}>{index}</Text>
      <View style={styles.refIconGap}>
        <IconBadge buffer={icon} fallbackLetter={entry.name} size={REF_ICON_SIZE} />
      </View>
      <Text style={styles.refName}>{entry.name}</Text>
    </View>
  );
}

const NIGHT_ICON_SIZE = 22;

/** One row of a detailed First/Other Night run sheet — icon, bold name, and
 * the storyteller's reminder-card text, numbered in official order. */
function NightRow({
  index,
  entry,
  icon,
}: {
  index: number;
  entry: NightOrderEntry;
  icon: Buffer | null | undefined;
}) {
  return (
    <View style={styles.nightRow} wrap={false}>
      <Text style={styles.nightIndex}>{index}</Text>
      <View style={styles.nightIconGap}>
        <IconBadge buffer={icon} fallbackLetter={entry.name} size={NIGHT_ICON_SIZE} />
      </View>
      <View style={styles.nightTextWrap}>
        <Text style={styles.nightName}>{entry.name}</Text>
        {entry.reminder && (
          <Text style={styles.nightReminder}>{entry.reminder}</Text>
        )}
      </View>
    </View>
  );
}

/** One full-page, single-column, detailed wake-order sheet — icon, bold
 * name, and the storyteller's reminder-card text, numbered in official
 * order. Full page width (rather than the two-column split used on page 1)
 * means each reminder needs fewer wrapped lines, which is what keeps a long
 * wake order (real scripts can carry 20+ steps once Dusk/Dawn/Minion Info/
 * Demon Info are included) fitting on a single page at this row height. */
function FullNightPage({
  scriptName,
  scriptAuthor,
  title,
  entries,
  icons,
}: {
  scriptName: string;
  scriptAuthor: string | null;
  title: string;
  entries: NightOrderEntry[];
  icons: Map<string, Buffer | null>;
}) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.byline}>{scriptName}{scriptAuthor ? ` — by ${scriptAuthor}` : ""}</Text>
      <View style={styles.nightList}>
        {entries.map((entry, i) => (
          <NightRow key={entry.key} index={i + 1} entry={entry} icon={icons.get(entry.key)} />
        ))}
      </View>
      <Footer scriptName={scriptName} />
    </Page>
  );
}

// ---- Jinxes -----------------------------------------------------------
//
// A "jinx" is a specific ruling for how two particular characters interact
// when both are in play. botchub doesn't have a data model for these yet —
// no upload flow exists (Phase 4), and the seeded script_json for existing
// scripts doesn't carry them. Rather than fabricate rulings, this reads
// them opportunistically from each script's own JSON, following the same
// per-character `jinxes: [{ id, reason }]` shape the official
// script-schema.json format uses — so a script that *does* carry real jinx
// data (a future upload, or a script JSON pasted in from elsewhere that
// already has it) renders it correctly, and a script that doesn't simply
// gets no Jinxes section, same as the night-order pages already do when
// there's no data.

interface JinxEntry {
  key: string;
  nameA: string;
  nameB: string;
  reason: string;
}

function extractJinxes(
  scriptJson: ScriptJsonEntry[],
  characters: Character[],
): JinxEntry[] {
  const nameById = new Map(characters.map((c) => [c.character_id, c.name]));
  const jinxes: JinxEntry[] = [];
  const seenPairs = new Set<string>();

  for (const entry of scriptJson) {
    if (!isCharacterObjectEntry(entry)) continue;
    const rawJinxes = entry.jinxes;
    if (!Array.isArray(rawJinxes)) continue;

    const idA = entry.id;
    const nameA = nameById.get(idA) ?? entry.name ?? idA;

    for (const raw of rawJinxes) {
      if (!raw || typeof raw !== "object") continue;
      const idB = (raw as { id?: unknown }).id;
      const reason = (raw as { reason?: unknown }).reason;
      if (typeof idB !== "string" || typeof reason !== "string" || !reason) {
        continue;
      }
      const pairKey = [idA, idB].sort().join("|");
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);
      const nameB = nameById.get(idB) ?? idB;
      jinxes.push({ key: pairKey, nameA, nameB, reason });
    }
  }

  return jinxes;
}

// ---- Fabled & Loric -----------------------------------------------------
//
// Fabled (and Loric) characters aren't assigned to a player — they're
// script-wide rule modifiers (e.g. the Djinn). The official export doesn't
// show them on the character sheet either; it lists them on the reference
// page instead, which is where they live here too.

const FABLED_ICON_SIZE = 26;

function FabledEntry({
  character,
  icon,
}: {
  character: Character;
  icon: Buffer | null | undefined;
}) {
  return (
    <View style={styles.fabledCard} wrap={false}>
      <Text style={styles.fabledName}>{character.name}</Text>
      <View style={styles.fabledIconRow}>
        <IconBadge buffer={icon} fallbackLetter={character.name} size={FABLED_ICON_SIZE} />
      </View>
      {character.ability && (
        <Text style={styles.fabledAbility}>{character.ability}</Text>
      )}
    </View>
  );
}

// ---- Standard player-count table ---------------------------------------
//
// The official Townsfolk/Outsider/Minion/Demon distribution by player
// count — fixed game-balance rules from the base game, reprinted
// identically on every physical script sheet and by essentially every
// grimoire/companion tool, not the official site's own creative content.
// Rendered full-width, in its traditional horizontal orientation (player
// counts as columns, team types as rows), across the bottom of the
// reference page.
const PLAYER_COUNT_TABLE = [
  { players: "5", townsfolk: 3, outsider: 0, minion: 1, demon: 1 },
  { players: "6", townsfolk: 3, outsider: 1, minion: 1, demon: 1 },
  { players: "7", townsfolk: 5, outsider: 0, minion: 1, demon: 1 },
  { players: "8", townsfolk: 5, outsider: 1, minion: 1, demon: 1 },
  { players: "9", townsfolk: 5, outsider: 2, minion: 1, demon: 1 },
  { players: "10", townsfolk: 7, outsider: 0, minion: 2, demon: 1 },
  { players: "11", townsfolk: 7, outsider: 1, minion: 2, demon: 1 },
  { players: "12", townsfolk: 7, outsider: 2, minion: 2, demon: 1 },
  { players: "13", townsfolk: 9, outsider: 0, minion: 3, demon: 1 },
  { players: "14", townsfolk: 9, outsider: 1, minion: 3, demon: 1 },
  { players: "15+", townsfolk: 9, outsider: 2, minion: 3, demon: 1 },
] as const;

const PLAYER_COUNT_ROWS = [
  { label: "TOWNSFOLK", key: "townsfolk" as const },
  { label: "OUTSIDERS", key: "outsider" as const },
  { label: "MINIONS", key: "minion" as const },
  { label: "DEMONS", key: "demon" as const },
];

function PlayerCountTableWide() {
  return (
    <View style={styles.playerTableWide}>
      <View style={styles.playerTableWideHeaderRow}>
        <Text style={styles.playerTableWideHeaderLabelCell}>PLAYERS</Text>
        {PLAYER_COUNT_TABLE.map((row) => (
          <Text key={row.players} style={styles.playerTableWideHeaderCell}>
            {row.players}
          </Text>
        ))}
      </View>
      {PLAYER_COUNT_ROWS.map((r, i) => (
        <View
          key={r.key}
          style={
            i === PLAYER_COUNT_ROWS.length - 1
              ? styles.playerTableWideRowLast
              : styles.playerTableWideRow
          }
        >
          <Text style={styles.playerTableWideLabelCell}>{r.label}</Text>
          {PLAYER_COUNT_TABLE.map((row) => (
            <Text key={row.players} style={styles.playerTableWideCell}>
              {row[r.key]}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function ReferencePage({
  scriptName,
  scriptAuthor,
  firstNight,
  otherNight,
  jinxes,
  fabled,
  icons,
}: {
  scriptName: string;
  scriptAuthor: string | null;
  firstNight: NightOrderEntry[];
  otherNight: NightOrderEntry[];
  jinxes: JinxEntry[];
  fabled: Character[];
  icons: Map<string, Buffer | null>;
}) {
  const hasJinxes = jinxes.length > 0;
  const hasFabled = fabled.length > 0;

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Quick Reference</Text>
      <Text style={styles.byline}>{scriptName}{scriptAuthor ? ` — by ${scriptAuthor}` : ""}</Text>

      <View style={styles.refThreeCol}>
        {/* Left — First Night wake order. */}
        <View style={styles.refColSide}>
          {firstNight.length > 0 && (
            <>
              <Text style={styles.colHeading}>FIRST NIGHT</Text>
              {firstNight.map((entry, i) => (
                <ReferenceRow
                  key={entry.key}
                  index={i + 1}
                  entry={entry}
                  icon={icons.get(entry.key)}
                />
              ))}
            </>
          )}
        </View>

        {/* Middle — one combined "Fabled & Jinxes" header (shown only when
            the script actually has either), then each section that has
            content. A small sub-heading only appears when both sections
            are present, to tell them apart — with just one, the combined
            header above already says what it is. The player-count table
            moves to the bottom of the page, full-width, below. */}
        <View style={styles.refColMiddle}>
          {(hasJinxes || hasFabled) && (
            <Text style={styles.colHeading}>FABLED & JINXES</Text>
          )}

          {hasJinxes && (
            <>
              {hasFabled && <Text style={styles.subHeading}>Jinxes</Text>}
              {jinxes.map((j) => (
                <View key={j.key} style={styles.jinxRow} wrap={false}>
                  <Text style={styles.jinxNames}>
                    {j.nameA} & {j.nameB}
                  </Text>
                  <Text style={styles.jinxReason}>{j.reason}</Text>
                </View>
              ))}
            </>
          )}

          {hasFabled && (
            <>
              {hasJinxes && (
                <Text style={[styles.subHeading, { marginTop: 6 }]}>
                  Fabled
                </Text>
              )}
              {fabled.map((c) => (
                <FabledEntry key={c.id} character={c} icon={icons.get(c.id)} />
              ))}
            </>
          )}
        </View>

        {/* Right — Other Nights wake order. */}
        <View style={styles.refColSide}>
          {otherNight.length > 0 && (
            <>
              <Text style={styles.colHeading}>OTHER NIGHTS</Text>
              {otherNight.map((entry, i) => (
                <ReferenceRow
                  key={entry.key}
                  index={i + 1}
                  entry={entry}
                  icon={icons.get(entry.key)}
                />
              ))}
            </>
          )}
        </View>
      </View>

      {/* Bottom — the standard player-count table, full width, in its
          traditional horizontal orientation. */}
      <Text style={[styles.colHeading, { marginTop: 10 }]}>PLAYER COUNT</Text>
      <PlayerCountTableWide />

      <Footer scriptName={scriptName} />
    </Page>
  );
}

async function ScriptPdfDocument({
  scriptName,
  scriptAuthor,
  characters,
  scriptJson,
}: {
  scriptName: string;
  scriptAuthor: string | null;
  characters: Character[];
  scriptJson: ScriptJsonEntry[];
}) {
  registerFonts();

  const byTeam = SHEET_TEAM_ORDER.map((team) => ({
    team,
    characters: characters.filter((c) => c.team === team),
  })).filter((group) => group.characters.length > 0);

  const fabled = characters.filter(
    (c) => c.team === "fabled" || c.team === "loric",
  );

  const { firstNight, otherNight } = buildNightOrder(characters);
  const jinxes = extractJinxes(scriptJson, characters);
  const icons = await loadAllIcons(characters, [...firstNight, ...otherNight]);

  const showReferencePage =
    firstNight.length > 0 ||
    otherNight.length > 0 ||
    jinxes.length > 0 ||
    fabled.length > 0;

  return (
    <Document title={scriptName} author={scriptAuthor ?? undefined}>
      {/* Page 1 — character sheet, every character on the script. */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{scriptName}</Text>
        {scriptAuthor && <Text style={styles.byline}>by {scriptAuthor}</Text>}
        {byTeam.map(({ team, characters: teamCharacters }) => (
          <TeamSection
            key={team}
            team={team}
            characters={teamCharacters}
            icons={icons}
          />
        ))}
        <Footer scriptName={scriptName} />
      </Page>

      {/* Page 2 — First Night / Other Nights wake order on the sides,
          Jinxes + Fabled/Loric + the standard player-count table in the
          middle. Player count always has content, but the whole page is
          skipped for a script with none of the other three either, same
          honesty rule as the night pages below. */}
      {showReferencePage && (
        <ReferencePage
          scriptName={scriptName}
          scriptAuthor={scriptAuthor}
          firstNight={firstNight}
          otherNight={otherNight}
          jinxes={jinxes}
          fabled={fabled}
          icons={icons}
        />
      )}

      {/* Page 3 — First Night, full detail. */}
      {firstNight.length > 0 && (
        <FullNightPage
          scriptName={scriptName}
          scriptAuthor={scriptAuthor}
          title="First Night"
          entries={firstNight}
          icons={icons}
        />
      )}

      {/* Page 4 — Other Nights, full detail. */}
      {otherNight.length > 0 && (
        <FullNightPage
          scriptName={scriptName}
          scriptAuthor={scriptAuthor}
          title="Other Nights"
          entries={otherNight}
          icons={icons}
        />
      )}
    </Document>
  );
}

/** Renders the full script-sheet PDF to a Buffer. */
export async function renderScriptPdf({
  scriptName,
  scriptAuthor,
  characters,
  scriptJson,
}: {
  scriptName: string;
  scriptAuthor: string | null;
  characters: Character[];
  scriptJson: ScriptJsonEntry[];
}): Promise<Buffer> {
  const { renderToBuffer } = await import("@react-pdf/renderer");
  const doc = await ScriptPdfDocument({
    scriptName,
    scriptAuthor,
    characters,
    scriptJson,
  });
  return renderToBuffer(doc);
}
