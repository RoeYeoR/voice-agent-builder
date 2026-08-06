import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const leads = await db.lead.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ leads });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, phone, email, notes } = body as {
    name?: string;
    phone?: string;
    email?: string;
    notes?: string;
  };

  if (!name || !phone) {
    return NextResponse.json({ error: "name and phone are required" }, { status: 400 });
  }

  const lead = await db.lead.create({ data: { name, phone, email, notes } });
  return NextResponse.json({ lead });
}
