import { NextResponse } from "next/server";
import {
  getCharacterByCharacterId,
  getCharactersForScript,
  getJinxesForCharacterIds,
  getScriptById,
} from "@/lib/queries";
import { renderScriptPdf } from "@/lib/scriptPdf";
import { isMetaEntry, type ScriptJsonMeta } from "@/lib/types";

// Needs real Node (font files, sharp, pdfkit) — not the Edge runtime.
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const script = await getScriptById(id);
  if (!script) {
    return NextResponse.json({ error: "Script not found." }, { status: 404 });
  }

  const characters = await getCharactersForScript(id);
  const globalJinxes = await getJinxesForCharacterIds(characters.map((c) => c.id));
  // Fetched unconditionally on every request rather than gated on "does
  // this script have jinxes" — that check needs scriptJson/characters/
  // globalJinxes together anyway (see resolveJinxesForScript), so it's
  // simpler to always have Djinn on hand and let withImpliedDjinn (called
  // inside renderScriptPdf) decide whether to use it.
  const djinnCharacter = await getCharacterByCharacterId("djinn");
  const meta = script.script_json.find(isMetaEntry) as
    ScriptJsonMeta | undefined;
  const scriptName = meta?.name || script.name;
  const scriptAuthor = script.author ?? meta?.author ?? null;

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderScriptPdf({
      scriptName,
      scriptVersion: script.version,
      scriptAuthor,
      characters,
      scriptJson: script.script_json,
      globalJinxes,
      bootleggerRules: script.bootlegger_rules,
      djinnCharacter,
    });
  } catch (error) {
    console.error("PDF generation failed", error);
    return NextResponse.json(
      { error: "Failed to generate PDF." },
      { status: 500 },
    );
  }

  const filename = `${scriptName.replace(/[^\w\- ]+/g, "").trim() || "script"}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
