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
