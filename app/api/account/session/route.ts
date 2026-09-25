import { NextResponse } from "next/server";
import { getActiveMember } from "@/lib/member";

export async function GET() {
  try { return NextResponse.json({ account: await getActiveMember() }); }
  catch { return NextResponse.json({ account: null }); }
}
