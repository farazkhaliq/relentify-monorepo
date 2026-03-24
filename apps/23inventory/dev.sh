#!/bin/bash
# Helper script to run npm commands in a container

if [ "$1" = "dev" ]; then
    docker run --rm -it \
        -v $(pwd):/app \
        -w /app \
        -p 3003:3003 \
        --network infra_default \
        -e DATABASE_URL=postgresql://relentify_user:Farazp53!@infra-postgres:5432/inventory?schema=public \
        node:20-alpine \
        sh -c "apk add --no-cache openssl && npm install && npm run dev"
elif [ "$1" = "npm" ]; then
    shift
    docker run --rm -it \
        -v $(pwd):/app \
        -w /app \
        node:20-alpine \
        sh -c "apk add --no-cache openssl && npm $*"
elif [ "$1" = "npx" ]; then
    shift
    docker run --rm -it \
        -v $(pwd):/app \
        -w /app \
        node:20-alpine \
        sh -c "apk add --no-cache openssl && npx --no-install $*"
elif [ "$1" = "prisma" ]; then
    shift
    docker run --rm -it \
        -v $(pwd):/app \
        -w /app \
        --network infra_default \
        -e DATABASE_URL=postgresql://relentify_user:Farazp53!@infra-postgres:5432/inventory?schema=public \
        node:20-alpine \
        sh -c "apk add --no-cache openssl && npx --no-install prisma $*"
else
    echo "Usage: ./dev.sh [dev|npm|npx|prisma] [args]"
fi
