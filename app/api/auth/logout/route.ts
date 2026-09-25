import { NextResponse } from "next/server";
import { clearAdminSession, clearMemberSession } from "@/lib/auth";

export async function POST() {
  await clearAdminSession();
  await clearMemberSession();
  return NextResponse.json({ ok: true });
}
