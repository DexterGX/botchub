import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Serves a script's raw script_json so it can be pulled into
// script.bloodontheclocktower.com, Townsquare, or any other compatible
// tool. CORS is wide open on purpose — this is public, read-only game data,
// and locking it down is exactly the kind of thing that broke this feature
// on other script sites (see the AdmiralGT/botc-scripts issue tracker).
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("scripts")
    .select("script_json")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "Failed to load script." },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  if (!data) {
    return NextResponse.json(
      { error: "Script not found." },
      { status: 404, headers: CORS_HEADERS }
    );
  }

  return NextResponse.json(data.script_json, { headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
