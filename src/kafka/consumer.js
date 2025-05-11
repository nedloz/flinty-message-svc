const { Kafka } = require('kafkajs');
const kafka = new Kafka({ brokers: ['localhost:9092'] });
const consumer = kafka.consumer({ groupId: 'ws-gateway-group' });
const handleNewMessage = require('./handlers/handleNewMessage');


const handlers = {
  'message.new': handleNewMessage,
};

const setupKafkaConsumer = async (userSockets) => {
  await consumer.connect();
  await consumer.subscribe({ topic: 'message.new', fromBeginning: false }) 

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      const data = JSON.parse(message.value.toString());
      const handler = handlers[topic];
      if (handler) {
        try {
          await handler( data );
        } catch (err) {
          console.error(`Ошибка при обработке события ${topic}`, err);
        }
      } else {
        console.warn(`Нет обработчика для топика: ${topic}`);
      }
    }
  });
}

module.exports = { setupKafkaConsumer };