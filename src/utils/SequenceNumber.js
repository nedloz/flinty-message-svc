const redis = require("./redisClient");

const getNextSequenceNumber = async (chat_id) => {
    return await redis.incr(`chat:${chat_id}:seq`);
}

const deleteSequenceNumber = async (chat_id) => {
    // ???? а как блять работает удаление (мягко или нет) нет)) при удалении чата или канала данные удаляются полностью
    // а мягкое удаление нужно для админов
    await redis.del(`chat:${chat_id}:seq`);
}

module.exports = {
    getNextSequenceNumber, // не нужна инициализация тк incr создаст новый ключ если не найдет запрошенный
    deleteSequenceNumber
};
