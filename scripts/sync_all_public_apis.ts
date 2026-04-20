import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import { PUBLIC_DRUG_API_ENDPOINTS, DATA_GO_KR_FALLBACK_SERVICE_KEY } from '../src/lib/publicDrugApiCatalog';

const prisma = new PrismaClient();

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function syncAllApiDataLossless() {
  console.log('🚀 [Data] Fetch API starts...');

  while (true) {
    const drugs = await prisma.drug.findMany({
      where: {
        OR: [
          { publicApiDump: null },
          // If you have a specific pending marker, include it here:
          { publicApiDump: { endsWith: 'status":"pending"}}}' } }
        ]
      },
      take: 100,
    });

    if (drugs.length === 0) {
      console.log("✅ All public API data fetching completed.");
      break;
    }

    for (const drug of drugs) {
    console.log(`\n⏳ Fetching: [${drug.productName}]`);

    const aggregatedDump = {
      productRef: drug.productName,
      ingredientRef: drug.ingredientName,
      timestamp: new Date().toISOString(),
      apiResponses: {} as Record<string, any>
    };

    const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY || DATA_GO_KR_FALLBACK_SERVICE_KEY;

    for (const endpoint of PUBLIC_DRUG_API_ENDPOINTS) {

      for (const op of endpoint.operations) {
        const queryParam = endpoint.serviceName.includes('성분') ? 'ingr_name' : 'item_name';
        const queryVal = encodeURIComponent(drug.productName);

        let url = `${endpoint.baseUrl}${op}?serviceKey=${serviceKey}&${queryParam}=${queryVal}`;
        if (endpoint.defaultFormat === 'JSON+XML') url += '&type=json';

        try {
          const apiRes = await axios.get(url, { timeout: 10000 });
          aggregatedDump.apiResponses[op] = { status: 'success', url_called: url, data: apiRes.data };
        } catch (error: any) {
          aggregatedDump.apiResponses[op] = { status: 'error', url_called: url, reason: error.message };
        }
        await delay(50);
      }
    }

    const publicApiDumpString = JSON.stringify(aggregatedDump);
    
    await prisma.drug.update({
      where: { id: drug.id },
      data: { publicApiDump: publicApiDumpString, updatedAt: new Date() }
    });

    console.log(`✅ [${drug.productName}] Size: ${publicApiDumpString.length} bytes`);
    }
  }
}

syncAllApiDataLossless().catch(console.error).finally(() => prisma.$disconnect());
