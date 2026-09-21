import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Server Actions default to a 1MB request body, which is plenty for
    // /scripts/new's single-file upload but far too small for
    // /scripts/bulk-upload's whole-folder-at-once submit (see
    // bulkUploadScriptsAction in lib/script-upload-actions.ts) — each
    // script JSON is capped at 200KB individually
    // (MAX_SCRIPT_JSON_BYTES), but a batch of them adds up fast. 25MB
    // comfortably covers a real one-sitting import even of fairly large
    // homebrew scripts, without raising it so far that a stray huge
    // request becomes a real resource concern.
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  images: {
    remotePatterns: [
      {
        // Official character token icons, from the same MIT-licensed
        // townsquare asset set used for ability text (see
        // supabase/migrations/20260831020000_character_library_expansion.sql).
        // Worth moving to Supabase Storage once this app has a way to
        // write to it.
        protocol: "https",
        hostname: "raw.githubusercontent.com",
        pathname: "/bra1n/townsquare/**",
      },
      {
        // Icons for official characters not covered by the townsquare set
        // above (see supabase/migrations/20260901000000_carousel_characters.sql)
        // — hotlinked from the official Blood on the Clocktower wiki, whose
        // MediaWiki-hosted image URLs are stable long-term. Same Storage
        // migration caveat as the pattern above applies here too.
        protocol: "https",
        hostname: "wiki.bloodontheclocktower.com",
        pathname: "/images/**",
      },
    ],
  },
};

export default nextConfig;
