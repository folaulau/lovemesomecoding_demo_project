var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Injectable } from '@nestjs/common';
let TrimPipe = class TrimPipe {
    transform(value, metadata) {
        if (metadata.type !== 'body')
            return value;
        return trim(value, 0);
    }
};
TrimPipe = __decorate([
    Injectable()
], TrimPipe);
export { TrimPipe };
const MAX_DEPTH = 8;
function trim(value, depth) {
    if (typeof value === 'string')
        return value.trim();
    if (depth >= MAX_DEPTH || value === null || typeof value !== 'object')
        return value;
    if (Array.isArray(value))
        return value.map((item) => trim(item, depth + 1));
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
        return value;
    const result = {};
    for (const [key, item] of Object.entries(value)) {
        result[key] = trim(item, depth + 1);
    }
    return result;
}
//# sourceMappingURL=trim.pipe.js.map