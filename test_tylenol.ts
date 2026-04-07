import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.drug.findMany({where: {productName: {contains: '타이레놀'}}}).then(r => console.log('Tylenol mapped: ' + r.length));
