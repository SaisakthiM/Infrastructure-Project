FROM node:20-alpine

WORKDIR /app

COPY package* .
RUN npm ci

COPY . .

EXPOSE 5173

# --host is required! Without it Vite won't be accessible outside the container
CMD ["npm", "run", "dev", "--", "--host"]