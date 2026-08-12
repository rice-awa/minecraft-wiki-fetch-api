FROM python:3.14-alpine

WORKDIR /app

ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG NO_PROXY

COPY requirements.txt .
RUN HTTPS_PROXY=$HTTPS_PROXY HTTP_PROXY=$HTTP_PROXY NO_PROXY=$NO_PROXY \
    pip install --no-cache-dir -r requirements.txt

COPY server.py .

CMD ["python", "server.py"]
