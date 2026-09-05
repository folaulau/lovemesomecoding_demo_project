const SIGNATURES = [
    { type: 'image/jpeg', extension: 'jpg', magic: [0xff, 0xd8, 0xff], offset: 0 },
    {
        type: 'image/png',
        extension: 'png',
        magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
        offset: 0,
    },
    {
        type: 'image/webp',
        extension: 'webp',
        magic: [0x52, 0x49, 0x46, 0x46, null, null, null, null, 0x57, 0x45, 0x42, 0x50],
        offset: 0,
    },
];
export function sniffImageType(buffer) {
    for (const signature of SIGNATURES) {
        const end = signature.offset + signature.magic.length;
        if (buffer.length < end)
            continue;
        const matches = signature.magic.every((byte, index) => {
            if (byte === null)
                return true;
            return buffer[signature.offset + index] === byte;
        });
        if (matches)
            return { type: signature.type, extension: signature.extension };
    }
    return null;
}
//# sourceMappingURL=image-validation.js.map