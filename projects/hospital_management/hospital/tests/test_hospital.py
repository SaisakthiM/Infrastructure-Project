import os
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import Client, TestCase, override_settings

from hospital.models import Appointment, Doctor, Patient


# The suite is run both with test_settings and with the production settings (entrypoint.sh), so the
# analytics log is silenced here instead of relying on which settings module happens to be active.
@override_settings(HOSPITAL_METRICS_LOG=os.devnull)
class HospitalTest(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(
            username="tester",
            password="tester123"
        )
        self.client = Client()

    def _doctor(self, **kwargs):
        data = {"name": "test", "specialty": "orthology", "contact": "2231012232"}
        data.update(kwargs)
        return Doctor.objects.create(**data)

    def _patient(self, **kwargs):
        data = {"name": "sai", "age": 24, "contact": "2345612345"}
        data.update(kwargs)
        return Patient.objects.create(**data)

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

    def test_every_list_and_form_page_renders(self):
        doctor = self._doctor()
        patient = self._patient()
        appointment = Appointment.objects.create(
            patient=patient, doctor=doctor, date="2026-12-23", time="09:00:00"
        )
        for url in (
            "/hospital/",
            "/hospital/patients/",
            "/hospital/patients/add/",
            f"/hospital/patients/update/{patient.pk}/",
            "/hospital/doctors/",
            "/hospital/doctors/add/",
            f"/hospital/doctors/update/{doctor.pk}/",
            "/hospital/appointments/",
            "/hospital/appointments/book/",
            f"/hospital/appointments/update/{appointment.pk}/",
        ):
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, 200)

    # ─── DOCTOR ───────────────────────────────────────────────

    def test_add_new_doctor(self):
        doctor = self._doctor()
        self.assertEqual(str(doctor), "test")

    def test_delete_doctor(self):
        doctor = self._doctor()
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

    def test_new_doctor_without_fees_gets_defaults(self):
        self.client.post("/hospital/doctors/add/", data={
            "name": "Dr. Smith", "specialty": "cardiology", "contact": "9876543210"
        })
        doctor = Doctor.objects.get()
        self.assertEqual(doctor.consultation_fee, 150)
        self.assertEqual(doctor.doctor_earnings, 100)

    def test_new_doctor_with_custom_fees(self):
        self.client.post("/hospital/doctors/add/", data={
            "name": "Dr. Rao", "specialty": "neurology", "contact": "9876543210",
            "consultation_fee": "400", "doctor_earnings": "260",
        })
        doctor = Doctor.objects.get()
        self.assertEqual((doctor.consultation_fee, doctor.doctor_earnings), (400, 260))

    def test_update_doctor_changes_fee(self):
        doctor = self._doctor()
        response = self.client.post(f"/hospital/doctors/update/{doctor.pk}/", data={
            "name": "test", "specialty": "orthology", "contact": "2231012232",
            "consultation_fee": "500", "doctor_earnings": "350",
        })
        self.assertEqual(response.status_code, 302)
        doctor.refresh_from_db()
        self.assertEqual(doctor.consultation_fee, 500)

    def test_doctor_without_name_is_rejected(self):
        response = self.client.post("/hospital/doctors/add/", data={
            "specialty": "cardiology", "contact": "9876543210"
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Doctor.objects.count(), 0)

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
        patient = self._patient()
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
        patient = self._patient()
        patient.delete()
        self.assertEqual(Patient.objects.count(), 0)

    def test_patient_with_impossible_age_is_rejected(self):
        response = self.client.post("/hospital/patients/add/", data={
            "name": "old", "age": "250", "contact": "345612345"
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Patient.objects.count(), 0)

    # ─── APPOINTMENT ──────────────────────────────────────────

    def test_add_new_appointment(self):
        doctor = self._doctor()
        patient = self._patient(name="test", contact="2344512334")
        appointment = Appointment.objects.create(
            patient=patient,
            doctor=doctor,
            date="2026-12-23",
            time="09:00:00"
        )
        self.assertEqual(str(appointment), "test with test on 2026-12-23")

    def test_book_appointment(self):
        patient = self._patient()
        doctor = self._doctor()
        self.client.login(username="tester", password="tester123")
        response = self.client.post("/hospital/appointments/book/", data={
            "patient": patient.pk,
            "doctor": doctor.pk,
            "date": "2026-11-12",
            "time": "09:00:00"
        })
        self.assertEqual(response.status_code, 302)
        self.assertEqual(Appointment.objects.count(), 1)

    def test_booking_snapshots_fee_and_payout(self):
        patient = self._patient()
        doctor = self._doctor(consultation_fee=300, doctor_earnings=210)
        self.client.post("/hospital/appointments/book/", data={
            "patient": patient.pk, "doctor": doctor.pk, "date": "2026-11-12", "time": "09:00"
        })
        doctor.consultation_fee = 999
        doctor.save()
        appointment = Appointment.objects.get()
        self.assertEqual((appointment.fee, appointment.doctor_payout), (300, 210))

    def test_booking_without_city_identity_is_unpaid(self):
        patient = self._patient()
        doctor = self._doctor()
        self.client.post("/hospital/appointments/book/", data={
            "patient": patient.pk, "doctor": doctor.pk, "date": "2026-11-12", "time": "09:00"
        })
        appointment = Appointment.objects.get()
        self.assertFalse(appointment.paid)
        self.assertEqual(appointment.payer, "")

    def test_booking_with_verified_identity_is_paid(self):
        patient = self._patient()
        doctor = self._doctor()
        with patch("hospital.views.identity_for", return_value="citizen1"):
            response = self.client.post(
                "/hospital/appointments/book/",
                data={"patient": patient.pk, "doctor": doctor.pk, "date": "2026-11-12", "time": "09:00"},
                headers={"X-City-Paid": "1", "X-Requested-With": "fetch"},
            )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.json()["paid"])
        appointment = Appointment.objects.get()
        self.assertTrue(appointment.paid)
        self.assertEqual(appointment.payer, "citizen1")

    def test_paid_claim_without_verified_identity_is_ignored(self):
        patient = self._patient()
        doctor = self._doctor()
        with patch("hospital.views.identity_for", return_value=None):
            self.client.post(
                "/hospital/appointments/book/",
                data={"patient": patient.pk, "doctor": doctor.pk, "date": "2026-11-12", "time": "09:00"},
                headers={"X-City-Paid": "1"},
            )
        self.assertFalse(Appointment.objects.get().paid)

    def test_booking_validation_error_returns_json_for_fetch(self):
        response = self.client.post(
            "/hospital/appointments/book/",
            data={"date": "2026-11-12"},
            headers={"X-Requested-With": "fetch"},
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()["ok"])
        self.assertEqual(Appointment.objects.count(), 0)

    def test_deleting_patient_deletes_appointments(self):
        patient = self._patient()
        doctor = self._doctor()
        Appointment.objects.create(
            patient=patient,
            doctor=doctor,
            date="2026-11-12",
            time="09:00:00"
        )
        patient.delete()
        self.assertEqual(Appointment.objects.count(), 0)

    def test_reschedule_appointment(self):
        appointment = Appointment.objects.create(
            patient=self._patient(), doctor=self._doctor(), date="2026-11-12", time="09:00:00"
        )
        response = self.client.post(f"/hospital/appointments/update/{appointment.pk}/", data={
            "date": "2026-12-01", "time": "10:30"
        })
        self.assertEqual(response.status_code, 302)
        appointment.refresh_from_db()
        self.assertEqual(str(appointment.date), "2026-12-01")

    # ─── TREATING PATIENTS (doctor earnings) ──────────────────

    def _appointment(self):
        return Appointment.objects.create(
            patient=self._patient(), doctor=self._doctor(doctor_earnings=180),
            date="2026-11-12", time="09:00:00", doctor_payout=180,
        )

    def test_complete_requires_a_verified_citizen(self):
        appointment = self._appointment()
        with patch("hospital.views.identity_for", return_value=None):
            response = self.client.post(f"/hospital/appointments/{appointment.pk}/complete/")
        self.assertEqual(response.status_code, 401)
        appointment.refresh_from_db()
        self.assertFalse(appointment.is_completed)

    def test_complete_pays_out_exactly_once(self):
        appointment = self._appointment()
        with patch("hospital.views.identity_for", return_value="doc_sai"):
            first = self.client.post(f"/hospital/appointments/{appointment.pk}/complete/")
            second = self.client.post(f"/hospital/appointments/{appointment.pk}/complete/")
        self.assertEqual(first.status_code, 200)
        self.assertEqual(first.json()["payout"], 180)
        self.assertEqual(second.status_code, 409)
        appointment.refresh_from_db()
        self.assertTrue(appointment.is_completed)
        self.assertEqual(appointment.completed_by, "doc_sai")

    def test_complete_rejects_get(self):
        appointment = self._appointment()
        response = self.client.get(f"/hospital/appointments/{appointment.pk}/complete/")
        self.assertEqual(response.status_code, 405)

    def test_complete_unknown_appointment_is_404(self):
        with patch("hospital.views.identity_for", return_value="doc_sai"):
            response = self.client.post("/hospital/appointments/9999/complete/")
        self.assertEqual(response.status_code, 404)

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

    def test_summary_api(self):
        appointment = self._appointment()
        appointment.paid = True
        appointment.fee = 220
        appointment.save()
        data = self.client.get("/hospital/api/summary/").json()
        self.assertEqual(data["appointment_count"], 1)
        self.assertEqual(data["pending_count"], 1)
        self.assertEqual(data["revenue"], 220)
