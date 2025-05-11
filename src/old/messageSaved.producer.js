const { Kafka } = require('kafkajs');

let producer;

async function initProducer() {
  const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || 'message-svc',
    brokers: [process.env.KAFKA_BROKER]
  });

  producer = kafka.producer();
  await producer.connect();
  console.log('🚀 Kafka producer connected');
}

async function produceMessageSaved(messagePayload) {
  if (!producer) {
    await initProducer(); // если producer ещё не инициализирован
  }

  await producer.send({
    topic: 'message.saved',
    messages: [
      {
        key: messagePayload.message_id,
        value: JSON.stringify(messagePayload)
      }
    ]
  });
}

module.exports = {
  produceMessageSaved
};
