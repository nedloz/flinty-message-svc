const { default: mongoose } = require("mongoose");
const redis = require("../../utils/redisClient");
const { getCollectionName } = require("../utils/getCollectionName");
const { produceKafkaMessage } = require("../producer");
const MessageSchema = require("../../collections/Message");
const { decryptContent } = require("../utils/encryption");

// Конфигурационные константы
const DEFAULT_LIMIT = 20; // Лимит сообщений по умолчанию
const REDIS_MAX_MESSAGES = 100; // Максимальное количество сообщений в Redis
const REDIS_TTL_SECONDS = 60; // Время жизни кэша в Redis (секунды)
const HISTORY_END_THRESHOLD = 1; // Порог для определения конца истории
const REDIS_OFFSET = 0; // Смещение для выборки из Redis

// Строковые константы
const KAFKA_RESPONSE_TOPIC = 'chat.history.res'; // Топик для ответов Kafka
const UNREADABLE_CONTENT = '[UNREADABLE]'; // Текст для нечитаемых сообщений
const ERROR_CODE = 'history.get'; // Код ошибки

/**
 * Основная функция получения истории сообщений
 * @param {Object} data - Входные данные запроса
 * @returns {Promise} Promise с результатом отправки в Kafka
*/
const getHistory = async (data) => {
  try {
    const { parsedData, redisKey } = parseInputData(data);

    if (parsedData.before !== null && parsedData.before <= HISTORY_END_THRESHOLD) {
      const response = getResponse(parsedData);
      return await produceKafkaMessage(KAFKA_RESPONSE_TOPIC, response);
    }

    const redisMessages = await getRedisMessages(redisKey, parsedData);
    const parsedRedis = parseRedisMessages(redisMessages);

    if (parsedRedis.length >= parsedData.limit) {
      const response = getResponse(parsedData, null, parsedRedis, null);
      return await produceKafkaMessage(KAFKA_RESPONSE_TOPIC, response);
    }

    const { mongoMessages, MessageModel, mongoQuery} = await getMongoMessages(parsedRedis, parsedData);

    parceMongoMessages(mongoMessages);
    await cacheMongoMessages(mongoMessages, redisKey);

    const response = await buildMixedResponse(parsedData, mongoMessages, parsedRedis, MessageModel, mongoQuery);
    return await produceKafkaMessage(KAFKA_RESPONSE_TOPIC, response);  

  } catch (err) {
    err.status = ERROR_CODE;
    err.message = err.message || `Get chat history error`;
    throw err;
  }
};

/**
 * Формирует ответ для клиента
 * @param {Object} data - Данные запроса
 * @param {Array|null} mongoMessages - Сообщения из MongoDB
 * @param {Array|null} parsedRedis - Сообщения из Redis
 * @param {boolean|null} hasMore - Флаг наличия дополнительных сообщений
 * @returns {Object} Ответ с сообщениями и метаданными
*/
function getResponse(data, mongoMessages = null, parsedRedis = null, hasMore = null) {
  const response = {
    sender_id: data.sender_id,
      request_id: data.request_id,
      channel_id: data.channel_id || data.target_id,
      messages: [],
      has_more: false
  }
  if (mongoMessages !== null && parsedRedis !== null && hasMore !== null) {
    response.messages = [...parsedRedis, ...mongoMessages];
    response.has_more = hasMore;
  } else if (parsedRedis !== null) {
    response.messages = parsedRedis;
    response.has_more = true;
  }
  return response;
}

/**
 * Парсит и валидирует входные данные
 * @param {Object} data - Сырые входные данные
 * @returns {Object} Объект с распарсенными данными и ключом Redis
*/
function parseInputData(data) {
  const {
    request_id,
    chat_type,
    sender_id,
    target_id,
    channel_id = null,
    before = null,
    limit = DEFAULT_LIMIT
  } = data;
  const parsedData = {
    request_id,
    chat_type,
    sender_id,
    target_id,
    channel_id,
    before,
    limit
  }
  const redisKey = getRedisKey(chat_type, channel_id, target_id);

  return {
    parsedData,
    redisKey
  }
}

/**
 * Генерирует ключ Redis для хранения сообщений
 * @param {string} chatType - Тип чата ('server' или другой)
 * @param {string|null} channelId - ID канала (для серверных чатов)
 * @param {string} targetId - ID цели (для личных чатов)
 * @returns {string} Ключ для Redis
 */
function getRedisKey (chatType, channelId, targetId) {
  return `messages:${chatType === 'server' ? channelId : targetId}`;
}

/**
 * Получает сообщения из Redis с учетом пагинации
 * @param {string} redisKey - Ключ Redis
 * @param {Object} data - Данные запроса с параметрами пагинации
 * @returns {Promise<Array>} Массив сообщений из Redis
 */
async function getRedisMessages(redisKey, data) {
  let redisMessages = [];
  if (data.before === null) {
    redisMessages = await redis.zRange(redisKey, '+inf', '-inf', {
      REV: true,
      BY: 'SCORE',
      LIMIT: {
        offset: REDIS_OFFSET,
        count: Math.min(data.limit, REDIS_MAX_MESSAGES)
      }
    });
  } else {
    redisMessages = await redis.zRangeByScore(redisKey, data.before - 1, 1, {
      REV: true,
      LIMIT: {
        offset: REDIS_OFFSET,
        count: Math.min(data.limit, REDIS_MAX_MESSAGES)
      }
    });
  }
  return redisMessages;
}

/**
 * Парсит и фильтрует сообщения из Redis
 * @param {Array} redisMessages - Сырые сообщения из Redis
 * @returns {Array} Отфильтрованный массив сообщений
 */
function parseRedisMessages(redisMessages) {
  return redisMessages.map(m => {
    try {
      return JSON.parse(m);
    } catch (_) {
      return null;
    }
  }).filter(m => m && !m.deleted);
}

/**
 * Получает сообщения из MongoDB
 * @param {Array} parsedRedis - Сообщения из Redis
 * @param {Object} data - Данные запроса
 * @returns {Promise<Object>} Объект с сообщениями, моделью и запросом
 */
async function getMongoMessages(parsedRedis, data) {
  const collectionName = getCollectionName(data.chat_type, {
    target_id: data.target_id,
    channel_id: data.channel_id,
    sender_id: data.sender_id
  });
  const remaining = data.limit - parsedRedis.length;
  const MessageModel = mongoose.models[collectionName] || mongoose.model(collectionName, MessageSchema, collectionName);
  const mongoQuery = {
    deleted: { $ne: true },
    ...(data.before ? { sequence_number: { $lt: data.before } } : {})
  };
  
  if (!MessageModel) {
    throw new Error(`Unknown chat ID for collection: ${collectionName}`);
  }

  const mongoMessages = await MessageModel.find(mongoQuery)
    .sort({ sequence_number: -1 })
    .limit(remaining)
    .lean();

  return {
    mongoMessages,
    MessageModel,
    mongoQuery
  }
}

/**
 * Обрабатывает и расшифровывает сообщения из MongoDB
 * @param {Array} mongoMessages - Сообщения из MongoDB
 */
function parceMongoMessages(mongoMessages) {
  mongoMessages.forEach(msg => {
    try {
      if (typeof msg.content === 'string') {
        const parsed = JSON.parse(msg.content);
        msg.content = decryptContent(parsed);
      }
    } catch (err) {
      console.warn(`[chat.history] Failed to decrypt content for Mongo message ${msg.message_id}:`, err);
      msg.content = UNREADABLE_CONTENT;
    }
  });
}

/**
 * Кэширует сообщения из MongoDB в Redis
 * @param {Array} mongoMessages - Сообщения из MongoDB
 * @param {string} redisKey - Ключ Redis
 * @returns {Promise} Promise операции кэширования
 */
async function cacheMongoMessages(mongoMessages, redisKey) {
  if (mongoMessages.length > 0) {
    await redis.zAdd(redisKey, mongoMessages.map(msg => ({
      score: msg.sequence_number,
      value: JSON.stringify(msg)
    })));

    await redis.zRemRangeByRank(redisKey, 0, -(REDIS_MAX_MESSAGES + 1));
    await redis.expire(redisKey, REDIS_TTL_SECONDS);
  }
}

/**
 * Строит комбинированный ответ из Redis и MongoDB
 * @param {Object} data - Данные запроса
 * @param {Array} mongoMessages - Сообщения из MongoDB
 * @param {Array} parsedRedis - Сообщения из Redis
 * @param {Object} MessageModel - Модель Mongoose
 * @param {Object} mongoQuery - Запрос к MongoDB
 * @returns {Promise<Object>} Финальный ответ с сообщениями
 */
async function buildMixedResponse(data, mongoMessages, parsedRedis, MessageModel, mongoQuery) {
  const totalCount = await MessageModel.countDocuments(mongoQuery);
  const hasMore = totalCount > parsedRedis.length + mongoMessages.length;
  return getResponse(data, mongoMessages, parsedRedis, hasMore);
} 

module.exports = getHistory;
