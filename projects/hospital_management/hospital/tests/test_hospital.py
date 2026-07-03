from django.test import TestCase, Client
from django.contrib.auth.models import User
from hospital.models import Doctor, Patient, Appointment


class HospitalTest(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="tester",
            password="tester123"
        )
        self.client = Client()

    # ─── AUTH ─────────────────────────────────────────────────

    def test_if_user_can_login(self):
        response = self.client.login(username="tester", password="tester123")
        self.assertTrue(response)

    def test_user_can_login_with_wrong_credentials(self):
        response = self.client.login(username="test", password="test123")
        self.assertFalse(response)

    # ─── PAGES ────────────────────────────────────────────────

    def test_home_page(self):
        response = self.client.get("/hospital/")
        self.assertEqual(response.status_code, 200)

    def test_if_user_can_get_patient(self):
        self.client.login(username="tester", password="tester123")
        response = self.client.get("/hospital/patients/")
        self.assertEqual(response.status_code, 200)

    # ─── DOCTOR ───────────────────────────────────────────────

    def test_add_new_doctor(self):
        doctor = Doctor.objects.create(
            name="test",
            specialty="orthology",
            contact="2231012232"
        )
        self.assertEqual(str(doctor), "test")

    def test_delete_doctor(self):
        doctor = Doctor.objects.create(
            name="test",
            specialty="orthology",
            contact="2231012232"
        )
        doctor.delete()
        self.assertEqual(Doctor.objects.count(), 0)

    def test_if_user_can_create_new_doctor(self):
        self.client.login(username="tester", password="tester123")
        response = self.client.post("/hospital/doctors/add/", data={
            "name": "Dr. Smith",
            "specialty": "cardiology",
            "contact": "9876543210"
        })
        self.assertEqual(response.status_code, 302)
        self.assertEqual(Doctor.objects.count(), 1)

    # ─── PATIENT ──────────────────────────────────────────────

    def test_add_new_patient(self):
        patient = Patient.objects.create(
            name="test",
            age=24,
            contact="2344512334"
        )
        self.assertEqual(str(patient), "test")

    def test_if_user_can_create_new_patient(self):
        self.client.login(username="tester", password="tester123")
        response = self.client.post("/hospital/patients/add/", data={
            "name": "sai",
            "age": "24",
            "contact": "345612345"
        })
        self.assertEqual(response.status_code, 302)
        self.assertEqual(Patient.objects.count(), 1)

    def test_if_user_can_edit_patient(self):
        patient = Patient.objects.create(
            name="sai",
            age=24,
            contact="2345612345"
        )
        self.client.login(username="tester", password="tester123")
        response = self.client.post(f"/hospital/patients/update/{patient.pk}/", data={
            "name": "saisakthi",
            "age": "24",
            "contact": "345612345"
        })
        self.assertEqual(response.status_code, 302)
        patient.refresh_from_db()
        self.assertEqual(patient.name, "saisakthi")

    def test_if_user_can_delete_patient(self):
        patient = Patient.objects.create(
            name="sai",
            age=24,
            contact="2345612345"
        )
        patient.delete()
        self.assertEqual(Patient.objects.count(), 0)

    # ─── APPOINTMENT ──────────────────────────────────────────

    def test_add_new_appointment(self):
        doctor = Doctor.objects.create(
            name="test",
            specialty="orthology",
            contact="2231012232"
        )
        patient = Patient.objects.create(
            name="test",
            age=24,
            contact="2344512334"
        )
        appointment = Appointment.objects.create(
            patient=patient,
            doctor=doctor,
            date="2026-12-23",
            time="09:00:00"
        )
        self.assertEqual(str(appointment), "test with test on 2026-12-23")

    def test_book_appointment(self):
        patient = Patient.objects.create(
            name="sai",
            age=24,
            contact="2345612345"
        )
        doctor = Doctor.objects.create(
            name="test",
            specialty="orthology",
            contact="2231012232"
        )
        self.client.login(username="tester", password="tester123")
        response = self.client.post("/hospital/appointments/book/", data={
            "patient": patient.pk,
            "doctor": doctor.pk,
            "date": "2026-11-12",
            "time": "09:00:00"
        })
        self.assertEqual(response.status_code, 302)
        self.assertEqual(Appointment.objects.count(), 1)

    def test_deleting_patient_deletes_appointments(self):
        patient = Patient.objects.create(
            name="sai",
            age=24,
            contact="2345612345"
        )
        doctor = Doctor.objects.create(
            name="test",
            specialty="orthology",
            contact="2231012232"
        )
        Appointment.objects.create(
            patient=patient,
            doctor=doctor,
            date="2026-11-12",
            time="09:00:00"
        )
        patient.delete()
        self.assertEqual(Appointment.objects.count(), 0)

    # ─── DASHBOARD ────────────────────────────────────────────

    def test_dashboard_shows_correct_counts(self):
        Doctor.objects.create(name="test1", specialty="pathology", contact="2231012232")
        Doctor.objects.create(name="test2", specialty="orthology", contact="2231012232")
        Patient.objects.create(name="sai", age=24, contact="2345612345")
        self.client.login(username="tester", password="tester123")
        response = self.client.get("/hospital/")
        self.assertEqual(response.context["doctor_count"], 2)
        self.assertEqual(response.context["patient_count"], 1)
        self.assertEqual(response.context["appointment_count"], 0)