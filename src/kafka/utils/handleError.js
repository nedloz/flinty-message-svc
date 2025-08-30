const { produceKafkaMessage } = require("../producer");
const ERROR_TOPIC = (topic) => `[${topic}]`

/**
 * Универсальная функция обработки и логирования ошибок с отправкой в Kafka
 * Централизованный обработчик ошибок для всего приложения
 * 
 * @param {string} topic - Kafka топик для отправки ошибки
 * @param {string} errorMessage - Текст сообщения об ошибке
 * @param {Object} [meta={}] - Дополнительные метаданные для контекста ошибки
 * @returns {Promise<void>} Promise, который резолвится после отправки сообщения
 * 
 * @example
 * // Простая ошибка
 * await handleError('user.errors', 'User not found');
 * 
 * // Ошибка с метаданными
 * await handleError('auth.errors', 'Login failed', { 
 *   userId: '123', 
 *   ip: '192.168.1.1' 
 * });
 */

const handleError = async (topic, errorMessage, meta = {}) => {
    const errorPayload = {
        message: errorMessage,
        time: new Date().toISOString(),
        ...meta
    };

    loggger.error(ERROR_TOPIC(topic), errorPayload);

    await produceKafkaMessage(topic, errorPayload);
};

module.exports = handleError;