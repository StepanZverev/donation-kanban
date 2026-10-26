# Образ бэкенда для сервера. Собирается командой из deploy/ (см. deploy/README.md).
FROM python:3.13-slim

# Python не пишет .pyc-файлы и сразу выводит логи (иначе они копятся в буфере)
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

WORKDIR /app

# Сначала только зависимости: пока requirements.txt не менялся, Docker берёт этот шаг из кэша
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY migrations ./migrations

# Один процесс (без --workers): приёмники донатов и живые обновления живут в памяти процесса.
# --proxy-headers: адрес посетителя и https берём из заголовков Caddy, который стоит перед нами
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
