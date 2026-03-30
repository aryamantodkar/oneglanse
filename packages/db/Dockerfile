FROM postgres:16

# Install pg_cron and http extension
RUN apt-get update && \
    apt-get install -y \
    postgresql-16-cron \
    postgresql-16-http && \
    rm -rf /var/lib/apt/lists/*
