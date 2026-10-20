from .models import Appointment, Doctor, Patient


def scene_stats(request):
    """Numbers the 3D ward on every page uses to size its towers."""
    return {
        "scene_stats": {
            "doctors": Doctor.objects.count(),
            "patients": Patient.objects.count(),
            "appointments": Appointment.objects.count(),
            "pending": Appointment.objects.filter(is_completed=False).count(),
        }
    }
