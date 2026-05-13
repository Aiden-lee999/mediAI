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
  const before = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
    SELECT
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

  const updated = await prisma.$executeRawUnsafe(`
    UPDATE "Drug"
    SET
      "productName" = CASE
        WHEN "productName" IS NULL OR BTRIM("productName") = '' THEN '미상약품-' || SUBSTR("id", 1, 8)
        ELSE BTRIM("productName")
      END,
      "ingredientName" = CASE
        WHEN "ingredientName" IS NULL OR BTRIM("ingredientName") = '' THEN '성분정보확인중'
        ELSE BTRIM("ingredientName")
      END,
      "company" = CASE
        WHEN "company" IS NULL OR BTRIM("company") = '' THEN '제조사정보확인중'
        ELSE BTRIM("company")
      END,
      "standardCode" = CASE
        WHEN "standardCode" IS NULL OR BTRIM("standardCode") = '' THEN
          COALESCE(NULLIF(REGEXP_REPLACE(COALESCE("insuranceCode", ''), '\\D', '', 'g'), ''), 'UNK-' || SUBSTR("id", 1, 12))
        ELSE BTRIM("standardCode")
      END,
      "insuranceCode" = CASE
        WHEN "insuranceCode" IS NULL OR BTRIM("insuranceCode") = '' THEN
          COALESCE(NULLIF(REGEXP_REPLACE(COALESCE("standardCode", ''), '\\D', '', 'g'), ''), BTRIM("standardCode"), 'UNK-' || SUBSTR("id", 1, 12))
        ELSE BTRIM("insuranceCode")
      END,
      "atcCode" = CASE
        WHEN "atcCode" IS NULL OR BTRIM("atcCode") = '' THEN 'ATC-미분류'
        ELSE BTRIM("atcCode")
      END,
      "priceLabel" = CASE
        WHEN "priceLabel" IS NULL OR BTRIM("priceLabel") = '' THEN '0원'
        ELSE BTRIM("priceLabel")
      END,
      "reimbursement" = CASE
        WHEN "reimbursement" IS NULL OR BTRIM("reimbursement") = '' THEN '급여구분확인중'
        ELSE BTRIM("reimbursement")
      END,
      "type" = CASE
        WHEN "type" IS NULL OR BTRIM("type") = '' THEN '구분확인중'
        ELSE BTRIM("type")
      END,
      "releaseDate" = CASE
        WHEN "releaseDate" IS NULL OR BTRIM("releaseDate") = '' THEN '허가일확인중'
        ELSE BTRIM("releaseDate")
      END,
      "efficacy" = CASE
        WHEN "efficacy" IS NULL OR BTRIM("efficacy") = '' THEN '효능효과 정보 확인중'
        ELSE "efficacy"
      END,
      "precaution" = CASE
        WHEN "precaution" IS NULL OR BTRIM("precaution") = '' THEN '주의사항 정보 확인중'
        ELSE "precaution"
      END,
      "identification" = CASE
        WHEN "identification" IS NULL OR BTRIM("identification") = '' THEN '식별정보 확인중'
        ELSE "identification"
      END,
      "durInfo" = CASE
        WHEN "durInfo" IS NULL OR BTRIM("durInfo") = '' THEN '["DUR 점검정보 확인중"]'
        ELSE "durInfo"
      END,
      "usageFrequency" = CASE
        WHEN "usageFrequency" IS NULL OR "usageFrequency" <= 0 THEN 1
        ELSE "usageFrequency"
      END
  `);

  const after = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
    SELECT
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

  console.log(
    JSON.stringify(
      toSerializable({
        updatedRows: Number(updated),
        before: before[0] || {},
        after: after[0] || {},
      }),
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
