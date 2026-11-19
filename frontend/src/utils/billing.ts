export const gstStates = [
  ['01', 'Jammu and Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'],
  ['04', 'Chandigarh'], ['05', 'Uttarakhand'], ['06', 'Haryana'], ['07', 'Delhi'],
  ['08', 'Rajasthan'], ['09', 'Uttar Pradesh'], ['10', 'Bihar'], ['11', 'Sikkim'],
  ['12', 'Arunachal Pradesh'], ['13', 'Nagaland'], ['14', 'Manipur'], ['15', 'Mizoram'],
  ['16', 'Tripura'], ['17', 'Meghalaya'], ['18', 'Assam'], ['19', 'West Bengal'],
  ['20', 'Jharkhand'], ['21', 'Odisha'], ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'],
  ['24', 'Gujarat'], ['26', 'Dadra and Nagar Haveli and Daman and Diu'],
  ['27', 'Maharashtra'], ['29', 'Karnataka'], ['30', 'Goa'], ['31', 'Lakshadweep'],
  ['32', 'Kerala'], ['33', 'Tamil Nadu'], ['34', 'Puducherry'],
  ['35', 'Andaman and Nicobar Islands'], ['36', 'Telangana'],
  ['37', 'Andhra Pradesh'], ['38', 'Ladakh'],
] as const;

export type TaxMode = 'cgst_sgst' | 'cgst_utgst' | 'igst';

export function taxModeFor(supplierState: string, placeOfSupply: string): TaxMode | null {
  if (![supplierState, placeOfSupply].every(code => gstStates.some(([value]) => code === value))) return null;
  if (supplierState !== placeOfSupply) return 'igst';
  return ['04', '26', '31', '35', '38'].includes(supplierState) ? 'cgst_utgst' : 'cgst_sgst';
}

function decimalUnits(value: string | number): bigint | null {
  const text = String(value || 0);
  if (!/^\d+(\.\d{0,4})?$/.test(text)) return null;
  const [whole, fraction = ''] = text.split('.');
  return BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'));
}

function rounded(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

export function previewLine(
  quantity: string,
  unitPrice: number | null,
  discountPercent: string,
  gstRate: number | null,
  mode: TaxMode | null,
) {
  if (!mode || unitPrice == null || gstRate == null || !/^\d+$/.test(quantity)) return null;
  const qty = Number(quantity);
  const price = decimalUnits(unitPrice);
  const discount = decimalUnits(discountPercent);
  const rate = decimalUnits(gstRate);
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > 100000 || price == null || price > 10000000000n ||
      discount == null || discount > 1000000n || rate == null || rate > 1000000n) return null;
  if (mode !== 'igst' && rate % 2n !== 0n) return null;

  const gross = rounded(price * BigInt(qty), 100n);
  const discountAmount = rounded(gross * discount, 1000000n);
  const taxable = gross - discountAmount;
  const cgst = mode === 'igst' ? 0n : rounded(taxable * rate, 2000000n);
  const sgst = mode === 'cgst_sgst' ? cgst : 0n;
  const utgst = mode === 'cgst_utgst' ? cgst : 0n;
  const igst = mode === 'igst' ? rounded(taxable * rate, 1000000n) : 0n;
  const money = (value: bigint) => Number(value) / 100;
  return {
    grossAmount: money(gross), discountAmount: money(discountAmount), taxableAmount: money(taxable),
    cgstAmount: money(cgst), sgstAmount: money(sgst), utgstAmount: money(utgst), igstAmount: money(igst),
    lineTotal: money(taxable + cgst + sgst + utgst + igst),
  };
}
