FROM python:3.11.9-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY requirements-rtmw.txt .
RUN pip install --no-cache-dir -r requirements-rtmw.txt

COPY . .

ENV SIGNOVA_AI_HOST=0.0.0.0
ENV SIGNOVA_AI_PORT=8000

EXPOSE 8000

CMD ["python", "signova.py"]
