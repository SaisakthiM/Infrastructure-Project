FROM node:20-alpine AS build

WORKDIR /app

COPY package* .
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 5173

# --host is required! Without it Vite won't be accessible outside the container
CMD ["npm", "run", "dev", "--", "--host"]

FROM alpine

WORKDIR /dist

COPY --from=build /app/dist .

CMD ["sleep", "infinity"]