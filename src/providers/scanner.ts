export interface ScanResult {
  rawValue: string;
  format: string;
}

export type ScannerErrorKind = "permission-denied" | "no-camera" | "insecure-context" | "unknown";

export class ScannerStartError extends Error {
  constructor(
    public readonly kind: ScannerErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "ScannerStartError";
  }
}

export interface Scanner {
  start(video: HTMLVideoElement, onDecode: (results: ScanResult[]) => void): Promise<void>;
  stop(): void;
}
