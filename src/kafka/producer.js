const { Kafka } = require('kafkajs');
const kafka = new Kafka({ brokers: ['localhost:9092']});
const producer = kafka.producer();

(async () => {
    await producer.connect();
})();

async function produceKafkaMessage(topic, message) {
    await producer.send({
        topic,
        messages: [{ value: JSON.stringify(message) }]
    });
}

module.exports = { produceKafkaMessage };