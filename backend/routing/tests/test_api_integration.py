import pytest
from rest_framework.test import APIClient
from datetime import datetime, timezone, timedelta

@pytest.fixture
def api_client():
    return APIClient()

def test_health_endpoint(api_client):
    response = api_client.get('/api/health')
    assert response.status_code == 200
    assert response.json().get('status') == 'ok'

def test_geocode_endpoint(api_client):
    response = api_client.get('/api/geocode?q=Chicago')
    assert response.status_code == 200
    results = response.json().get('results', [])
    assert len(results) > 0
    assert 'lat' in results[0] and 'lon' in results[0]

def test_routes_analyze_validation_error(api_client):
    response = api_client.post('/api/routes/analyze', {}, format='json')
    assert response.status_code == 400
    data = response.json()
    assert 'error' in data
    assert data['error']['code'] == 'VALIDATION_ERROR'

def test_routes_analyze_success(api_client):
    dep_time = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
    payload = {
        "origin": "Chicago, IL",
        "destination": "Denver, CO",
        "departure_time": dep_time,
        "load_weight_lb": 38000,
        "interval_miles": 50,
    }
    response = api_client.post('/api/routes/analyze', payload, format='json')
    assert response.status_code == 200
    data = response.json()
    assert len(data.get('routes', [])) == 3
    assert 'recommendation' in data
    assert data['recommendation']['route_id'] in ['route_1', 'route_2', 'route_3']
    # Checkpoints structure
    first_route = data['routes'][0]
    assert len(first_route['checkpoints']) > 0
    assert 'risk_level' in first_route['checkpoints'][0]
    assert 'miles_by_level' in first_route['summary']

def test_heatmap_endpoint(api_client):
    payload = {
        "routes_coordinates": [
            [[-87.6298, 41.8781], [-96.0, 41.0], [-104.9903, 39.7392]]
        ],
        "load_weight_lb": 42000,
    }
    response = api_client.post('/api/heatmap', payload, format='json')
    assert response.status_code == 200
    data = response.json()
    assert data.get('total_hours') == 49
    assert len(data.get('frames', [])) == 49
    first_frame = data['frames'][0]
    assert 'points' in first_frame
    assert len(first_frame['points']) > 0
    assert 'risk' in first_frame['points'][0]
