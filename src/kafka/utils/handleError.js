const { produceKafkaMessage } = require("../producer");

const handleError = async (topic, errorMessage, meta = {}) => {
    const errorPayload = {
        message: errorMessage,
        time: new Date().toISOString(),
        ...meta
    };

    console.error(`[${topic}]`, errorPayload);

    await produceKafkaMessage(topic, errorPayload);
};

module.exports = handleError;