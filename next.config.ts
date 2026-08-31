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
    ],
  },
};

export default nextConfig;
