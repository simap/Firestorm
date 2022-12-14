FROM node:lts-alpine3.16

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 80
RUN yarn && yarn build
