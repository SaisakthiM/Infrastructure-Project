from rest_framework.authentication import BaseAuthentication

from .city_identity import identity_for


class CityUser:
    """A citizen verified by the city bank. Just enough of a user object for DRF permissions."""
    is_authenticated = True
    is_anonymous = False

    def __init__(self, username):
        self.username = username
        self.pk = username

    def __str__(self):
        return self.username


class CityAuthentication(BaseAuthentication):
    def authenticate(self, request):
        username = identity_for(request)
        if not username:
            return None
        return (CityUser(username), None)

    def authenticate_header(self, request):
        return "Bearer"
