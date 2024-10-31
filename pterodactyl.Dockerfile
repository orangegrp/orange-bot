# Start from the base image
FROM a4004/orange-bot

USER root

RUN mv /home/container/orange-bot /home/orange-bot
COPY ./entrypoint-pterodactyl.sh /entrypoint.sh

USER container