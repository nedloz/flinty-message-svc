require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('./utils/logger'); 
const { setupKafkaConsumer } = require('./kafka/consumer');


(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB connected`)
    await setupKafkaConsumer();
    console.log('✅ Kafka consumer started');
  } catch (error) {
    console.error('❌ Failed to start message-svc:', error);
    process.exit(1);
  }
})();

// сделать библиотеку ошибок

// короче идея такая 
// + надо добавить редис для хранения последней истории активных чатов  для быстрой подгрузки
// тут будет просто немного сложная логика отправки последней истории
// но просто для сохранения последних сообщений нужно сделать хранилище 
// sequence_number а для него тоже нужен редис 

