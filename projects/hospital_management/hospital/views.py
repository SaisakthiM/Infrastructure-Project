from django.shortcuts import render, redirect, get_object_or_404
from .models import Patient, Doctor, Appointment

def dashboard(request):
    context = {
        "doctor_count": Doctor.objects.count(),
        "patient_count": Patient.objects.count(),
        "appointment_count": Appointment.objects.count(),
    }
    return render(request, "dashboard.html", context)

def manage_patients(request):
    patients = Patient.objects.all()
    return render(request, "patients/list.html", {"patients": patients})

def add_patient(request):
    if request.method == "POST":
        name = request.POST['name']
        age = request.POST['age']
        contact = request.POST['contact']
        Patient.objects.create(name=name, age=age, contact=contact)
        return redirect('manage_patients')
    return render(request, "patients/add.html")

def update_patient(request, pk):
    patient = get_object_or_404(Patient, pk=pk)
    if request.method == "POST":
        patient.name = request.POST['name']
        patient.age = request.POST['age']
        patient.contact = request.POST['contact']
        patient.save()
        return redirect('manage_patients')
    return render(request, "patients/update.html", {"patient": patient})

# Similar views for Doctors and Appointments...
def manage_doctors(request):
    doctors = Doctor.objects.all()
    return render(request, "doctors/list.html", {"doctors": doctors})

def add_doctor(request):
    if request.method == "POST":
        name = request.POST['name']
        specialty = request.POST['specialty']
        contact = request.POST['contact']
        Doctor.objects.create(name=name, specialty=specialty, contact=contact)
        return redirect('manage_doctors')
    return render(request, "doctors/add.html")

def update_doctor(request, pk):
    doctor = get_object_or_404(Doctor, pk=pk)
    if request.method == "POST":
        doctor.name = request.POST['name']
        doctor.specialty = request.POST['specialty']
        doctor.contact = request.POST['contact']
        doctor.save()
        return redirect('manage_doctors')
    return render(request, "doctors/update.html", {"doctor": doctor})

def manage_appointments(request):
    appointments = Appointment.objects.select_related('patient', 'doctor').all()
    return render(request, "appointments/list.html", {"appointments": appointments})

def book_appointment(request):
    if request.method == "POST":
        patient_id = request.POST['patient']
        doctor_id = request.POST['doctor']
        date = request.POST['date']
        time = request.POST['time']
        patient = get_object_or_404(Patient, id=patient_id)
        doctor = get_object_or_404(Doctor, id=doctor_id)
        Appointment.objects.create(patient=patient, doctor=doctor, date=date, time=time)
        return redirect('manage_appointments')
    context = {
        "patients": Patient.objects.all(),
        "doctors": Doctor.objects.all()
    }
    return render(request, "appointments/book.html", context)

def update_appointment(request, pk):
    appointment = get_object_or_404(Appointment, pk=pk)
    if request.method == "POST":
        appointment.date = request.POST['date']
        appointment.time = request.POST['time']
        appointment.save()
        return redirect('manage_appointments')
    context = {
        "appointment": appointment,
        "patients": Patient.objects.all(),
        "doctors": Doctor.objects.all()
    }
    return render(request, "appointments/update.html", context)
