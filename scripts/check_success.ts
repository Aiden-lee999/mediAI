import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
    try {
        const total = await prisma.drug.count();
        
        // 효능/주의사항이 '정보 없음'이 아니고 null이 아닌 경우 (크롤링 성공)
        const successEfficacy = await prisma.drug.count({ 
            where: { 
                efficacy: { 
                    not: { equals: null }, 
                    notIn: ['정보 없음'] 
                } 
            } 
        });

        // 가격 정보가 '조회불가'가 아니고 null이 아닌 경우 (크롤링 성공)
        const successPrice = await prisma.drug.count({ 
            where: { 
                priceLabel: { 
                    not: { equals: null }, 
                    notIn: ['조회불가'] 
                } 
            } 
        });

        console.log("===============================");
        console.log("📈 실제 크롤링 성공(유효 데이터) 현황");
        console.log("===============================");
        console.log(`🔹 총 의약품 대상 수: \t${total}건`);
        console.log(`🔹 효능 정보 크롤링 성공: \t${successEfficacy}건`);
        console.log(`🔹 약가 정보 크롤링 성공: \t${successPrice}건`);
        console.log("===============================");
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}
main();