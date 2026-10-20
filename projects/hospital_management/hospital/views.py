from django.db import transaction
from django.db.models import Sum
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.http import require_GET, require_POST

from .city_identity import identity_for
from .forms import BookAppointmentForm, DoctorForm, PatientForm, RescheduleForm
from .metrics_logger import log_hospital_financial_event
from .models import Appointment, Doctor, Patient


def _wants_json(request):
    return request.headers.get("X-Requested-With") == "fetch"


def _summary():
    paid = Appointment.objects.filter(paid=True)
    return {
        "doctor_count": Doctor.objects.count(),
        "patient_count": Patient.objects.count(),
        "appointment_count": Appointment.objects.count(),
        "pending_count": Appointment.objects.filter(is_completed=False).count(),
        "completed_count": Appointment.objects.filter(is_completed=True).count(),
        "revenue": paid.aggregate(total=Sum("fee"))["total"] or 0,
    }


# ─── Dashboard ──────────────────────────────────────────────────────────────

def dashboard(request):
    context = _summary()
    context["upcoming"] = (
        Appointment.objects.filter(is_completed=False).select_related("patient", "doctor")[:6]
    )
    return render(request, "dashboard.html", context)


@require_GET
def api_summary(request):
    return JsonResponse(_summary())


# ─── Patients ───────────────────────────────────────────────────────────────

def manage_patients(request):
    return render(request, "patients/list.html", {"patients": Patient.objects.all()})


def add_patient(request):
    form = PatientForm(request.POST) if request.method == "POST" else PatientForm()
    if request.method == "POST" and form.is_valid():
        form.save()
        return redirect("manage_patients")
    return render(request, "patients/add.html", {"form": form})


def update_patient(request, pk):
    patient = get_object_or_404(Patient, pk=pk)
    form = PatientForm(request.POST, instance=patient) if request.method == "POST" else PatientForm(instance=patient)
    if request.method == "POST" and form.is_valid():
        form.save()
        return redirect("manage_patients")
    return render(request, "patients/update.html", {"form": form, "patient": patient})


# ─── Doctors ────────────────────────────────────────────────────────────────

def manage_doctors(request):
    return render(request, "doctors/list.html", {"doctors": Doctor.objects.all()})


def add_doctor(request):
    form = DoctorForm(request.POST) if request.method == "POST" else DoctorForm()
    if request.method == "POST" and form.is_valid():
        form.save()
        return redirect("manage_doctors")
    return render(request, "doctors/add.html", {"form": form})


def update_doctor(request, pk):
    doctor = get_object_or_404(Doctor, pk=pk)
    form = DoctorForm(request.POST, instance=doctor) if request.method == "POST" else DoctorForm(instance=doctor)
    if request.method == "POST" and form.is_valid():
        form.save()
        return redirect("manage_doctors")
    return render(request, "doctors/update.html", {"form": form, "doctor": doctor})


# ─── Appointments ───────────────────────────────────────────────────────────

def manage_appointments(request):
    appointments = Appointment.objects.select_related("patient", "doctor")
    return render(request, "appointments/list.html", {"appointments": appointments})


def book_appointment(request):
    """
    Browser flow (hospital-city.js): the citizen's bank is charged first, then the form is POSTed with
    X-City-Paid plus their bank identity. We verify the identity with the bank and mark the visit as paid.
    A plain form POST (no headers) still books the visit, just unpaid.
    """
    if request.method == "POST":
        form = BookAppointmentForm(request.POST)
        if form.is_valid():
            doctor = form.cleaned_data["doctor"]
            payer = identity_for(request) if request.headers.get("X-City-Paid") else None

            appointment = form.save(commit=False)
            appointment.fee = doctor.consultation_fee
            appointment.doctor_payout = doctor.doctor_earnings
            appointment.paid = bool(payer)
            appointment.payer = payer or ""
            appointment.save()

            log_hospital_financial_event(
                "appointment_booked",
                {
                    "appointment_id": appointment.id,
                    "patient": appointment.patient.name,
                    "doctor": doctor.name,
                    "patient_spent": appointment.fee,
                    "doctor_earned": appointment.doctor_payout,
                    "paid": appointment.paid,
                    "payer": appointment.payer,
                },
            )
            if _wants_json(request):
                return JsonResponse({"ok": True, "id": appointment.id, "fee": appointment.fee, "paid": appointment.paid}, status=201)
            return redirect("manage_appointments")
        if _wants_json(request):
            return JsonResponse({"ok": False, "errors": form.errors.get_json_data()}, status=400)
    else:
        form = BookAppointmentForm()

    context = {"form": form, "patients": Patient.objects.all(), "doctors": Doctor.objects.all()}
    return render(request, "appointments/book.html", context)


def update_appointment(request, pk):
    appointment = get_object_or_404(Appointment, pk=pk)
    form = RescheduleForm(request.POST, instance=appointment) if request.method == "POST" else RescheduleForm(instance=appointment)
    if request.method == "POST" and form.is_valid():
        form.save()
        return redirect("manage_appointments")
    return render(request, "appointments/update.html", {"form": form, "appointment": appointment})


@require_POST
def complete_appointment(request, pk):
    """A logged-in citizen treats a patient and earns the doctor payout (credited by the browser via the bank)."""
    who = identity_for(request)
    if not who:
        return JsonResponse({"ok": False, "error": "Log in to the city bank to treat patients."}, status=401)

    with transaction.atomic():
        appointment = get_object_or_404(Appointment.objects.select_for_update(), pk=pk)
        if appointment.is_completed:
            return JsonResponse({"ok": False, "error": "This visit has already been treated."}, status=409)
        appointment.is_completed = True
        appointment.completed_by = who
        appointment.completed_at = timezone.now()
        appointment.save(update_fields=["is_completed", "completed_by", "completed_at"])

    log_hospital_financial_event(
        "appointment_completed",
        {
            "appointment_id": appointment.id,
            "doctor": appointment.doctor.name,
            "doctor_earned": appointment.doctor_payout,
            "treated_by": who,
        },
    )
    return JsonResponse({"ok": True, "appointment": appointment.id, "payout": appointment.doctor_payout})
