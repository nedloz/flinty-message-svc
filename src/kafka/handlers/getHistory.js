const { default: mongoose } = require("mongoose");
const redis = require("../../utils/redisClient");
const { getCollectionName } = require("../utils/getCollectionName");
const { produceKafkaMessage } = require("../producer");
const MessageSchema = require("../../collections/Message");
const { decryptContent } = require("../utils/encryption");

// "_id": "683a6afe6866051688640e45",
// "message_id": "18f9739c-4dac-473c-962e-3183ca08d2b0",
// "channel_id": "9e0c4a33-0bc4-4da3-b341-aa6c0700c76e",
// "sender_id": "56af1030-97bc-45aa-9368-3154b61df130",
// "sequence_number": 11,
// "timestamp": "2025-05-31T02:35:42.304Z",
// "content": "Привет из Postman!",
// "attachments": [],
// "reactions": {},
// "mentions": [],
// "reply_to": null,
// "deleted": false, тут
// "deleted_by": null, тут
// "deleted_at": null тут
// мы не должны возвращать удаленные сообщения но пока что пофек


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
      return await produceKafkaMessage('chat.history.res', {
        sender_id,
        request_id,
        channel_id: channel_id || target_id,
        messages: [],
        has_more: false
      });
    }

    // Запрос из Redis
    let redisMessages = [];
    if (before === null) {
      redisMessages = await redis.zRange(redisKey, '+inf', '-inf', {
        REV: true,
        BY: 'SCORE',
        LIMIT: {
          offset: 0,
          count: limit
        }
      });
    } else {
      redisMessages = await redis.zRangeByScore(redisKey, before - 1, 1, {
        REV: true,
        LIMIT: {
          offset: 0,
          count: limit
        }
      });
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
      return await produceKafkaMessage('chat.history.res', {
        sender_id,
        request_id,
        channel_id: channel_id || target_id,
        messages: parsedRedis,
        has_more: true // Предполагаем, что есть еще .. это фейк ньюс надо проверять 
      });
    }

    // Идём в Mongo
    const remaining = limit - parsedRedis.length;
    const MessageModel = mongoose.models[collectionName]
      || mongoose.model(collectionName, MessageSchema, collectionName);
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

    mongoMessages.forEach(msg => {
      try {
        if (typeof msg.content === 'string') {
          const parsed = JSON.parse(msg.content);
          msg.content = decryptContent(parsed);
        }
      } catch (err) {
        console.warn(`[chat.history] Failed to decrypt content for Mongo message ${msg.message_id}:`, err);
        msg.content = '[UNREADABLE]';
      }
    });
    
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
      sender_id,
      request_id,
      channel_id: channel_id || target_id,
      messages: [...parsedRedis, ...mongoMessages],
      has_more: hasMore
    };

    await produceKafkaMessage('chat.history.res', response);  
  } catch (err) {
    err.status = 'history.get';
    err.message = err.message || `Get chat history error`;
    throw err;
  }
};

module.exports = getHistory;
