import { searchProductsByIngredient } from './src/lib/drugPricesCsv';
console.log(Buffer.from('아세트아미노펜').toString('hex'));
searchProductsByIngredient('아세트아미노펜').then(res => console.log(res)).catch(console.error);
