import json
import os
import time

METRICS_LOG_PATH = '/home/saisakthi/Infrastructure-Project/projects/hospital_management/metrics.jsonl'

def log_hospital_financial_event(event_type, details):
    """
    Records healthcare earning/spending events to be synced to MinIO analytics.
    event_type: 'patient_spend' | 'doctor_earn' | 'appointment_booked'
    """
    entry = {
        'service': 'hospital',
        'event_type': event_type,
        'timestamp': int(time.time()),
        'iso_time': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'data': details
    }
    try:
        with open(METRICS_LOG_PATH, 'a', encoding='utf-8') as f:
            f.write(json.dumps(entry) + '\n')
    except Exception as e:
        print(f"Failed to record hospital metric event: {e}")
