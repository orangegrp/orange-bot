FROM a4004/orange-bot-drti:latest

COPY --chown=container:container . /home/container/orange-bot
WORKDIR /home/container/orange-bot

RUN npm ci
RUN tsc --sourceMap false \
    --removeComments \
    --downlevelIteration \
    --target es2016 \
    --esModuleInterop \
    --module es2022 \
    --moduleResolution node \
    --project tsconfig.json

USER container
ENV USER=container HOME=/home/container

COPY ./entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["/bin/bash", "/entrypoint.sh"]