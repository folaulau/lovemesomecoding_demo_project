export type AllowedImageType = 'image/jpeg' | 'image/png' | 'image/webp';
export interface SniffResult {
    type: AllowedImageType;
    extension: string;
}
export declare function sniffImageType(buffer: Buffer): SniffResult | null;
