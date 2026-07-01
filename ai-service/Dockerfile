FROM python:3.11.9-slim

WORKDIR /app

COPY requirements-deploy.txt .
# Use CPU wheels for the public test service. The optional RTMW stack requires
# a separate GPU image and must not pull CUDA packages into this container.
RUN pip install --no-cache-dir --index-url https://download.pytorch.org/whl/cpu torch torchvision \
  && pip install --no-cache-dir -r requirements-deploy.txt

COPY . .

ENV SIGNOVA_AI_HOST=0.0.0.0
ENV SIGNOVA_AI_PORT=8000
ENV SIGNOVA_RTMW_ENABLED=0
ENV SIGNOVA_MAX_CONCURRENT_INFERENCES=1

EXPOSE 8000

CMD ["python", "signova.py", "--ai-only"]
