const { Kafka } = require('kafkajs');
const { handleIncomingMessage } = require('../handlers/message.handler');

const startMessageConsumer = async (db) => {
  const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || 'message-svc',
    brokers: [process.env.KAFKA_BROKER]
  });

  const consumer = kafka.consumer({ groupId: 'message-svc-group' });
  await consumer.connect();
  await consumer.subscribe({ topic: 'message.new', fromBeginning: false });

  console.log('📥 Subscribed to topic: message.new');

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const rawValue = message.value.toString();
        const parsed = JSON.parse(rawValue);

        await handleIncomingMessage(parsed, db);
      } catch (error) {
        console.error('❌ Failed to process message.new:', error);
      }
    }
  });
};

module.exports = startMessageConsumer;
