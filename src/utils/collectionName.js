function getCollectionName(chat_type, { server_id, channel_id, chat_id }) {
    switch (chat_type) {
      case 'server':
        if (!server_id || !channel_id) {
          throw new Error('Missing server_id or channel_id for server chat type');
        }
        return `server_messages_${server_id}_${channel_id}`;
  
      case 'private':
        if (!chat_id || !Array.isArray(chat_id) || chat_id.length !== 2) {
          throw new Error('chat_id must be [userId1, userId2] for private chat');
        }
  
        // Упорядочим user_id, чтобы коллекция была одинаковой для обеих сторон
        const [user1, user2] = [...chat_id].sort();
        return `private_messages_${user1}_${user2}`;
  
      case 'group':
        if (!chat_id) {
          throw new Error('Missing chat_id for group chat type');
        }
        return `group_messages_${chat_id}`;
  
      default:
        throw new Error(`Unsupported chat_type: ${chat_type}`);
    }
  }
  
  module.exports = {
    getCollectionName
  };
  