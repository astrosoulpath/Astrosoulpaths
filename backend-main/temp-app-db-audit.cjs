require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {

  const identity = await prisma.$queryRawUnsafe(
    SELECT
      current_database() AS database_name,
      current_user AS current_user,
      inet_server_addr()::text AS server_address,
      inet_server_port() AS server_port
  );

  console.log("APP_DB_IDENTITY");
  console.dir(identity, { depth: null });


  const tables = await prisma.$queryRawUnsafe(
    SELECT COUNT(*)::int AS table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
  );

  console.log("APP_TABLE_COUNT");
  console.dir(tables, { depth: null });


  const migrations = await prisma.$queryRawUnsafe(
    SELECT COUNT(*)::int AS migration_rows
    FROM "_prisma_migrations"
  );

  console.log("APP_MIGRATION_ROWS");
  console.dir(migrations, { depth: null });


  const important = {};

  const candidates = [
    "User",
    "Astrologer",
    "Consultation",
    "Wallet",
    "WalletLedger",
    "Payment",
    "MarketplaceProduct",
    "MarketplaceOrder",
    "RechargePack"
  ];

  for (const table of candidates) {

    const exists = await prisma.$queryRawUnsafe(
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ''
      ) AS exists
    );

    if (!exists[0]?.exists) {
      important[table] = "TABLE_NOT_PRESENT";
      continue;
    }

    try {
      const rows = await prisma.$queryRawUnsafe(
        'SELECT COUNT(*)::int AS count FROM "' + table + '"'
      );

      important[table] = rows[0]?.count ?? 0;
    }
    catch (error) {
      important[table] = "COUNT_FAILED";
    }
  }

  console.log("APP_IMPORTANT_TABLE_COUNTS");
  console.dir(important, { depth: null });


  const column = await prisma.$queryRawUnsafe(
    SELECT
      column_name,
      data_type,
      udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Astrologer'
      AND column_name = 'consultationCategories'
  );

  console.log("CONSULTATION_CATEGORY_COLUMN");
  console.dir(column, { depth: null });
}

main()
  .catch(e => {
    console.error("APP_DB_AUDIT_FAILED");
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
