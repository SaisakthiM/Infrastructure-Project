FROM minio/minio:latest
COPY start-minio.sh /usr/bin/start-minio.sh
RUN chmod +x /usr/bin/start-minio.sh
ENTRYPOINT ["/usr/bin/start-minio.sh"]