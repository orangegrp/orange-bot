#!/bin/bash

# move files to home dir
mv -f /home/orange-bot /home/container/orange-bot > /dev/null

cd /home/container/orange-bot

# Replace Startup Variables
MODIFIED_STARTUP=`eval echo $(echo ${STARTUP} | sed -e 's/{{/${/g' -e 's/}}/}/g')`
echo ":/home/container$ ${MODIFIED_STARTUP}"

# Run the Server
${MODIFIED_STARTUP}