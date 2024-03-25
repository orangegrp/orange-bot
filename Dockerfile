FROM a4004/orange-bot-drti:latest

COPY --chown=container:container ./docker /home/container/orange-bot
WORKDIR /home/container/orange-bot

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN npm ci

USER container
ENV USER=container 
ENV HOME=/home/container 
ENV CHROME_BIN=/usr/bin/chromium-browser

COPY --chown=container:container ./entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["/bin/bash", "/entrypoint.sh"]