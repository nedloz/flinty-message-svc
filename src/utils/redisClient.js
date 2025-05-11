const { createClient } = requir('redis');
const redis = createClient({
    url: process.env.REDIS_URI || 'redis://localhost:6379'
});

redis.on('error', err => logger.error(`❌ Redis error: \t ${err}`));
redis.on('connect', () => logger.info('✅ Redis connected'));

(async () => {
    await redis.connect();
})();


module.exports = redis;