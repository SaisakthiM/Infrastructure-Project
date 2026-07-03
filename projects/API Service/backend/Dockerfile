FROM node:24-bookworm-slim

WORKDIR /app

COPY *.json .

RUN npm install
RUN npm install axios

COPY . .

CMD ["npm", "start"]
