import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const productSourceDir = path.join(root, 'data', 'public_api_dumps', '식품의약품안전처_의약품안전사용서비스(DUR)품목정보');
const ingredientSourceDir = path.join(root, 'data', 'public_api_dumps', '식품의약품안전처_의약품안전사용서비스(DUR)성분정보');
const outputPath = path.join(root, 'data', 'public_api_dumps', 'drug_dur_index.json');

const sources = [
  [productSourceDir, 'getPwnmTabooInfoList03.all.json', 'pregnancyContraindication', '임부금기', 'product'],
  [productSourceDir, 'getUsjntTabooInfoList03.all.json', 'interactionContraindication', '병용금기', 'product'],
  [productSourceDir, 'getSpcifyAgrdeTabooInfoList03.all.json', 'ageContraindication', '특정연령대금기', 'product'],
  [productSourceDir, 'getOdsnAtentInfoList03.all.json', 'elderlyCaution', '노인주의', 'product'],
  [productSourceDir, 'getCpctyAtentInfoList03.all.json', 'doseCaution', '용량주의', 'product'],
  [productSourceDir, 'getMdctnPdAtentInfoList03.all.json', 'durationCaution', '투여기간주의', 'product'],
  [productSourceDir, 'getEfcyDplctInfoList03.all.json', 'efficacyDuplicate', '효능군중복주의', 'product'],
  [productSourceDir, 'getSeobangjeongPartitnAtentInfoList03.all.json', 'sustainedReleaseSplitCaution', '서방정분할주의', 'product'],
  [ingredientSourceDir, 'getPwnmTabooInfoList02.all.json', 'pregnancyContraindication', '임부금기', 'ingredient'],
  [ingredientSourceDir, 'getUsjntTabooInfoList02.all.json', 'interactionContraindication', '병용금기', 'ingredient'],
  [ingredientSourceDir, 'getSpcifyAgrdeTabooInfoList02.all.json', 'ageContraindication', '특정연령대금기', 'ingredient'],
  [ingredientSourceDir, 'getOdsnAtentInfoList02.all.json', 'elderlyCaution', '노인주의', 'ingredient'],
  [ingredientSourceDir, 'getCpctyAtentInfoList02.all.json', 'doseCaution', '용량주의', 'ingredient'],
  [ingredientSourceDir, 'getMdctnPdAtentInfoList02.all.json', 'durationCaution', '투여기간주의', 'ingredient'],
  [ingredientSourceDir, 'getEfcyDplctInfoList02.all.json', 'efficacyDuplicate', '효능군중복주의', 'ingredient'],
];

function text(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === 'string' && value.trim()) return value.replace(/\s+/g, ' ').trim();
  }
  return '';
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

const rows = [];
for (const [sourceDir, file, section, defaultTypeName, sourceLevel] of sources) {
  const filePath = path.join(sourceDir, file);
  try {
    await fs.access(filePath);
  } catch {
    console.warn(`SKIP missing DUR source: ${filePath}`);
    continue;
  }
  const raw = JSON.parse(await fs.readFile(filePath, 'utf8'));
  if (!Array.isArray(raw)) continue;

  for (const item of raw) {
    const itemName = text(item, ['ITEM_NAME', 'itemName']);
    const itemSeq = digits(text(item, ['ITEM_SEQ', 'itemSeq']));
    const company = text(item, ['ENTP_NAME', 'entpName']);
    const ingredientName = text(item, ['INGR_KOR_NAME', 'INGR_NAME', 'MAIN_INGR', 'ingrName']);
    const content = text(item, ['PROHBT_CONTENT', 'prohbtContent', 'REMARK', 'NOTE']);
    const mixtureItemName = text(item, ['MIXTURE_ITEM_NAME', 'mixtureItemName']);
    const mixtureIngredientName = text(item, ['MIXTURE_INGR_KOR_NAME', 'MIXTURE_INGR_NAME', 'mixtureIngrKorName']);

    if (!itemSeq && !itemName && !ingredientName) continue;

    rows.push({
      section,
      typeName: text(item, ['TYPE_NAME', 'typeName']) || defaultTypeName,
      itemSeq,
      itemName,
      company,
      ingredientCode: text(item, ['INGR_CODE', 'ingrCode']),
      ingredientName,
      content,
      mixtureItemSeq: digits(text(item, ['MIXTURE_ITEM_SEQ', 'mixtureItemSeq'])),
      mixtureItemName,
      mixtureIngredientName,
      mixtureCompany: text(item, ['MIXTURE_ENTP_NAME', 'mixtureEntpName']),
      className: text(item, ['CLASS_NAME', 'className', 'MIXTURE_CLASS_NAME']),
      formName: text(item, ['FORM_NAME', 'formName']),
      notificationDate: text(item, ['NOTIFICATION_DATE', 'notificationDate']),
      changeDate: text(item, ['CHANGE_DATE', 'changeDate']),
      sourceLevel,
    });
  }
}

await fs.writeFile(outputPath, JSON.stringify(rows));
const stat = await fs.stat(outputPath);
console.log(`Wrote ${rows.length} DUR rows to ${outputPath} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
