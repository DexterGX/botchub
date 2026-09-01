import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
