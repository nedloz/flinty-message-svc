# Базовый образ
FROM node:18-alpine

# Устанавливаем рабочую директорию внутри контейнера
WORKDIR /app

# Копируем зависимости и устанавливаем их
COPY package*.json ./
RUN npm install

# Копируем всё приложение
COPY . .

# Запуск сервиса
CMD ["npm", "run", "dev"]
