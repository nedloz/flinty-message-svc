const mongoose = require('mongoose');

const AttachmentSchema = new mongoose.Schema({
  file_url: { type: String, required: true },
}, { _id: false });

const BaseMessageSchema = new mongoose.Schema({
  message_id: { type: String, required: true, unique: true },
  channel_id: { type: String, required: true },
  sender_id: { type: String, required: true },
  sequence_number: { type: Number, required: true },
  timestamp: { type: Number, required: true },

  content: {
    type: Object, // { iv, content, tag }
    required: true
  },

  attachments: { type: [AttachmentSchema], default: [] },

  reactions: {
    type: Map,
    of: [String], // Пример: { "🔥": ["user1", "user2"] }
    default: {}
  },


  mentions: { type: [String], default: [] },
  reply_to: { type: String, default: null }, // message_id
  is_edited: { type: Boolean, default: false },
  deleted: { type: Boolean, default: false },
  deleted_by: { type: String, default: null },
  deleted_at: { type: Number, default: null }

}, {
  versionKey: false,
  strict: false
});

module.exports = BaseMessageSchema;
