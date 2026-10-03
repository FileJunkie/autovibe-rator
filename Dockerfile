FROM python:3.12-slim

WORKDIR /workspace

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN pip install uv

ARG VIBE_VERSION=2.25.8
RUN uv tool install mistral-vibe==${VIBE_VERSION}

ENV PATH="/root/.local/bin:${PATH}"

COPY sandbox/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
