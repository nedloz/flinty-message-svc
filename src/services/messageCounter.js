let db;

function init(mongoDbInstance) {
  db = mongoDbInstance;
}

// Генерация следующего sequence_number для конкретного чата
async function getNextSequenceNumber(chatId) {
  const result = await db.collection('message_counters').findOneAndUpdate(
    { chat_id: chatId },
    { $inc: { last_seq: 1 } },
    {
      upsert: true,
      returnDocument: 'after'
    }
  );

  return result.value.last_seq;
}

module.exports = {
  init,
  getNextSequenceNumber
};
