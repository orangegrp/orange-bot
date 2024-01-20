FROM a4004/orange-bot-drti:latest

COPY --chown=container:container . /home/container/orange-bot
WORKDIR /home/container/orange-bot

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN npm ci
RUN npm install -g typescript
RUN tsc --sourceMap false \
    --removeComments \
    --downlevelIteration \
    --target es2016 \
    --esModuleInterop \
    --module es2022 \
    --moduleResolution node \
    --project tsconfig.json
RUN npm remove -g typescript
RUN npm dedup

USER container
ENV USER=container 
ENV HOME=/home/container 
ENV CHROME_BIN=/usr/bin/chromium-browser

COPY ./entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["/bin/bash", "/entrypoint.sh"]