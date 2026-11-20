from django.urls import path, include
from rest_framework.decorators import api_view
from rest_framework.response import Response

@api_view(['GET'])
def health(request):
    return Response({'status': 'ok', 'service': 'spotter-routing-backend'})

urlpatterns = [
    path('api/health', health, name='health'),
    path('api/', include('routing.api.urls')),
]
