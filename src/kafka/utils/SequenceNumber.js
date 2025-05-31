const redis = require("../../utils/redisClient");

// не нужна инициализация тк incr создаст новый ключ если не найдет запрошенный
const getNextSequenceNumber = async (chat_id) => {
    try {
        return await redis.incr(`chat:${chat_id}:seq`);
    } catch (err) {
        err.topic = 'redis';
        err.message = 'Redis. Get SeqNum'
    }
}

// ???? а как работает удаление (мягко или нет) 
// нет)) при удалении чата или канала данные удаляются полностью
// а мягкое удаление нужно для админов

const deleteSequenceNumber = async (chat_id) => {
    try {
        await redis.del(`chat:${chat_id}:seq`);
    } catch (err) {
        err.topic = 'redis';
        err.message = 'Redis. Delete SeqNum';
    }
}

module.exports = {
    getNextSequenceNumber, 
    deleteSequenceNumber
};
