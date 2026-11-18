FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY ["Backend (Node.js)/package.json", "Backend (Node.js)/package-lock.json", "./"]
RUN npm ci --omit=dev

COPY ["Backend (Node.js)/", "./"]

EXPOSE 10000

CMD ["npm", "start"]
