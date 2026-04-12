# Сборка: context = корень репозитория (docker-compose), см. COPY-пути с префиксом ai-bot/
FROM python:3.12-slim
WORKDIR /app
RUN mkdir -p /app/config

COPY ai-bot/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ai-bot/main.py .

# Базовый промпт в образе; volume в compose при наличии файла на хосте перекрывает
COPY config/ai-system-prompt.txt /app/config/ai-system-prompt.txt

EXPOSE 5005
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5005"]
