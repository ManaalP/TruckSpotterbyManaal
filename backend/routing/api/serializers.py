"""Django REST Framework serializers for routing API endpoints.
"""

from rest_framework import serializers

class GeocodeQuerySerializer(serializers.Serializer):
    q = serializers.CharField(required=True, min_length=2, max_length=200)


class RouteAnalyzeSerializer(serializers.Serializer):
    origin = serializers.CharField(required=True, max_length=255)
    destination = serializers.CharField(required=True, max_length=255)
    departure_time = serializers.DateTimeField(required=True)
    load_weight_lb = serializers.FloatField(required=True, min_value=1.0, max_value=100000.0)
    interval_miles = serializers.ChoiceField(choices=[10, 25, 50], default=25)


class HeatmapSerializer(serializers.Serializer):
    routes_coordinates = serializers.ListField(
        child=serializers.ListField(child=serializers.ListField(child=serializers.FloatField())),
        required=False,
    )
    load_weight_lb = serializers.FloatField(default=35000.0, min_value=1.0, max_value=100000.0)
    start_time = serializers.DateTimeField(required=False)
