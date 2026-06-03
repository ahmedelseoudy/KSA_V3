import XLSX from 'xlsx';

// Read the Excel file
const workbook = XLSX.readFile('./Test_Data/PO#51Z7TZRK.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

console.log('=== Excel File Analysis ===');
console.log('Total rows:', rows.length);
console.log('Column names:', Object.keys(rows[0] || {}));
console.log('\n=== First 3 rows ===');

function pickCol(row, keys) {
  for (const k of keys) {
    if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') return row[k];
    const lower = k.toLowerCase();
    const found = Object.keys(row).find((rk) => rk.toLowerCase() === lower);
    if (found && row[found] !== undefined && row[found] !== null && String(row[found]).trim() !== '') return row[found];
  }
  return null;
}

// Simulate the frontend barcode extraction logic
for (let i = 0; i < Math.min(3, rows.length); i++) {
  const row = rows[i];
  
  // Extract barcode using the same logic as frontend
  const rawBarcode = pickCol(row, [
    'barcode', 'Barcode', 'BARCODE',
    'External ID', 'external id', 'external_id', 'EXTERNAL ID',
    'EAN', 'ean', 'Ean',
    'SKU', 'sku', 'Sku',
    'Product Code', 'product code', 'product_code'
  ]);
  
  console.log(`\nRow ${i + 1}:`);
  console.log('  Raw barcode:', rawBarcode);
  console.log('  Type:', typeof rawBarcode);
  
  if (!rawBarcode) {
    console.log('  ❌ No barcode found');
    continue;
  }
  
  // Convert to string and handle scientific notation
  let barcode = '';
  if (typeof rawBarcode === 'number') {
    // Excel converted to number - format with full precision
    barcode = rawBarcode.toFixed(0);
    console.log('  Converted (toFixed(0)):', barcode);
  } else {
    barcode = String(rawBarcode);
    console.log('  String value:', barcode);
  }
  
  // Normalize: remove spaces, commas, and trim
  barcode = barcode.replace(/[,\s]/g, '').trim();
  console.log('  Final normalized:', barcode);
  console.log('  Length:', barcode.length);
}

console.log('\n=== Summary ===');
console.log('This shows how barcodes will be extracted and normalized before API upload.');
