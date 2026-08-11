const DIGITS = /^[0-9]+$/;

/**
 * Expand an 8-digit UPC-E (number system + 6 payload digits + check digit)
 * to its 12-digit UPC-A equivalent. The check digit carries over unchanged.
 */
export function expandUpcE(value: string): string | null {
  if (value.length !== 8 || !DIGITS.test(value)) return null;
  const numberSystem = value[0]!;
  const check = value[7]!;
  const [d1, d2, d3, d4, d5, d6] = value.slice(1, 7).split("") as [string, string, string, string, string, string];
  let body: string;
  if (d6 === "0" || d6 === "1" || d6 === "2") body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  else if (d6 === "3") body = `${d1}${d2}${d3}00000${d4}${d5}`;
  else if (d6 === "4") body = `${d1}${d2}${d3}${d4}00000${d5}`;
  else body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  return `${numberSystem}${body}${check}`;
}

/**
 * Canonical form: EAN-13/UPC family → 13-digit GTIN-13 (UPC-A zero-padded);
 * EAN-8 stays 8 digits (distinct namespace — padding could collide);
 * Code-128 passes through raw. Returns null for anything malformed or
 * outside the allowed formats — callers must ignore null.
 */
export function normalizeBarcode(rawValue: string, format: string): string | null {
  const value = rawValue.trim();
  switch (format) {
    case "ean_13":
      return value.length === 13 && DIGITS.test(value) ? value : null;
    case "upc_a":
      if (!DIGITS.test(value) || value.length === 0) return null;
      if (value.length === 12) return "0" + value;
      if (value.length === 13 && value.startsWith("0")) return value;
      return null;
    case "upc_e": {
      const upcA = expandUpcE(value);
      return upcA === null ? null : "0" + upcA;
    }
    case "ean_8":
      return value.length === 8 && DIGITS.test(value) ? value : null;
    case "code_128":
      return value.length > 0 ? value : null;
    default:
      return null;
  }
}
