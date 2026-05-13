import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function toSerializable(value: unknown): unknown {
  if (typeof value === 'bigint') return Number(value);
  if (Array.isArray(value)) return value.map((v) => toSerializable(v));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, toSerializable(v)]),
    );
  }
  return value;
}

async function main() {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE "productName" IS NULL OR BTRIM("productName") = '') AS product_name_blank,
      COUNT(*) FILTER (WHERE "ingredientName" IS NULL OR BTRIM("ingredientName") = '') AS ingredient_name_blank,
      COUNT(*) FILTER (WHERE "company" IS NULL OR BTRIM("company") = '') AS company_blank,
      COUNT(*) FILTER (WHERE "standardCode" IS NULL OR BTRIM("standardCode") = '') AS standard_code_blank,
      COUNT(*) FILTER (WHERE "insuranceCode" IS NULL OR BTRIM("insuranceCode") = '') AS insurance_code_blank,
      COUNT(*) FILTER (WHERE "atcCode" IS NULL OR BTRIM("atcCode") = '') AS atc_code_blank,
      COUNT(*) FILTER (WHERE "priceLabel" IS NULL OR BTRIM("priceLabel") = '') AS price_label_blank,
      COUNT(*) FILTER (WHERE "reimbursement" IS NULL OR BTRIM("reimbursement") = '') AS reimbursement_blank,
      COUNT(*) FILTER (WHERE "type" IS NULL OR BTRIM("type") = '') AS type_blank,
      COUNT(*) FILTER (WHERE "releaseDate" IS NULL OR BTRIM("releaseDate") = '') AS release_date_blank,
      COUNT(*) FILTER (WHERE "efficacy" IS NULL OR BTRIM("efficacy") = '') AS efficacy_blank,
      COUNT(*) FILTER (WHERE "precaution" IS NULL OR BTRIM("precaution") = '') AS precaution_blank,
      COUNT(*) FILTER (WHERE "identification" IS NULL OR BTRIM("identification") = '') AS identification_blank,
      COUNT(*) FILTER (WHERE "durInfo" IS NULL OR BTRIM("durInfo") = '') AS dur_info_blank,
      COUNT(*) FILTER (WHERE "usageFrequency" IS NULL OR "usageFrequency" <= 0) AS usage_blank
    FROM "Drug"
  `);

  console.log(JSON.stringify(toSerializable(rows[0] || {}), null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
