FROM node:22

WORKDIR /ACC_BACKUP

COPY package*.json ./

RUN npm install

COPY . .

RUN mkdir -p ./tmp

EXPOSE 8080

CMD [ "node", "server.js" ]