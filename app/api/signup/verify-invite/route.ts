import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { code } = await request.json();

  const valid = code === process.env.SIGNUP_INVITE_CODE;

  return NextResponse.json({ valid });
}
