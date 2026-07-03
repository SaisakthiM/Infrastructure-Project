# views.py
from graphene_django.views import GraphQLView

class NoDebugToolbarGraphQLView(GraphQLView):
    def dispatch(self, *args, **kwargs):
        if hasattr(self.request, "toolbar"):
            self.request.toolbar = None  # disable Debug Toolbar for this request
        return super().dispatch(*args, **kwargs)
