const redis = require("../../utils/redisClient");

const ERROR_TOPIC = 'redis';
const ACTIONS = {
    GET_SEQ: 'Redis. Get SeqNum',
    DELETE_SEQ: 'Redis. Delete SeqNum'
};
const CHAT_SEQUENCE = (chat_id) => `chat:${chat_id}:seq`


/**
 * Атомарно увеличивает и возвращает следующий порядковый номер для указанного чата.
 * Использует Redis команду INCR, которая гарантирует уникальность и последовательность номеров
 * в многопользовательской среде, даже при конкурентном доступе.
 *
 * @param {string} chat_id - Уникальный идентификатор чата, для которого требуется получить следующий порядковый номер.
 * @returns {Promise<number>} Promise, который разрешается следующим порядковым номером (целым числом).
 * @throws {Error} Выбрасывает исключение с добавленными свойствами `topic` и `message` в случае ошибки Redis.
 * @example
 * const nextMessageId = await getNextSequenceNumber('general-chat-123');
 * // nextMessageId = 42
 */
const getNextSequenceNumber = async (chat_id) => {
    try {
        return await redis.incr(CHAT_SEQUENCE(chat_id));
    } catch (err) {
        err.topic = ERROR_TOPIC;
        err.message = ACTIONS.GET_SEQ;
    }
}


/**
 * Удаляет ключ с порядковым номером для указанного чата из Redis.
 * Эта операция полностью сбрасывает последовательность нумерации для чата.
 * Последующий вызов `getNextSequenceNumber` для этого же `chat_id` начнет нумерацию с 1.
 *
 * @param {string} chat_id - Уникальный идентификатор чата, для которого требуется сбросить последовательность нумерации.
 * @returns {Promise<void>} Promise, который разрешается при успешном удалении ключа.
 * @throws {Error} Выбрасывает исключение с добавленными свойствами `topic` и `message` в случае ошибки Redis.
 * @example
 * await deleteSequenceNumber('general-chat-123');
 */
const deleteSequenceNumber = async (chat_id) => {
    try {
        return await redis.del(CHAT_SEQUENCE(chat_id));
    } catch (err) {
        err.topic = ERROR_TOPIC;
        err.message = ACTIONS.DELETE_SEQ;
    }
}

module.exports = {
    getNextSequenceNumber, 
    deleteSequenceNumber
};
