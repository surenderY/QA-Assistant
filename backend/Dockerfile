FROM python:3.12-slim

# ── System deps ────────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# ── Git config for the Git Agent ──────────────────────────────────────────
RUN git config --global user.email "testgen@company.com" && \
    git config --global user.name "TestGen Bot"

WORKDIR /app

# ── Python dependencies ────────────────────────────────────────────────────
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ── App source ─────────────────────────────────────────────────────────────
COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
