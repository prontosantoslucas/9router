FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++ linux-headers
COPY package.json ./
RUN npm install --omit=dev
COPY . .

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache tini
COPY --from=build /app /app
ENV NODE_ENV=production
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
