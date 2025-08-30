const { default: mongoose } = require('mongoose');
const MessageSchema = require('../../collections/Message');
const { encryptContent } = require('../utils/encryption');
const { getCollectionName } = require('../utils/getCollectionName');
const { v4: uuidv4 } = require('uuid');
const { getNextSequenceNumber } = require('../utils/SequenceNumber');
const { produceKafkaMessage } = require('../producer');

/**
* Обрабатывает новое сообщение: сохраняет в соответствующую коллекцию MongoDB и отправляет в Kafka.
* Создает уникальный ID сообщения, присваивает порядковый номер, шифрует содержимое и сохраняет метаданные.
* После успешного сохранения отправляет неподписанное сообщение в Kafka для дальнейшей обработки.
* 
* @param {Object} data - Данные входящего сообщения.
* @param {string} data.chat_type - Тип чата (например, 'private', 'group', 'channel').
* @param {string} data.target_id - ID целевого объекта (пользователя, группы или канала).
* @param {string|null} [data.channel_id=null] - ID канала (если применимо).
* @param {string} data.sender_id - ID отправителя сообщения.
* @param {string} data.content - Текст содержимого сообщения (будет зашифрован).
* 
* @ {Array} [data.attachments=[]] - Массив вложений к сообщению.
* @ {Array} [data.mentions=[]] - Массив упомянутых пользователей.
* @param {string|null} [data.reply_to=null] - ID сообщения, на которое данное является ответом.
* @returns {Promise<Object>} Promise, который разрешается результатом отправки сообщения в Kafka.
* @throws {Error} Выбрасывает исключение с добавленным свойством topic в случае любой ошибки.
*/
const handleNewMessage = async (data) => {
    try {
        const {
            chat_type,
            target_id,
            channel_id = null,
            sender_id,
            content,
            attachments = [],
            mentions = [],
            reply_to = null
        } = data;

        const collectionName = getCollectionName(chat_type, { target_id, channel_id, sender_id })

        const MessageModel = mongoose.models[collectionName]
            || mongoose.model(collectionName, MessageSchema, collectionName);
        const message_id = uuidv4();
        const channelId = !channel_id ? target_id : channel_id;
        const sequence_number = await getNextSequenceNumber();
        const hashedContent = JSON.stringify(encryptContent(content));
        const timestamp = Date.now();
        const message = new MessageModel({
            message_id,
            channel_id: channelId,
            sender_id,
            sequence_number,
            content: hashedContent,
            attachments,
            reactions: [],
            mentions,
            reply_to,
            timestamp
        });

        await message.save();
        console.log(`Сохранено сообщение в коллекцию ${collectionName}`);

        const response = {
            message_id,
            channel_id: channelId,
            sender_id,
            sequence_number,
            content,
            attachments,
            reactions: [],
            mentions,
            reply_to,
            timestamp 
        }

        return await produceKafkaMessage('message.persisted', response);
    } catch (err) { 
        err.topic = 'message.saving';
        err.message = err.message || `Message saving error: ${err.message}`
        throw err;
    }
}

module.exports = handleNewMessage;