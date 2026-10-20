from django.db import models


class Doctor(models.Model):
    name = models.CharField(max_length=100)
    specialty = models.CharField(max_length=100)
    contact = models.CharField(max_length=15)
    # city economy (whole rupees)
    consultation_fee = models.PositiveIntegerField(default=150)  # what a patient pays for a visit
    doctor_earnings = models.PositiveIntegerField(default=100)   # what the treating doctor earns per visit

    def __str__(self):
        return self.name


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

    # money snapshot taken at booking time, so later fee changes never rewrite history
    fee = models.PositiveIntegerField(default=150)
    doctor_payout = models.PositiveIntegerField(default=100)

    # who paid / who treated (city bank usernames, verified against the bank when available)
    paid = models.BooleanField(default=False)
    payer = models.CharField(max_length=60, blank=True, default="")
    is_completed = models.BooleanField(default=False)
    completed_by = models.CharField(max_length=60, blank=True, default="")
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["date", "time", "id"]

    def __str__(self):
        return f"{self.patient.name} with {self.doctor.name} on {self.date}"
