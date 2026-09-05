function env(name, fallback) {
    const value = process.env[name];
    return value === undefined || value.trim() === '' ? fallback : value;
}
function envInt(name, fallback) {
    const raw = process.env[name];
    if (raw === undefined || raw.trim() === '')
        return fallback;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed)) {
        throw new Error(`${name} must be an integer, got "${raw}"`);
    }
    return parsed;
}
export function loadConfig() {
    return {
        port: envInt('CONTRACTOR_PORT', 3001),
        database: {
            host: env('CONTRACTOR_DB_HOST', 'localhost'),
            port: envInt('CONTRACTOR_DB_PORT', 5434),
            username: env('CONTRACTOR_DB_USER', 'contractor'),
            password: env('CONTRACTOR_DB_PASSWORD', 'contractor'),
            database: env('CONTRACTOR_DB_NAME', 'contractor'),
        },
        jwt: {
            secret: env('CONTRACTOR_JWT_SECRET', 'contractor-dev-jwt-secret-change-me-in-production-0123456789'),
            expiresIn: env('CONTRACTOR_JWT_EXPIRES_IN', '7d'),
        },
        uploads: {
            directory: env('CONTRACTOR_UPLOAD_DIR', 'uploads'),
            maxBytes: envInt('CONTRACTOR_UPLOAD_MAX_BYTES', 5 * 1024 * 1024),
        },
        corsOrigins: env('CONTRACTOR_CORS_ORIGINS', 'http://localhost:5177')
            .split(',')
            .map((origin) => origin.trim())
            .filter(Boolean),
    };
}
//# sourceMappingURL=configuration.js.map