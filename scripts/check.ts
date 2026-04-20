import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    try {
        const total = await prisma.drug.count();
        const eps = await prisma.drug.count({ where: { efficacy: { not: null } } });
        const pps = await prisma.drug.count({ where: { priceLabel: { not: null } } });
        const pdumps = await prisma.drug.count({ where: { publicApiDump: { not: null } } });

        console.log("===============================");
        console.log("📊 크롤링 데이터 적재 현황");
        console.log("===============================");
        console.log(`🔹 총 의약품 수: \t${total}건`);
        console.log(`🔹 공공 API 덤프 완료: \t${pdumps}건`);
        console.log(`🔹 효능/주의사항 완료: \t${eps}건`);
        console.log(`🔹 약가(가격) 완료: \t${pps}건`);
        console.log("===============================");
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}
main();