const { default: mongoose } = require('mongoose');
const MessageSchema = require('../../collections/Message');
const { encryptContent } = require('../utils/encryption');
const { getCollectionName } = require('../utils/getCollectionName');
const { v4: uuidv4 } = require('uuid');
const { getNextSequenceNumber } = require('../utils/SequenceNumber');
const { produceKafkaMessage } = require('../producer');

// Сохранение нового сообщения
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
            ? mongoose.model(collectionName) 
            : mongoose.model(collectionName, MessageSchema, collectionName);
        const message_id = uuidv4();
        const channelId = !channel_id ? target_id : channel_id;
        const sequence_number = await getNextSequenceNumber();
        const hashedContent = encryptContent(content);
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
        console.log(`Сохранено сообщение в коллекцию messages_chat_${channelId}`); // logger
    
        produceKafkaMessage('message.persisted', message.toObject());
    } catch (err) { 
        err.topic = 'message.saving';
        err.message = err.message || `Message saving error: ${err.message}`
        throw err;
    }
}

module.exports = handleNewMessage;