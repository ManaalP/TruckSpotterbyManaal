from django.urls import path
from .views import geocode_view, analyze_routes_view, heatmap_view

urlpatterns = [
    path('geocode', geocode_view, name='geocode'),
    path('routes/analyze', analyze_routes_view, name='routes_analyze'),
    path('heatmap', heatmap_view, name='heatmap'),
]
