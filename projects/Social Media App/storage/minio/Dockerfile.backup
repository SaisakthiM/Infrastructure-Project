FROM minio/minio:latest

# Create entrypoint script
RUN echo '#!/bin/sh' > /usr/bin/init-buckets.sh && \
    echo 'minio server /data --console-address ":9004" &' >> /usr/bin/init-buckets.sh && \
    echo 'sleep 5' >> /usr/bin/init-buckets.sh && \
    echo 'mc alias set myminio http://localhost:9000 minio minio123' >> /usr/bin/init-buckets.sh && \
    echo 'mc mb myminio/media --ignore-existing' >> /usr/bin/init-buckets.sh && \
    echo 'mc mb myminio/tempo --ignore-existing' >> /usr/bin/init-buckets.sh && \
    echo 'mc anonymous set download myminio/media' >> /usr/bin/init-buckets.sh && \
    echo 'wait' >> /usr/bin/init-buckets.sh && \
    chmod +x /usr/bin/init-buckets.sh

ENTRYPOINT ["/usr/bin/init-buckets.sh"]