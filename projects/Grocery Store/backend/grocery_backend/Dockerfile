FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
# migrate on start so a fresh volume gets the schema and the seed shelves
CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn grocery_backend.wsgi:application --bind 0.0.0.0:8000 --workers 2"]
