const { v4: uuidv4 } = require('uuid');
const { getNextSequenceNumber } = require('../services/messageCounter');
const { getCollectionName } = require('../utils/collectionName');
const { encryptContent } = require('../utils/encryption');
const { produceMessageSaved } = require('../producers/messageSaved.producer');
const BaseMessageSchema = require('../models/base.message');

async function handleIncomingMessage(data, db) {
  const {
    chat_type,
    _id,
    channel_id,
    sender_id,
    content,
    attachments = [],
    mentions = [],
    reply_to = null,
  } = data;

  const timestamp = Date.now();
  const message_id = uuidv4();

  const collectionName = getCollectionName(chat_type, { _id, channel_id});

  const sequence_number = await getNextSequenceNumber(collectionName);

  const encryptedContent = encryptContent(content); // => { iv, content, tag }

  const MessageModel = db.model(collectionName, BaseMessageSchema, collectionName);

  const messageDoc = new MessageModel({
    message_id,
    channel_id: channel_id || chat_id,
    sender_id,
    sequence_number,
    timestamp,
    content: encryptedContent,
    attachments,
    mentions,
    reply_to
  });

  await messageDoc.save();

  console.log(`💾 Saved message ${message_id} in ${collectionName}`);

  await produceMessageSaved({
    message_id,
    chat_type,
    channel_id: channel_id || chat_id,
    sender_id,
    timestamp,
    sequence_number
  });

  console.log(`📤 Published message.saved for ${message_id}`);
}

module.exports = {
  handleIncomingMessage
};
