// Database table schema for message

const mongoose = require('mongoose');

const AttachmentSchema = new mongoose.Schema({
  file_url: { type: String, required: true },
}, { _id: false });

const MessageSchema = new mongoose.Schema({
  message_id: { type: String, required: true, unique: true },
  channel_id: { type: String, required: true },
  sender_id: { type: String, required: true },
  sequence_number: { type: Number, required: true },
  timestamp: { type: Date, required: true, default: Date.now },

  content: { type: String, required: true },

  attachments: { type: [AttachmentSchema], default: [] },

  reactions: {
    type: Map,
    of: [String],
    default: {}
  },

  mentions: { type: [String], default: [] },
  reply_to: { type: String, default: null }, // message_ids

  deleted: { type: Boolean, default: false },
  deleted_by: { type: String, default: null },
  deleted_at: { type: Date, default: null }
}, {
  versionKey: false,
  strict: false
});

module.exports = MessageSchema;

