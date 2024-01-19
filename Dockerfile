FROM a4004/orange-bot-drti:latest

COPY . /home/container/orange-bot
WORKDIR /home/container/orange-bot

RUN npm ci
WORKDIR /home/container/orange-bot/local_modules/orange-common-lib
RUN npm ci
RUN npm run build
WORKDIR /home/container/orange-bot/local_modules/orange-bot-base
RUN npm ci
RUN npm run build
WORKDIR /home/container/orange-bot
RUN npm run build

USER container
ENV USER=container HOME=/home/container
CMD npm run prod