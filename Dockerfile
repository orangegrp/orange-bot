FROM a4004/orange-bot-drti:latest

COPY . /home/container/orange-bot
WORKDIR /home/container/orange-bot

RUN npm ci
RUN npm run build

USER container
ENV USER=container HOME=/home/container

COPY ./entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["/bin/bash", "/entrypoint.sh"]