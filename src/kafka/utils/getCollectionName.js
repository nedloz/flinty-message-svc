function getCollectionName(chat_type, { target_id, channel_id, sender_id }) {
    switch (chat_type) {
      case 'server':
        if (!target_id || !channel_id) {
          throw new Error('Missing server_id or channel_id for server chat type');
        }
        return `server_messages:${target_id}:${channel_id}`;
  
      case 'private':
        if (!target_id && !sender_id) {
          throw new Error("Missing sender_id or target_id");
        }
        // Упорядочим user_id, чтобы коллекция была одинаковой для обеих сторон
        const [ user1, user2 ] = [ target_id, sender_id ];
        return `private_messages:${user1}:${user2}`;
  
      case 'group':
        if (!target_id) {
          throw new Error('Missing chat_id for group chat type');
        }
        return `group_messages:${target_id}`;
  
      default:
        throw new Error(`Unsupported chat_type: ${chat_type}`);
    }
  }
  
  module.exports = {
    getCollectionName
  };
  