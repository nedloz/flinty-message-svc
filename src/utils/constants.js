const KAFKA_TOPICS = {
    message_persisted: 'message.persisted',
    chat_history_response: 'chat.history.res',
}

const ERRORS_CONSTANTS = {
    message_saving: {
        topic: 'message.saving',
        message: (message) =>  `Message saving error: ${message}`
    },
    history_get: {
        topic: 'history.get',
        message: (message) => `Get chat history error: ${message}`
    }
}

const UNREADABLE_CONTENT = '[UNREADABLE]';


module.exports = {
    UNREADABLE_CONTENT,
    KAFKA_TOPICS,
    ERRORS_CONSTANTS
}