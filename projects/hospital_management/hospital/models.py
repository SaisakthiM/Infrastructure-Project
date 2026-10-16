from django.db import models

class Doctor(models.Model):
    name = models.CharField(max_length=100)
    specialty = models.CharField(max_length=100)
    contact = models.CharField(max_length=15)
    consultation_fee = models.PositiveIntegerField(default=150) # Patient spend amount
    doctor_earnings = models.PositiveIntegerField(default=100)   # Doctor payout/earn amount

    def __str__(self):
        return f"Dr. {self.name} ({self.specialty}) - Fee: ₹{self.consultation_fee}"


class Patient(models.Model):
    name = models.CharField(max_length=100)
    age = models.PositiveIntegerField()
    contact = models.CharField(max_length=15)

    def __str__(self):
        return self.name


class Appointment(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE)
    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE)
    date = models.DateField()
    time = models.TimeField()
    fee = models.PositiveIntegerField(default=150)             # Amount charged to patient
    doctor_payout = models.PositiveIntegerField(default=100)   # Amount credited to doctor
    is_completed = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.patient.name} with {self.doctor.name} on {self.date} (₹{self.fee})"

