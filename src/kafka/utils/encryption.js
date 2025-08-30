const crypto = require('crypto');
const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
const ENCODING = {
  HEX: 'hex',
  UTF8: 'utf8'
};
const BUFFER_SIZES = {
  IV_GCM: 12, // 96 бит для GCM
};

/**
 * Шифрует строку с использованием алгоритма AES-256-GCM.
 * Генерирует криптографически стойкий вектор инициализации (IV) и аутентификационный тег.
 * Возвращает объект с зашифрованными данными и параметрами, необходимыми для расшифровки.
 * 
 * @param {string} plainText - Текст для шифрования в кодировке UTF-8.
 * @returns {Object} Объект с зашифрованными данными.
 * @returns {string} return.iv - Вектор инициализации в hex-кодировке.
 * @returns {string} return.content - Зашифрованное содержимое в hex-кодировке.
 * @returns {string} return.tag - Аутентификационный тег в hex-кодировке.
 * 
 * @throws {TypeError} Если plainText не является строкой.
 * @throws {Error} При ошибках криптографических операций (неверная длина ключа и т.д.).
 * 
 * @example
 * const encrypted = encryptContent('secret message');
 * // { iv: 'a1b2c3...', content: 'd4e5f6...', tag: 'g7h8i9...' }
 */

function encryptContent(plainText) {
  if (typeof plainText !== 'string') {
    throw new TypeError('plainText must be a string');
  }
  const iv = crypto.randomBytes(BUFFER_SIZES.IV_GCM);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(plainText, ENCODING.UTF8, ENCODING.HEX);
  encrypted += cipher.final(ENCODING.HEX);
  const authTag = cipher.getAuthTag();

  return {
    iv: iv.toString(ENCODING.HEX),
    content: encrypted,
    tag: authTag.toString(ENCODING.HEX)
  };
}

/**
 * Расшифровывает данные, зашифрованные функцией encryptContent.
 * Проверяет аутентификационный тег для обеспечения целостности и подлинности данных.
 * 
 * @param {Object} cipherData - Объект с зашифрованными данными.
 * @param {string} cipherData.iv - Вектор инициализации в hex-кодировке.
 * @param {string} cipherData.content - Зашифрованное содержимое в hex-кодировке.
 * @param {string} cipherData.tag - Аутентификационный тег в hex-кодировке.
 * @returns {string} Расшифрованный текст в кодировке UTF-8.
 * 
 * @throws {TypeError} Если cipherData не является объектом.
 * @throws {Error} Если отсутствуют обязательные свойства iv, content или tag.
 * @throws {Error} Если проверка аутентификационного тега не удалась (нарушение целостности).
 * @throws {Error} При других ошибках дешифрования.
 * 
 * @example
 * const decrypted = decryptContent({
 *   iv: 'a1b2c3...',
 *   content: 'd4e5f6...',
 *   tag: 'g7h8i9...'
 * });
 * // 'secret message'
 */

function decryptContent(cipherData) {
  if (!cipherData || typeof cipherData !== 'object') {
    throw new TypeError('cipherData must be an object');
  }
  
  const { iv, content, tag } = cipherData;
  
  if (!iv || !content || !tag) {
    throw new Error('cipherData must contain iv, content, and tag properties');
  }

  try {
    const decipher = crypto.createDecipheriv(
      ALGORITHM, 
      KEY, 
      Buffer.from(iv, ENCODING.HEX)
    );
    decipher.setAuthTag(Buffer.from(tag, ENCODING.HEX));

    let decrypted = decipher.update(content, ENCODING.HEX, ENCODING.UTF8);
    decrypted += decipher.final(ENCODING.UTF8);

    return decrypted;
  } catch (error) {
    if (error.code === 'ERR_CRYPTO_INVALID_TAG') {
      throw new Error('Decryption failed: authentication tag verification failed');
    }
    throw new Error(`Decryption failed: ${error.message}`);
  }
}

module.exports = {
  encryptContent,
  decryptContent
};
