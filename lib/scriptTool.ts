import { gzipSync } from "zlib";

/**
 * Builds a deep link into the official Script Tool
 * (script.bloodontheclocktower.com) that pre-loads a script, matching the
 * "Open in Script Tool" behavior on other community sites.
 *
 * Reverse-engineered from the live Script Tool app (its bundle reads
 * `?script=` via `URLSearchParams` and decodes the value through the
 * browser's native `DecompressionStream("gzip")`) since this isn't publicly
 * documented anywhere. The format is: JSON.stringify the script array, gzip
 * it, base64-encode the compressed bytes, then percent-encode that base64
 * string before putting it in the query string.
 *
 * That last step matters and is easy to get wrong: base64 can contain `+`
 * characters, and an unencoded `+` in a query string is interpreted as a
 * literal space by `URLSearchParams` — silently corrupting the payload so
 * the Script Tool falls back to an empty script with no error. Always go
 * through `encodeURIComponent`, never template the base64 in directly.
 *
 * Verified end-to-end against the live site (not just decoded locally):
 * navigated a browser to a URL built by this exact logic and confirmed the
 * Script Tool actually rendered the correct script.
 */
export function buildScriptToolUrl(scriptJson: unknown): string {
  const json = JSON.stringify(scriptJson);
  const compressed = gzipSync(Buffer.from(json, "utf-8"));
  const base64 = compressed.toString("base64");
  return `https://script.bloodontheclocktower.com/?script=${encodeURIComponent(base64)}`;
}
