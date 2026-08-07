ARG NODE_VERSION=20-alpine
FROM node:${NODE_VERSION}

WORKDIR /app

# Install docker-compose
RUN apk add --no-cache docker-compose curl python3 py3-pip

# Copy package files
COPY gateway/package*.json ./gateway/
COPY backend ./backend/
COPY chaincode ./chaincode/
COPY client ./client/
COPY network ./network/
COPY scripts ./scripts/
COPY docs ./docs/
COPY tests ./tests/

# Install dependencies
WORKDIR /app/gateway
RUN npm install --production

# Copy env file if exists, otherwise create one
WORKDIR /app
RUN if [ ! -f gateway/.env ]; then \
    echo "PORT=3000" > gateway/.env && \
    echo "JWT_SECRET=${JWT_SECRET:-change-me-in-production}" >> gateway/.env && \
    echo "FILE_TOKEN_SECRET=${FILE_TOKEN_SECRET:-change-me-in-production}" >> gateway/.env && \
    echo "COUCHDB_PASSWORD=${COUCHDB_PASSWORD:-couchdb_password}" >> gateway/.env && \
    echo "ENABLE_FABRIC_SDK=${ENABLE_FABRIC_SDK:-true}" >> gateway/.env && \
    echo "FABRIC_IDENTITY=appUser" >> gateway/.env && \
    echo "FABRIC_NETWORK_PATH=/app/network" >> gateway/.env; \
    fi

WORKDIR /app/gateway
EXPOSE 3000
CMD ["npm", "start"]