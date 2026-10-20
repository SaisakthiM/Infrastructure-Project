import json
import time

from django.conf import settings


def log_hospital_financial_event(event_type, details):
    """
    Append an earning/spending event to a JSONL file that the analytics pipeline ships to MinIO.
    event_type: 'appointment_booked' | 'appointment_completed'
    Location comes from settings.HOSPITAL_METRICS_LOG (env HOSPITAL_METRICS_LOG); never raises.
    """
    entry = {
        "service": "hospital",
        "event_type": event_type,
        "timestamp": int(time.time()),
        "iso_time": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "data": details,
    }
    try:
        with open(settings.HOSPITAL_METRICS_LOG, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry) + "\n")
    except OSError as exc:
        print(f"Failed to record hospital metric event: {exc}")
