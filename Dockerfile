# Start from the base image
FROM node:20-alpine3.19

# Create a non-root user
RUN adduser --disabled-password --home /home/container container

# Set up Alpine repositories
RUN echo https://dl-cdn.alpinelinux.org/alpine/v3.19/main > /etc/apk/repositories && \
    echo https://dl-cdn.alpinelinux.org/alpine/v3.19/community >> /etc/apk/repositories && \
    echo @edge https://dl-cdn.alpinelinux.org/alpine/edge/community >> /etc/apk/repositories && \
    echo @edge https://dl-cdn.alpinelinux.org/alpine/edge/main >> /etc/apk/repositories

# Install necessary packages
RUN apk add --no-cache --update bash chromium@edge nss@edge wget

# Download dumb-init based on the target platform
ARG TARGETPLATFORM
RUN ["/bin/bash", "-c", "if [ \"$TARGETPLATFORM\" = \"linux/amd64\" ]; then \
      wget https://github.com/Yelp/dumb-init/releases/download/v1.2.5/dumb-init_1.2.5_x86_64 -O /usr/local/bin/dumb-init; \
    elif [ \"$TARGETPLATFORM\" = \"linux/arm64\" ]; then \
      wget https://github.com/Yelp/dumb-init/releases/download/v1.2.5/dumb-init_1.2.5_aarch64 -O /usr/local/bin/dumb-init; \
    fi"]

# Clean up and set permissions
RUN rm -rf /var/cache/apk/* /tmp/* && \
    chmod +x /usr/local/bin/dumb-init

# Set the entry point to dumb-init
ENTRYPOINT ["dumb-init", "--"]

# Set the working directory
WORKDIR /home/container/orange-bot

# Copy application files
COPY --chown=container:container ./docker /home/container/orange-bot

# Set environment variables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV USER=container 
ENV HOME=/home/container 
ENV CHROME_BIN=/usr/bin/chromium-browser
ENV STARTUP="npm run prod"

# Install Node.js dependencies
RUN npm ci

# Copy the entrypoint script and set permissions
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod 777 /entrypoint.sh
RUN chmod u+s /bin/su

# Switch to the non-root user
USER container

# Set the command to run the entrypoint script
CMD ["/bin/bash", "/entrypoint.sh"]