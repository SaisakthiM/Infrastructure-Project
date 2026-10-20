from django.urls import path

from . import views

urlpatterns = [
    # Dashboard
    path("", views.dashboard, name="dashboard"),
    path("api/summary/", views.api_summary, name="api_summary"),

    # Patient Management
    path("patients/", views.manage_patients, name="manage_patients"),
    path("patients/add/", views.add_patient, name="add_patient"),
    path("patients/update/<int:pk>/", views.update_patient, name="update_patient"),

    # Doctor Management
    path("doctors/", views.manage_doctors, name="manage_doctors"),
    path("doctors/add/", views.add_doctor, name="add_doctor"),
    path("doctors/update/<int:pk>/", views.update_doctor, name="update_doctor"),

    # Appointment Management
    path("appointments/", views.manage_appointments, name="manage_appointments"),
    path("appointments/book/", views.book_appointment, name="book_appointment"),
    path("appointments/update/<int:pk>/", views.update_appointment, name="update_appointment"),
    path("appointments/<int:pk>/complete/", views.complete_appointment, name="complete_appointment"),
]
