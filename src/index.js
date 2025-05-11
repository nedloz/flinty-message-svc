// этот микросервис должен реагировать на новое сообщение из кафки и на изменение данных тоже из кафки
// так же он должен отправлять историю сообщений
// а может добавить редис ???
require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const logger = require('./utils/logger');
const errorHandler = require('./utils/errorHandler');
const router = require('./routes/routes');
const attachUserFromHeaders = require('./utils/attachUserFromHeaders');
const { setupKafkaConsumer } = require('./kafka/consumer');
// const { init: initCounter } = require('./services/messageCounter');
// const startMessageConsumer = require('./consumers/messageNew.consumer');

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  logger.info(`✅ Запрос: ${req.method} ${req.originalUrl}`);
  next();
});

app.use(attachUserFromHeaders);

app.use("/messages", router);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

app.use(errorHandler);

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    app.listen(process.env.PORT, () => console.log(`✅ MongoDB connected\nСервер запущен на порту: ${process.env.PORT}`));

    // await startMessageConsumer(db);
    await setupKafkaConsumer();
    console.log('✅ Kafka consumer started');
  } catch (error) {
    console.error('❌ Failed to start message-svc:', error);
    process.exit(1);
  }
})();


// короче идея такая 
// надо добавить редис для хранения последней истории активных чатов 
// для быстрой подгрузки
// тут будет просто немного сложная логика отправки последней истории
// но просто для сохранения последних сообщений нужно сделать хранилище 
// sequence_number а для него тоже нужен редис 

