import { NextResponse } from "next/server";
import { clearAdminSession, clearMemberSession } from "@/lib/auth";

export async function POST() {
  await clearMemberSession();
  await clearAdminSession();
  return NextResponse.json({ ok: true });
}
