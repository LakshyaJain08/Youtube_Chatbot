# ==============================================================================
# Stage 1: Build & Automated Test Stage
# ==============================================================================
FROM python:3.10-slim AS builder

WORKDIR /app

# Install system compilation and network utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies in isolated user directory
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Copy application source code for containerized test validation
COPY . .

# Run test suite to validate API endpoints and pipeline integrity prior to release
ENV PYTHONPATH=/app
ENV PATH=/root/.local/bin:$PATH
RUN pytest tests/ -v

# ==============================================================================
# Stage 2: Production Lean Runtime Stage
# ==============================================================================
FROM python:3.10-slim AS runner

WORKDIR /app

# Install runtime utilities (curl for container health probes)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Security hardening: Create non-root system user and group
RUN groupadd -g 1000 appgroup && \
    useradd -u 1000 -g appgroup -m -s /bin/bash appuser

# Copy installed Python packages from builder stage
COPY --from=builder /root/.local /home/appuser/.local

# Copy application source code with non-root ownership
COPY --chown=appuser:appgroup . /app

# Pre-create directory tree and enforce non-root permissions
RUN mkdir -p /app/models /app/logs /app/data /app/outputs && \
    chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Configure environment path and Python unbuffered logging
ENV PATH=/home/appuser/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000 \
    HOST=0.0.0.0

# Expose server port
EXPOSE 8000

# Container Healthcheck Probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Launch FastAPI server via uvicorn
CMD ["uvicorn", "app.api:app", "--host", "0.0.0.0", "--port", "8000"]
