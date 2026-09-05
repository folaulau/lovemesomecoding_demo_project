import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
export declare class TrimPipe implements PipeTransform {
    transform(value: unknown, metadata: ArgumentMetadata): unknown;
}
