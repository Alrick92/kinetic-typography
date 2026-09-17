FROM node:22-slim

RUN apt-get update \
  && apt-get install -y libgtk-3-0 libx11-xcb1 libasound2 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 libxtst6 fonts-liberation xdg-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

RUN npx tsc

EXPOSE 3000

CMD ["npm", "run", "server"]
