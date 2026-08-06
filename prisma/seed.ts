import { db } from "../src/lib/db";

async function main() {
  await db.lead.createMany({
    data: [
      {
        name: "Dana Cohen",
        phone: "+15555550101",
        email: "dana@example.com",
        notes: "Inquired about a 3BR in the north side, open house sign-up.",
      },
      {
        name: "Omer Levi",
        phone: "+15555550102",
        email: "omer@example.com",
        notes: "Looking to sell current apartment within 6 months.",
      },
    ],
    skipDuplicates: true,
  });
}

main()
  .then(async () => {
    console.log("Seeded sample leads.");
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
