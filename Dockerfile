FROM node:22-alpine

RUN apk add --no-cache gcompat
WORKDIR /app

COPY . .

RUN pnpm install
EXPOSE 3000

CMD ["pnpm", "start"]