FROM python:3.11-slim-bookworm

ARG NALARIN_COMMIT=c500cc5a132142ff3de815bf6d15c50d490ea522

RUN apt-get update && apt-get install -y --no-install-recommends \
    git gcc libpq-dev libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/masgant99/nalarin-agentic-ads-studio.git /src \
    && cd /src \
    && git checkout "$NALARIN_COMMIT"

WORKDIR /app
COPY deploy/railway-api/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
    && cp /src/backend/requirements.txt /app/requirements.txt \
    && pip install --no-cache-dir -r /app/requirements.txt \
    && pip install --no-cache-dir playwright \
    && playwright install chromium \
    && cp -R /src/backend/. /app/ \
    && mkdir -p /app/uploads

ENV PYTHONUNBUFFERED=1
ENV BRAND_NAME="Creative OS"
ENV TRUSTED_PROXIES="*"

EXPOSE 8000
ENTRYPOINT ["/entrypoint.sh"]
