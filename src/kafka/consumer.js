const { Kafka } = require('kafkajs');
const kafka = new Kafka({ brokers: [process.env.KAFKA_BROKER]});
const consumer = kafka.consumer({ groupId: process.env.KAFKA_CLIENT_ID });
const handleNewMessage = require('./handlers/handleNewMessage');
const handleError = require('./utils/handleError');
const getHistory = require('./handlers/getHistory');


const handlers = {
  'message.new': handleNewMessage,
  // 'message.update'
  // 'message.delete'
  'chat.history.req': getHistory, // не прописан в ws-gateway
  // 'server.delete'
  // 'server.channel.delete'
  // 'group.chat.delete'
  // 'private.chat.delete'
};

const errors = [
  'error.message.unknown_command',
  'error.message.saving',
  'error.history.get'
]

const setupKafkaConsumer = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: 'message.new', fromBeginning: false }) 
  await consumer.subscribe({ topic: 'chat.history.req', fromBeginning: false }) 

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const data = JSON.parse(message.value.toString());
      const handler = handlers[topic];
      if (handler) {
        try {
          await handler(data);
        } catch (err) {
          await handleError(
            `error${'.'+ err.topic || ''}`,
            err.message,
            { stack: err.stack, source: 'message-svc' }
          );
        }
      } else {
        await handleError(
          'error.unknown_command',
          `No handler for the command: ${topic}`,
          { stack: err.stack, source: 'message-svc' }
        );
      }
    }
  });
}

module.exports = { setupKafkaConsumer };