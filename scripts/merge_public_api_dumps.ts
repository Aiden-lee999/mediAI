import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function mergePublicApiData() {
  console.log('--- Starting Public API Data Merge ---');
  
  // 1. Build a map of Item Seq (품목기준코드) -> Drug ID from SQLite `rawJson` DB
  console.log('1. Building mapping from existing DB (this may take a minute)...');
  const allDrugs = await prisma.drug.findMany({ select: { id: true, rawJson: true }, where: { rawJson: { not: null } } });
  
  const seqToId = new Map<string, string>();
  let matchableCount = 0;
  for (const d of allDrugs) {
    if (!d.rawJson) continue;
    try {
      const obj = JSON.parse(d.rawJson);
      const seq = obj['품목기준코드'] || obj['ITEM_SEQ'] || obj['itemSeq'];
      if (seq) {
        seqToId.set(seq.toString().trim(), d.id);
        matchableCount++;
      }
    } catch(e) {}
  }
  console.log(`Finished mapping. Evaluated ${allDrugs.length} drugs -> Found ${matchableCount} valid 품목기준코드 mappings.`);

  // 2. Read downloaded APIs
  console.log('\n2. Reading bulk downloaded JSON API items...');
  const dumpsDir = path.join(process.cwd(), 'data', 'public_api_dumps');
  
  const mergedData = new Map<string, any>(); // Drug ID -> combined API object

  if (!fs.existsSync(dumpsDir)) {
     console.error('No dumps directory found. Run bulk_localize_public_apis.ts first.');
     process.exit(1);
  }

  const services = fs.readdirSync(dumpsDir);
  for (const srv of services) {
    const srvPath = path.join(dumpsDir, srv);
    if (!fs.statSync(srvPath).isDirectory()) continue;
    
    let totalItemsLoadedForSrv = 0;
    const files = fs.readdirSync(srvPath).filter(f => f.endsWith('.json') && f !== 'meta.json');
    for (const f of files) {
      const items = JSON.parse(fs.readFileSync(path.join(srvPath, f), 'utf8'));
      for (const item of items) {
        
        let seq = null;
        if (srv === 'DrbBundleInfoService02') {
          seq = item?.item?.cnsgnItemSeq || item?.item?.trustItemSeq;
        } else {
          seq = item.ITEM_SEQ || item.itemSeq || item.item_seq;
        }

        if (seq) {
          const strSeq = seq.toString().trim();
          const targetId = seqToId.get(strSeq);
          if (targetId) {
             let existing = mergedData.get(targetId);
             if (!existing) {
                 existing = { timestamp: new Date().toISOString(), apiResponses: {} };
             }
             // Merge inside
             if (!existing.apiResponses[srv]) existing.apiResponses[srv] = [];
             existing.apiResponses[srv].push(item);
             mergedData.set(targetId, existing);
          }
        }
        totalItemsLoadedForSrv++;
      }
    }
    console.log(`  -> [${srv}] Loaded & mapped ${totalItemsLoadedForSrv} records.`);
  }

  console.log(`\n3. Consolidating into SQLite... ${mergedData.size} distinct drugs identified for update.`);
  
  let idx = 0;
  for (const [drugId, aggregateObj] of mergedData.entries()) {
      await prisma.drug.update({
          where: { id: drugId },
          data: { publicApiDump: JSON.stringify(aggregateObj) }
      });
      idx++;
      if (idx % 1000 === 0) {
          console.log(`  Updated ${idx} / ${mergedData.size} drugs...`);
      }
  }

  console.log('--- Merge Complete ---');
}

mergePublicApiData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());