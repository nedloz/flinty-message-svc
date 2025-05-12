const { default: mongoose } = require("mongoose");
const redis = require("../../utils/redisClient");
const { getCollectionName } = require("../utils/getCollectionName");
const { produceKafkaMessage } = require("../producer");

const getHistory = async (data) => {
  try {
    const {
      request_id,
      chat_type,
      sender_id,
      target_id,
      channel_id = null,
      before = null,
      limit = 20
    } = data;

    const collectionName = getCollectionName(chat_type, { target_id, channel_id, sender_id });
    const redisKey = `messages:${chat_type === 'server' ? channel_id : target_id}`;

    // Если before <= 1, то история закончилась — сразу вернуть пустой ответ
    if (before !== null && before <= 1) {
      return await produceKafkaMessage('chat.history.response', {
        request_id,
        channel_id: channel_id || target_id,
        messages: [],
        has_more: false
      });
    }

    // Запрос из Redis
    let redisMessages = [];
    if (before === null) {
      redisMessages = await redis.zRevRange(redisKey, 0, limit - 1);
    } else {
      redisMessages = await redis.zRevRangeByScore(
        redisKey,
        before - 1,
        1,
        { LIMIT: { offset: 0, count: limit } }
      );
    }

    const parsedRedis = redisMessages.map(m => {
      try {
        return JSON.parse(m);
      } catch (_) {
        return null;
      }
    }).filter(m => m && !m.deleted);

    // Если Redis дал достаточно — сразу вернуть
    if (parsedRedis.length >= limit) {
      return await produceKafkaMessage('chat.history.response', {
        request_id,
        channel_id: channel_id || target_id,
        messages: parsedRedis,
        has_more: true // Предполагаем, что есть еще
      });
    }

    // Идём в Mongo
    const remaining = limit - parsedRedis.length;
    const MessageModel = mongoose.models[collectionName];
    if (!MessageModel) {
      throw new Error(`Unknown chat ID for collection: ${collectionName}`);
    }

    const mongoQuery = {
      deleted: { $ne: true },
      ...(before ? { sequence_number: { $lt: before } } : {})
    };

    const mongoMessages = await MessageModel.find(mongoQuery)
      .sort({ sequence_number: -1 })
      .limit(remaining)
      .lean();

    // Кешируем в Redis
    if (mongoMessages.length > 0) {
      await redis.zAdd(redisKey, mongoMessages.map(msg => ({
        score: msg.sequence_number,
        value: JSON.stringify(msg)
      })));

      // Удаляем старые, если больше 100
      await redis.zRemRangeByRank(redisKey, 0, -101);

      // Устанавливаем TTL
      await redis.expire(redisKey, 60);
    }

    // Рассчитываем has_more по количеству документов в Mongo
    const totalCount = await MessageModel.countDocuments(mongoQuery);
    const hasMore = totalCount > parsedRedis.length + mongoMessages.length;

    const response = {
      request_id,
      channel_id: channel_id || target_id,
      messages: [...parsedRedis, ...mongoMessages],
      has_more: hasMore
    };

    await produceKafkaMessage('chat.history.response', response);
  } catch (err) {
    err.status = 'history.get';
    err.message = err.message || `Get chat history error`;
    throw err;
  }
};

module.exports = getHistory;
