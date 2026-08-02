FROM python:3.12-slim

WORKDIR /app
ENV HOME=/app \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# Rahti/OpenShift runs containers under a random non-root UID that belongs to
# the root group, so make the app dir group-writable/readable rather than
# relying on a fixed UID.
RUN chgrp -R 0 /app && chmod -R g=u /app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
