FROM docker:cli
RUN apk add --no-cache nodejs
WORKDIR /agent
COPY agent.js ./
ENV CONTROL_URL=http://sp-backend:8081
ENV HEARTBEAT_INTERVAL=30000
ENV DEPLOY_DIR=/opt/serverpilot/apps
ENV BACKUP_DIR=/opt/serverpilot/backups
ENTRYPOINT []
CMD ["node", "agent.js"]
