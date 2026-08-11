export const SCAN_COOLDOWN_MS = 3000;
export const DETECT_INTERVAL_MS = 150;
export const ALLOWED_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"] as const;
export const DB_NAME = "storage-checker";
export const DB_VERSION = 2;
export const DB_STORE = "items";
export const DB_STORE_PICKS = "picks";
