const { produceKafkaMessage } = require("../producer");


const handleNewMessage = ( data ) => {
    try {
        const {
            chat_type,
            target_id,
            channel_id = null,
            sender_id,
            content,
            attachments = [],
            mentions = [],
            reply_to = null
        } = data;


    } catch (err) {
        produceKafkaMessage("message.error", { message: "Message Saving error"})
    }

    // сделать обработчик ошибок ---??? типо если не удалось сохранить публиковать ответ в кафку о том что ошибка отправки сообщения.
    // и например на клиенте он будет пытать отправить сообщение несколько раз (в случае плохой связи например)
    // получить название коллекции
    // зашифровать текст по айдишнику пользователя
    // сохранить базовое сообщение в монго по названию коллекции









}

module.exports = handleNewMessage;