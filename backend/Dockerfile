FROM node:26-slim

# Install system dependencies:
# - python3, python3-pip, python3-venv for DSP & AI worker
# - libsndfile1 for 24/32-bit float WAV audio decoding and encoding
# - openssl for Prisma ORM
# - curl for Docker container healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    libsndfile1 \
    openssl \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python worker dependencies
COPY worker/requirements.txt ./worker/
RUN pip3 install --no-cache-dir --break-system-packages \
    numpy \
    scipy \
    soundfile \
    boto3 \
    redis \
    python-dotenv \
    requests

# Install Backend dependencies
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma/
WORKDIR /app/backend
RUN npm install
RUN npx prisma generate

# Copy application source code
WORKDIR /app
COPY worker/ ./worker/
COPY backend/ ./backend/

WORKDIR /app/backend
EXPOSE 5000

# Default command: run migrations and start server
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
