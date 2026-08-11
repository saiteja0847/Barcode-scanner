const L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const G = ["0100111", "0110011", "0011011", "0100001", "0011101", "0111001", "0000101", "0010001", "0001001", "0010111"];
const R = L.map((p) => p.split("").map((b) => (b === "0" ? "1" : "0")).join(""));
const PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

export function ean13Modules(code: string): string {
  if (!/^[0-9]{13}$/.test(code)) throw new Error("EAN-13 requires exactly 13 digits");
  const digits = code.split("").map(Number);
  const parity = PARITY[digits[0]!]!;
  let m = "101";
  for (let i = 1; i <= 6; i++) m += (parity[i - 1] === "L" ? L : G)[digits[i]!]!;
  m += "01010";
  for (let i = 7; i <= 12; i++) m += R[digits[i]!]!;
  return m + "101";
}
