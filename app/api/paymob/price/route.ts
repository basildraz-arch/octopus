import { NextResponse } from "next/server";

export async function GET() {
  const priceEgp = Number(process.env.SUBSCRIPTION_PRICE_EGP);

  return NextResponse.json({ priceEgp });
}
