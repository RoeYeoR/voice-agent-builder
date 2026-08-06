import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const leads = await db.lead.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ leads });
}

export async function POST(req: NextRequest) {
  try {
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
  } catch (err) {
    console.error("POST /api/leads failed:", err);
    const message = err instanceof Error ? err.message : "Unexpected server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
