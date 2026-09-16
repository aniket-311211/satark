FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    SATARK_DATA_DIR=/srv/data \
    SATARK_REPORTS_DIR=/srv/reports

WORKDIR /srv/app
COPY backend/pyproject.toml ./
COPY backend/satark ./satark
RUN pip install --no-cache-dir .
COPY data /srv/data
COPY reports /srv/reports

EXPOSE 8000
CMD ["satark", "serve", "--host", "0.0.0.0", "--port", "8000"]
