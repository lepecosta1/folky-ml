import { Redis } from '@upstash/redis';

// Le UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN do ambiente.
// Guarda o token da conta ML (com seguranca) e o historico diario de snapshots.
export const redis = Redis.fromEnv();

export const TOKEN_KEY = 'ml:token';
