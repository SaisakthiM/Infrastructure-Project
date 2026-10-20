from django import forms

from .models import Appointment, Doctor, Patient


class PatientForm(forms.ModelForm):
    class Meta:
        model = Patient
        fields = ["name", "age", "contact"]

    def clean_age(self):
        age = self.cleaned_data["age"]
        if age > 130:
            raise forms.ValidationError("That age doesn't look right.")
        return age


class DoctorForm(forms.ModelForm):
    # optional on the form: a missing fee falls back to the model defaults (150 / 100)
    consultation_fee = forms.IntegerField(required=False, min_value=0, max_value=100000)
    doctor_earnings = forms.IntegerField(required=False, min_value=0, max_value=100000)

    class Meta:
        model = Doctor
        fields = ["name", "specialty", "contact", "consultation_fee", "doctor_earnings"]

    def clean_consultation_fee(self):
        value = self.cleaned_data.get("consultation_fee")
        return 150 if value is None else value

    def clean_doctor_earnings(self):
        value = self.cleaned_data.get("doctor_earnings")
        return 100 if value is None else value


_WIDGETS = {
    "date": forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d"),
    "time": forms.TimeInput(attrs={"type": "time"}, format="%H:%M"),
}


_DATE = forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d")
_TIME = forms.TimeInput(attrs={"type": "time"}, format="%H:%M")


class BookAppointmentForm(forms.ModelForm):
    class Meta:
        model = Appointment
        fields = ["patient", "doctor", "date", "time"]
        widgets = {"date": _DATE, "time": _TIME}
        widgets = _WIDGETS


class RescheduleForm(forms.ModelForm):
    class Meta:
        model = Appointment
        fields = ["date", "time"]
        widgets = {"date": _DATE, "time": _TIME}
        widgets = _WIDGETS
