export interface AppConfig {
    port: number;
    database: {
        host: string;
        port: number;
        username: string;
        password: string;
        database: string;
    };
    jwt: {
        secret: string;
        expiresIn: string;
    };
    uploads: {
        directory: string;
        maxBytes: number;
    };
    corsOrigins: string[];
}
export declare function loadConfig(): AppConfig;
