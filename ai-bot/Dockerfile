FROM python:3.12-slim
WORKDIR /app
# Каталог для volume из docker-compose: ./config/ai-system-prompt.txt → /app/config/ai-system-prompt.txt
RUN mkdir -p /app/config
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .
EXPOSE 5005
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5005"]
