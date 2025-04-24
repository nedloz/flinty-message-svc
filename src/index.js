require('dotenv').config();
const { MongoClient } = require('mongodb');
const { init: initCounter } = require('./services/messageCounter');
const startMessageConsumer = require('./consumers/messageNew.consumer');

const startApp = async () => {
  try {

    const mongoClient = new MongoClient(process.env.MONGO_URI);
    await mongoClient.connect();
    const db = mongoClient.db(process.env.MONGO_DB_NAME || 'message_service');

    console.log('✅ MongoDB connected');

    initCounter(db);

    await startMessageConsumer(db);

    console.log('✅ Kafka consumer started');

  } catch (error) {
    console.error('❌ Failed to start message-svc:', error);
    process.exit(1);
  }
};

startApp();
