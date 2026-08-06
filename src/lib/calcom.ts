// Thin wrapper around Cal.com's v2 API (https://cal.com/docs/api-reference/v2)
// used to check real availability and book a real meeting from inside a live call.

const CAL_BASE_URL = "https://api.cal.com/v2";

function calHeaders(apiVersion: string) {
  const apiKey = process.env.CALCOM_API_KEY;
  if (!apiKey) throw new Error("CALCOM_API_KEY is not set in .env");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "cal-api-version": apiVersion,
  };
}

function eventTypeId() {
  const id = process.env.CALCOM_EVENT_TYPE_ID;
  if (!id) throw new Error("CALCOM_EVENT_TYPE_ID is not set in .env");
  return id;
}

export type CalSlot = { start: string };

// Returns real open slots for the configured event type, soonest first.
export async function getAvailableSlots(daysAhead = 14): Promise<CalSlot[]> {
  const start = new Date();
  const end = new Date(start.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  const url = new URL(`${CAL_BASE_URL}/slots`);
  url.searchParams.set("eventTypeId", eventTypeId());
  url.searchParams.set("start", start.toISOString());
  url.searchParams.set("end", end.toISOString());
  url.searchParams.set("timeZone", "UTC");

  const res = await fetch(url, { headers: calHeaders("2024-09-04") });
  if (!res.ok) throw new Error(`Cal.com slots failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: Record<string, CalSlot[]> };
  return Object.values(json.data)
    .flat()
    .sort((a, b) => a.start.localeCompare(b.start));
}

export type CalBooking = { id: number; uid: string; start: string };

// Actually reserves the slot. `startIso` should be one of the values returned
// by getAvailableSlots — Cal.com rejects the request if the slot isn't open.
export async function createBooking(
  startIso: string,
  attendee: { name: string; email: string; timeZone?: string },
): Promise<CalBooking> {
  const res = await fetch(`${CAL_BASE_URL}/bookings`, {
    method: "POST",
    headers: calHeaders("2026-02-25"),
    body: JSON.stringify({
      start: startIso,
      eventTypeId: Number(eventTypeId()),
      attendee: {
        name: attendee.name,
        email: attendee.email,
        timeZone: attendee.timeZone || "UTC",
      },
    }),
  });
  if (!res.ok) throw new Error(`Cal.com booking failed: ${res.status} ${await res.text()}`);
  const json = (await res.json()) as { data: CalBooking };
  return json.data;
}
