import os
import json
import requests
import math
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime
from dotenv import load_dotenv
import polyline
from functools import lru_cache
import time
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from encoding_utils import validate_json_response

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# Configuration
OSRM_BASE_URL = "http://router.project-osrm.org"
GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY')
GOOGLE_MAPS_GEOCODING_API_KEY = os.getenv('GOOGLE_MAPS_GEOCODING_API_KEY')
RISK_DETECTOR_URL = "http://localhost:5002"

class RouteOptimizer:
    def __init__(self):
        self.osrm_url = OSRM_BASE_URL
        if GOOGLE_MAPS_API_KEY:
            self.google_maps_api_key = GOOGLE_MAPS_API_KEY
        else:
            print("Warning: GOOGLE_MAPS_API_KEY not provided. Google Maps integration will be limited.")
            self.google_maps_api_key = None
            
        if GOOGLE_MAPS_GEOCODING_API_KEY:
            self.google_geocoding_api_key = GOOGLE_MAPS_GEOCODING_API_KEY
        else:
            print("Warning: GOOGLE_MAPS_GEOCODING_API_KEY not provided. Geocoding will be disabled.")
            self.google_geocoding_api_key = None
            
        self.risk_detector_url = RISK_DETECTOR_URL
        self.cache = {}
        self.cache_timeout = 60
    
    def calculate_distance(self, lat1, lon1, lat2, lon2):
        """Calculate the great circle distance between two points on the earth."""
        R = 6371
        dLat = math.radians(lat2 - lat1)
        dLon = math.radians(lon2 - lon1)
        a = math.sin(dLat/2) * math.sin(dLat/2) + \
            math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
            math.sin(dLon/2) * math.sin(dLon/2)
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        distance = R * c
        return distance
    
    def calculate_distance_matrix(self, origins, destinations):
        """Calculate distance matrix between multiple origins and destinations."""
        if not self.google_maps_api_key:
            print("Google Maps API key not available. Cannot calculate distance matrix.")
            return None
            
        try:
            url = "https://maps.googleapis.com/maps/api/distancematrix/json"
            params = {
                'origins': '|'.join([f"{lat},{lng}" for lat, lng in origins]),
                'destinations': '|'.join([f"{lat},{lng}" for lat, lng in destinations]),
                'key': self.google_maps_api_key,
                'departure_time': 'now'
            }
            
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data['status'] == 'OK':
                    matrix = []
                    for i, row in enumerate(data['rows']):
                        matrix_row = []
                        for j, element in enumerate(row['elements']):
                            if element['status'] == 'OK':
                                matrix_row.append({
                                    'distance': element['distance']['value'] / 1000,
                                    'duration': element['duration']['value'] / 60,
                                    'duration_in_traffic': element.get('duration_in_traffic', {}).get('value', element['duration']['value']) / 60
                                })
                            else:
                                matrix_row.append(None)
                        matrix.append(matrix_row)
                    return matrix
            return None
        except Exception as e:
            print(f"Distance matrix error: {str(e)}")
            return None
    
    @lru_cache(maxsize=128)
    def snap_to_nearest_road(self, lat, lng):
        """Snap a coordinate to the nearest road using Google Maps Roads API."""
        if not self.google_maps_api_key:
            print("Google Maps API key not available. Cannot snap to nearest road.")
            return (lat, lng)
            
        try:
            url = "https://roads.googleapis.com/v1/nearestRoads"
            params = {
                'points': f"{lat},{lng}",
                'key': self.google_maps_api_key
            }
            
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if 'snappedPoints' in data and len(data['snappedPoints']) > 0:
                    snapped_point = data['snappedPoints'][0]['location']
                    return (snapped_point['latitude'], snapped_point['longitude'])
            
            return (lat, lng)
        except Exception as e:
            print(f"Road snapping error: {str(e)}")
            return (lat, lng)
    
    def get_google_maps_route(self, start_coords, end_coords, avoid_risks=None, optimize_waypoints=False):
        """Get route from Google Maps Directions API with risk avoidance."""
        if not self.google_maps_api_key:
            print("Google Maps API key not available. Cannot calculate route.")
            return None
            
        try:
            cache_key = f"{start_coords[0]},{start_coords[1]}_{end_coords[0]},{end_coords[1]}"
            if avoid_risks:
                risk_ids = [f"{risk.get('coordinates', [0,0])[0]},{risk.get('coordinates', [0,0])[1]}" for risk in avoid_risks]
                cache_key += f"_risks:{'_'.join(risk_ids)}"
            
            if cache_key in self.cache:
                cached_entry = self.cache[cache_key]
                if time.time() - cached_entry['timestamp'] < self.cache_timeout:
                    print("Returning cached route")
                    return cached_entry['data']
            
            snapped_start = self.snap_to_nearest_road(start_coords[0], start_coords[1])
            snapped_end = self.snap_to_nearest_road(end_coords[0], end_coords[1])
            
            origin = f"{snapped_start[0]},{snapped_start[1]}"
            destination = f"{snapped_end[0]},{snapped_end[1]}"
            
            url = "https://maps.googleapis.com/maps/api/directions/json"
            response = None
            routes = None
            
            if avoid_risks and len(avoid_risks) > 0:
                print("Attempting route with waypoints for all risks")
                params_with_waypoints = {
                    'origin': origin,
                    'destination': destination,
                    'key': self.google_maps_api_key,
                    'departure_time': 'now',
                    'alternatives': 'true',
                    'optimize': 'true' if optimize_waypoints else 'false',
                    'avoid': 'tolls|ferries'
                }
                
                all_risks = avoid_risks
                if all_risks:
                    waypoints = self.extract_waypoints_from_risks(all_risks)
                    if waypoints:
                        params_with_waypoints['waypoints'] = '|'.join(waypoints[:25])
                
                print(f"Making Google Maps API request with waypoints: {params_with_waypoints}")
                response = requests.get(url, params=params_with_waypoints, timeout=60)
                print(f"Google Maps API response status: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    print(f"Google Maps API response data: {data}")
                    if data['status'] == 'OK' and len(data['routes']) > 0:
                        routes = data
            
            if not routes:
                print("Waypoints approach failed or no risks to avoid, trying without waypoints")
                params_without_waypoints = {
                    'origin': origin,
                    'destination': destination,
                    'key': self.google_maps_api_key,
                    'departure_time': 'now',
                    'alternatives': 'true',
                    'optimize': 'true' if optimize_waypoints else 'false',
                    'avoid': 'tolls|ferries'
                }
                
                print(f"Making Google Maps API request without waypoints: {params_without_waypoints}")
                response = requests.get(url, params=params_without_waypoints, timeout=60)
                print(f"Google Maps API response status: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    print(f"Google Maps API response data: {data}")
                    if data['status'] == 'OK' and len(data['routes']) > 0:
                        routes = data
            
            if not routes:
                print("All approaches failed, trying basic route")
                params_basic = {
                    'origin': origin,
                    'destination': destination,
                    'key': self.google_maps_api_key,
                    'departure_time': 'now'
                }
                
                response = requests.get(url, params=params_basic, timeout=60)
                if response.status_code == 200:
                    data = response.json()
                    if data['status'] == 'OK' and len(data['routes']) > 0:
                        routes = data
            
            if routes:
                processed_routes = []
                for route in routes['routes']:
                    leg = route['legs'][0]
                    
                    route_points = []
                    if 'overview_polyline' in route and 'points' in route['overview_polyline']:
                        try:
                            decoded_points = polyline.decode(route['overview_polyline']['points'])
                            route_points = []
                            for lat, lng in decoded_points:
                                try:
                                    lat_float = float(lat)
                                    lng_float = float(lng)
                                    route_points.append({'lat': lat_float, 'lng': lng_float})
                                except (ValueError, TypeError):
                                    continue
                        except Exception as e:
                            print(f"Polyline decoding error: {str(e)}")
                            try:
                                route_points = [
                                    {'lat': float(snapped_start[0]), 'lng': float(snapped_start[1])},
                                    {'lat': float(snapped_end[0]), 'lng': float(snapped_end[1])}
                                ]
                            except (ValueError, TypeError):
                                route_points = []
                    
                    steps = []
                    for step in leg.get('steps', []):
                        html_instructions = step.get('html_instructions', '')
                        if html_instructions:
                            try:
                                html_instructions = html_instructions.encode('utf-8', errors='ignore').decode('utf-8')
                            except Exception:
                                html_instructions = "Route step instruction"
                        steps.append(html_instructions)
                    
                    start_address = leg.get('start_address', '')
                    end_address = leg.get('end_address', '')
                    
                    try:
                        start_address = start_address.encode('utf-8', errors='ignore').decode('utf-8')
                        end_address = end_address.encode('utf-8', errors='ignore').decode('utf-8')
                    except Exception:
                        start_address = "Start address not available"
                        end_address = "End address not available"
                    
                    processed_route = {
                        'distance': leg['distance']['value'] / 1000,
                        'duration': leg['duration']['value'] / 60,
                        'duration_in_traffic': leg.get('duration_in_traffic', {}).get('value', leg['duration']['value']) / 60,
                        'steps': steps,
                        'overview_polyline': route.get('overview_polyline', {}).get('points', '') if 'overview_polyline' in route else '',
                        'route_points': route_points,
                        'start_address': start_address,
                        'end_address': end_address,
                        'bounds': route.get('bounds', {})
                    }
                    processed_routes.append(processed_route)
                
                result = {
                    'primary': processed_routes[0] if processed_routes else None,
                    'alternatives': processed_routes[1:] if len(processed_routes) > 1 else []
                }
                
                self.cache[cache_key] = {
                    'data': result,
                    'timestamp': time.time()
                }
                
                return result
            elif routes and routes.get('status') != 'OK':
                print(f"Google Maps API error status: {routes.get('status')}")
                print(f"Google Maps API error message: {routes.get('error_message', 'No error message')}")
            elif response:
                print(f"Google Maps API HTTP error: {response.status_code}")
                print(f"Response text: {response.text}")
            return None
        except Exception as e:
            print(f"Google Maps route error: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
    
    def extract_waypoints_from_risks(self, risks):
        """Extract waypoints to avoid risk areas - now considers ALL risk severities."""
        waypoints = []
        for risk in risks:
            severity = risk.get('severity', 'low')
            coords = risk.get('coordinates') or risk.get('location')
            if coords and len(coords) >= 2:
                source = risk.get('source', 'system')
                is_user_reported = source == 'user_reported'
                
                if is_user_reported:
                    avoidance_point = self.calculate_precise_avoidance_point(coords[0], coords[1], 300)
                    waypoints.append(f"via:{avoidance_point[0]},{avoidance_point[1]}")
                elif severity == 'high':
                    avoidance_point = self.calculate_precise_avoidance_point(coords[0], coords[1], 250)
                    waypoints.append(f"via:{avoidance_point[0]},{avoidance_point[1]}")
                elif severity == 'medium':
                    avoidance_point = self.calculate_precise_avoidance_point(coords[0], coords[1], 150)
                    waypoints.append(f"via:{avoidance_point[0]},{avoidance_point[1]}")
                else:  # low severity
                    avoidance_point = self.calculate_precise_avoidance_point(coords[0], coords[1], 100)
                    waypoints.append(f"via:{avoidance_point[0]},{avoidance_point[1]}")
        
        return waypoints[:25]

    def calculate_avoidance_point(self, lat, lng, offset_distance=0.1):
        """Calculate a point offset from the risk location to avoid it."""
        offset_lat = lat + (offset_distance / 111.0)
        offset_lng = lng + (offset_distance / (111.0 * math.cos(math.radians(lat))))
        return [offset_lat, offset_lng]
    
    def calculate_precise_avoidance_point(self, lat, lng, radius_meters=10):
        """Calculate a precise avoidance point based on the specified radius."""
        offset_distance_km = radius_meters / 1000.0
        offset_distance_degrees = offset_distance_km / 111.0
        
        offset_lat = lat + offset_distance_degrees
        offset_lng = lng + (offset_distance_degrees / math.cos(math.radians(lat)))
        return [offset_lat, offset_lng]
    
    def create_detour_points(self, risk_coords, avoidance_distance_meters=10.0):
        """Create multiple detour points around a risk to ensure avoidance."""
        lat, lng = risk_coords[0], risk_coords[1]
        
        avoidance_distance_km = avoidance_distance_meters / 1000.0
        avoidance_distance_degrees = avoidance_distance_km / 111.0
        
        detour_points = []
        
        # North
        north_lat = lat + avoidance_distance_degrees
        detour_points.append((north_lat, lng))
        
        # South
        south_lat = lat - avoidance_distance_degrees
        detour_points.append((south_lat, lng))
        
        # East
        east_lng = lng + (avoidance_distance_degrees / math.cos(math.radians(lat)))
        detour_points.append((lat, east_lng))
        
        # West
        west_lng = lng - (avoidance_distance_degrees / math.cos(math.radians(lat)))
        detour_points.append((lat, west_lng))
        
        # Northeast
        detour_points.append((north_lat, east_lng))
        
        # Northwest
        detour_points.append((north_lat, west_lng))
        
        # Southeast
        detour_points.append((south_lat, east_lng))
        
        # Southwest
        detour_points.append((south_lat, west_lng))
        
        return detour_points
    
    def get_google_maps_route_with_detours(self, start_coords, end_coords, risk_alerts=None):
        """Get route from Google Maps with enhanced detour capabilities for risk avoidance."""
        if not self.google_maps_api_key:
            print("Google Maps API key not available. Cannot calculate route.")
            return None
            
        try:
            if risk_alerts and len(risk_alerts) > 0:
                print(f"Creating enhanced detours for {len(risk_alerts)} risks")
                
                all_detour_points = []
                for risk in risk_alerts:
                    coords = risk.get('coordinates') or risk.get('location')
                    if coords and len(coords) >= 2:
                        source = risk.get('source', 'system')
                        is_user_reported = source == 'user_reported'
                        severity = risk.get('severity', 'low')
                        
                        if is_user_reported:
                            avoidance_distance_meters = 500
                        elif severity == 'high':
                            avoidance_distance_meters = 400
                        elif severity == 'medium':
                            avoidance_distance_meters = 300
                        else:
                            avoidance_distance_meters = 200
                        
                        detour_points = self.create_detour_points(coords, avoidance_distance_meters)
                        all_detour_points.extend([f"via:{lat},{lng}" for lat, lng in detour_points])
                        print(f"Created {len(detour_points)} detour points for risk at {coords}")
                
                if all_detour_points:
                    print(f"Attempting route with {len(all_detour_points)} detour points")
                    
                    snapped_start = self.snap_to_nearest_road(start_coords[0], start_coords[1])
                    snapped_end = self.snap_to_nearest_road(end_coords[0], end_coords[1])
                    
                    url = "https://maps.googleapis.com/maps/api/directions/json"
                    params = {
                        'origin': f"{snapped_start[0]},{snapped_start[1]}",
                        'destination': f"{snapped_end[0]},{snapped_end[1]}",
                        'key': self.google_maps_api_key,
                        'departure_time': 'now',
                        'alternatives': 'true',
                        'avoid': 'tolls|ferries',
                        'waypoints': '|'.join(all_detour_points[:25])
                    }
                    
                    print(f"Making Google Maps API request with detour points")
                    response = requests.get(url, params=params, timeout=60)
                    
                    if response.status_code == 200:
                        data = response.json()
                        if data['status'] == 'OK' and len(data['routes']) > 0:
                            print("Successfully got route with detours")
                            return self._process_google_maps_response(data, snapped_start, snapped_end)
                        else:
                            print(f"Google Maps API error: {data.get('status', 'Unknown')}")
            
            print("Falling back to regular route calculation")
            return self.get_google_maps_route(start_coords, end_coords, risk_alerts)
            
        except Exception as e:
            print(f"Error in get_google_maps_route_with_detours: {str(e)}")
            import traceback
            traceback.print_exc()
            return self.get_google_maps_route(start_coords, end_coords, risk_alerts)
    
    def _process_google_maps_response(self, data, snapped_start, snapped_end):
        """Process Google Maps API response into our route format."""
        try:
            processed_routes = []
            for route in data['routes']:
                leg = route['legs'][0]
                
                route_points = []
                if 'overview_polyline' in route and 'points' in route['overview_polyline']:
                    try:
                        decoded_points = polyline.decode(route['overview_polyline']['points'])
                        route_points = []
                        for lat, lng in decoded_points:
                            try:
                                lat_float = float(lat)
                                lng_float = float(lng)
                                route_points.append({'lat': lat_float, 'lng': lng_float})
                            except (ValueError, TypeError):
                                continue
                    except Exception as e:
                        print(f"Polyline decoding error: {str(e)}")
                        try:
                            route_points = [
                                {'lat': float(snapped_start[0]), 'lng': float(snapped_start[1])},
                                {'lat': float(snapped_end[0]), 'lng': float(snapped_end[1])}
                            ]
                        except (ValueError, TypeError):
                            route_points = []
                
                steps = []
                for step in leg.get('steps', []):
                    html_instructions = step.get('html_instructions', '')
                    if html_instructions:
                        try:
                            html_instructions = html_instructions.encode('utf-8', errors='ignore').decode('utf-8')
                        except Exception:
                            html_instructions = "Route step instruction"
                    steps.append(html_instructions)
                
                start_address = leg.get('start_address', '')
                end_address = leg.get('end_address', '')
                
                try:
                    start_address = start_address.encode('utf-8', errors='ignore').decode('utf-8')
                    end_address = end_address.encode('utf-8', errors='ignore').decode('utf-8')
                except Exception:
                    start_address = "Start address not available"
                    end_address = "End address not available"
                
                processed_route = {
                    'distance': leg['distance']['value'] / 1000,
                    'duration': leg['duration']['value'] / 60,
                    'duration_in_traffic': leg.get('duration_in_traffic', {}).get('value', leg['duration']['value']) / 60,
                    'steps': steps,
                    'overview_polyline': route.get('overview_polyline', {}).get('points', '') if 'overview_polyline' in route else '',
                    'route_points': route_points,
                    'start_address': start_address,
                    'end_address': end_address,
                    'bounds': route.get('bounds', {})
                }
                processed_routes.append(processed_route)
            
            result = {
                'primary': processed_routes[0] if processed_routes else None,
                'alternatives': processed_routes[1:] if len(processed_routes) > 1 else []
            }
            
            return result
        except Exception as e:
            print(f"Error processing Google Maps response: {str(e)}")
            return None
    
    def check_route_for_risks(self, route, risk_alerts):
        """Check if the current route contains any risked points and return a safer alternative if needed."""
        if not route or not risk_alerts:
            return route, False
        
        risks_on_route = self.identify_risks_on_route(route, risk_alerts)
        
        route_points = route.get('route_points', [])
        if route_points:
            risks_in_radius = self.get_risks_within_avoidance_radius(route_points, risk_alerts, 10)
            if risks_in_radius:
                print(f"Found {len(risks_in_radius)} risks within 10m radius, recalculating...")
                all_risks = risks_on_route + [risk for risk in risks_in_radius if risk not in risks_on_route]
                user_reported_risks = [risk for risk in all_risks if risk.get('source', 'system') == 'user_reported']
                if user_reported_risks:
                    print(f"Found {len(user_reported_risks)} user-reported risks, prioritizing in rerouting...")
                return None, True
        
        if risks_on_route:
            print(f"Found {len(risks_on_route)} risks on current route, recalculating...")
            user_reported_risks = [risk for risk in risks_on_route if risk.get('is_user_reported', False)]
            if user_reported_risks:
                print(f"Found {len(user_reported_risks)} user-reported risks, prioritizing in rerouting...")
            return None, True
        
        return route, False
    
    def optimize_route_with_agent_location(self, agent_coords, dropoff_coords, risk_alerts):
        """Optimize route specifically for agent's current location to dropoff point."""
        try:
            print(f"Optimizing route from agent {agent_coords} to dropoff {dropoff_coords}")
            print(f"Risk alerts: {len(risk_alerts) if risk_alerts else 0}")
            
            risk_aware_route = self.get_google_maps_route_with_detours(agent_coords, dropoff_coords, risk_alerts)
            
            if risk_aware_route and risk_aware_route.get('primary'):
                self.enhance_routes_with_risk_data(risk_aware_route, risk_alerts)
                return risk_aware_route
            
            print("Enhanced detour system failed, falling back to direct route")
            direct_route = self.get_google_maps_route(agent_coords, dropoff_coords, [])
            return direct_route
        except Exception as e:
            print(f"Agent route optimization error: {str(e)}")
            return self.get_google_maps_route(agent_coords, dropoff_coords, [])

    def calculate_route_risk_score(self, route, risk_alerts):
        """Calculate risk score for a route based on proximity to risks."""
        if not route or not risk_alerts:
            return 0.0
        
        risk_score = 0.0
        route_points = route.get('route_points', [])
        
        if not route_points:
            return 0.0
            
        for risk in risk_alerts:
            severity = risk.get('severity', 'low')
            source = risk.get('source', 'system')
            is_user_reported = source == 'user_reported'
            
            severity_multiplier = {'low': 1, 'medium': 2, 'high': 3}
            severity_score = severity_multiplier.get(severity, 1)
            
            if is_user_reported:
                severity_score *= 2
            
            risk_coords = risk.get('coordinates') or risk.get('location')
            if risk_coords and len(risk_coords) >= 2:
                min_distance = float('inf')
                for point in route_points:
                    distance = self.calculate_distance(
                        risk_coords[0], risk_coords[1],
                        point['lat'], point['lng']
                    )
                    min_distance = min(min_distance, distance)
                
                if is_user_reported:
                    if min_distance < 0.3:
                        risk_score += severity_score * 20
                    elif min_distance < 1.0:
                        risk_score += severity_score * 12
                    elif min_distance < 2.0:
                        risk_score += severity_score * 6
                    elif min_distance < 4.0:
                        risk_score += severity_score * 2
                else:
                    if min_distance < 0.15:
                        risk_score += severity_score * 15
                    elif min_distance < 0.7:
                        risk_score += severity_score * 8
                    elif min_distance < 1.5:
                        risk_score += severity_score * 3
                    elif min_distance < 3.0:
                        risk_score += severity_score * 1
        
        return min(risk_score, 100.0)
    
    def identify_risks_on_route(self, route, risk_alerts):
        """Identify risks that are on or near the route."""
        if not route or not risk_alerts:
            return []
        
        risks_on_route = []
        route_points = route.get('route_points', [])
        
        if not route_points:
            return []
            
        for risk in risk_alerts:
            risk_coords = risk.get('coordinates') or risk.get('location')
            source = risk.get('source', 'system')
            is_user_reported = source == 'user_reported'
            
            if risk_coords and len(risk_coords) >= 2:
                min_distance = float('inf')
                closest_point_index = -1
                for i, point in enumerate(route_points):
                    distance = self.calculate_distance(
                        risk_coords[0], risk_coords[1],
                        point['lat'], point['lng']
                    )
                    if distance < min_distance:
                        min_distance = distance
                        closest_point_index = i
                
                severity = risk.get('severity', 'low')
                if is_user_reported:
                    threshold = 3.5 if severity == 'high' else 2.5 if severity == 'medium' else 1.5
                else:
                    threshold = 2.5 if severity == 'high' else 1.5 if severity == 'medium' else 0.75
                
                if min_distance <= threshold:
                    risk_with_distance = risk.copy()
                    risk_with_distance['distance_from_route'] = min_distance
                    risk_with_distance['is_user_reported'] = is_user_reported
                    risk_with_distance['closest_route_point_index'] = closest_point_index
                    risks_on_route.append(risk_with_distance)
                    
                    print(f"Risk detected on route: {risk['type']} ({risk['severity']}) at distance {min_distance}km (threshold: {threshold}km)")
        
        return risks_on_route
    
    def is_point_within_risk_radius(self, point, risk_coords, radius_meters=10):
        """Check if a point is within the specified radius of a risk point."""
        if not point or not risk_coords:
            return False
        
        distance_km = self.calculate_distance(
            risk_coords[0], risk_coords[1],
            point['lat'], point['lng']
        )
        distance_meters = distance_km * 1000
        
        return distance_meters <= radius_meters
    
    def get_risks_within_avoidance_radius(self, route_points, risk_alerts, radius_meters=10):
        """Get all risks that are within the avoidance radius of any point on the route."""
        if not route_points or not risk_alerts:
            return []
        
        risks_in_radius = []
        for risk in risk_alerts:
            risk_coords = risk.get('coordinates') or risk.get('location')
            if not risk_coords:
                continue
            
            for point in route_points:
                if self.is_point_within_risk_radius(point, risk_coords, radius_meters):
                    risks_in_radius.append(risk)
                    break
        
        return risks_in_radius
    
    def enhance_routes_with_risk_data(self, routes, risk_alerts):
        """Enhance routes with risk information."""
        if 'primary' in routes and routes['primary']:
            routes['primary']['risk_score'] = self.calculate_route_risk_score(routes['primary'], risk_alerts)
            routes['primary']['risks_on_route'] = self.identify_risks_on_route(routes['primary'], risk_alerts)
        
        if 'alternatives' in routes:
            for alternative in routes['alternatives']:
                alternative['risk_score'] = self.calculate_route_risk_score(alternative, risk_alerts)
                alternative['risks_on_route'] = self.identify_risks_on_route(alternative, risk_alerts)
    
    def get_optimized_delivery_sequence(self, delivery_locations):
        """Optimize delivery sequence using Google Maps Distance Matrix."""
        try:
            if len(delivery_locations) < 2:
                return delivery_locations
            
            coords = [(loc['lat'], loc['lng']) for loc in delivery_locations]
            
            matrix = self.calculate_distance_matrix(coords, coords)
            if not matrix:
                return delivery_locations
            
            optimized_sequence = [0]
            unvisited = set(range(1, len(delivery_locations)))
            
            current = 0
            while unvisited:
                nearest = min(unvisited, key=lambda x: matrix[current][x]['distance'] if matrix[current][x] else float('inf'))
                optimized_sequence.append(nearest)
                unvisited.remove(nearest)
                current = nearest
            
            return [delivery_locations[i] for i in optimized_sequence]
        except Exception as e:
            print(f"Delivery sequence optimization error: {str(e)}")
            return delivery_locations

    def geocode_address(self, address):
        """Convert address to coordinates using Google Maps Geocoding API."""
        if not self.google_geocoding_api_key:
            print("Google Geocoding API key not available. Cannot geocode address.")
            return None
            
        try:
            url = "https://maps.googleapis.com/maps/api/geocode/json"
            params = {
                'address': address,
                'key': self.google_geocoding_api_key
            }
            
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data['status'] == 'OK' and len(data['results']) > 0:
                    location = data['results'][0]['geometry']['location']
                    return {
                        'lat': location['lat'],
                        'lng': location['lng'],
                        'formatted_address': data['results'][0]['formatted_address'],
                        'place_id': data['results'][0].get('place_id', ''),
                        'types': data['results'][0].get('types', [])
                    }
            return None
        except Exception as e:
            print(f"Geocoding error: {str(e)}")
            return None

    def reverse_geocode(self, lat, lng):
        """Convert coordinates to address using Google Maps Reverse Geocoding API."""
        if not self.google_geocoding_api_key:
            print("Google Geocoding API key not available. Cannot reverse geocode.")
            return None
            
        try:
            url = "https://maps.googleapis.com/maps/api/geocode/json"
            params = {
                'latlng': f"{lat},{lng}",
                'key': self.google_geocoding_api_key
            }
            
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data['status'] == 'OK' and len(data['results']) > 0:
                    return {
                        'address': data['results'][0]['formatted_address'],
                        'components': data['results'][0]['address_components'],
                        'place_id': data['results'][0].get('place_id', ''),
                        'types': data['results'][0].get('types', [])
                    }
            return None
        except Exception as e:
            print(f"Reverse geocoding error: {str(e)}")
            return None

# Initialize optimizer
optimizer = RouteOptimizer()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({'status': 'ok', 'service': 'route-optimizer'})

@app.route('/optimize', methods=['POST'])
def optimize_route():
    """Optimize a delivery route with risk awareness."""
    try:
        data = request.get_json()
        print(f"Received optimize request with data: {data}")
        
        # Required fields
        start_location = data.get('start_location')
        end_location = data.get('end_location')
        risk_aware = data.get('risk_aware', True)
        risk_alerts = data.get('risk_alerts', [])
        
        print(f"Start location: {start_location}")
        print(f"End location: {end_location}")
        print(f"Risk aware: {risk_aware}")
        print(f"Risk alerts: {risk_alerts}")
        print(f"Risk alerts type: {type(risk_alerts)}")
        print(f"Risk alerts length: {len(risk_alerts)}")
        
        # Validate that start_location and end_location are provided
        if not start_location or not end_location:
            error_msg = f'Missing start or end location. Start: {start_location}, End: {end_location}'
            print(f"Validation error: {error_msg}")
            return jsonify({'error': 'Start and end locations required'}), 400
        
        # Validate coordinates format
        if not isinstance(start_location, dict) or not isinstance(end_location, dict):
            error_msg = f'Invalid location format. Start: {type(start_location)}, End: {type(end_location)}'
            print(f"Validation error: {error_msg}")
            return jsonify({'error': 'Invalid coordinates format - locations must be objects'}), 400
            
        if not all(k in start_location for k in ('lat', 'lng')) or not all(k in end_location for k in ('lat', 'lng')):
            error_msg = f'Invalid coordinates keys. Start keys: {list(start_location.keys()) if start_location else None}, End keys: {list(end_location.keys()) if end_location else None}'
            print(f"Validation error: {error_msg}")
            return jsonify({'error': 'Invalid coordinates format - missing lat/lng keys'}), 400
            
        # Validate that coordinates are numbers
        try:
            start_lat = float(start_location['lat'])
            start_lng = float(start_location['lng'])
            end_lat = float(end_location['lat'])
            end_lng = float(end_location['lng'])
        except (ValueError, TypeError) as e:
            error_msg = f'Invalid coordinate values. Start: {start_location}, End: {end_location}'
            print(f"Validation error: {error_msg}")
            return jsonify({'error': f'Invalid coordinate values - must be numbers: {str(e)}'}), 400
        
        result = {
            'timestamp': datetime.utcnow().isoformat(),
            'waypoints': [
                {'lat': start_lat, 'lng': start_lng},
                {'lat': end_lat, 'lng': end_lng}
            ]
        }
        
        # Get risk-aware routes
        if risk_aware:
            print("Using risk-aware routing")
            
            # If no risk alerts were provided, fetch them from the risk detector service
            if not risk_alerts or len(risk_alerts) == 0:
                print("Fetching risk alerts from risk detector service or using empty list")
                try:
                    if start_lat and start_lng:
                        risk_response = requests.post(
                            f"{RISK_DETECTOR_URL}/detect",
                            json={
                                "location": {"lat": start_lat, "lng": start_lng},
                                "radius_km": 15
                            },
                            timeout=60
                        )
                        if risk_response.status_code == 200:
                            risk_data = risk_response.json()
                            risk_alerts = risk_data.get('risks', [])
                            print(f"Fetched {len(risk_alerts)} risk alerts from risk detector")
                        else:
                            print(f"Failed to fetch risk alerts: {risk_response.status_code}")
                            risk_alerts = []
                    else:
                        risk_alerts = []
                except Exception as e:
                    print(f"Error fetching risk alerts: {str(e)}")
                    risk_alerts = []
            
            # Ensure risk_alerts is a list
            if not isinstance(risk_alerts, list):
                print(f"Risk alerts is not a list, converting. Type: {type(risk_alerts)}")
                risk_alerts = []
            
            # Log the risk alerts we're working with
            print(f"Working with {len(risk_alerts)} risk alerts")
            for i, risk in enumerate(risk_alerts):
                print(f"Risk {i}: {risk}")
            
            # Categorize risks by source
            user_reported_risks = [risk for risk in risk_alerts if risk.get('source') == 'user_reported']
            system_detected_risks = [risk for risk in risk_alerts if risk.get('source') != 'user_reported']
            
            print(f"User-reported risks: {len(user_reported_risks)}")
            print(f"System-detected risks: {len(system_detected_risks)}")
            
            # Prioritize user-reported risks in route calculation
            prioritized_risks = user_reported_risks + system_detected_risks
            
            # Use our enhanced risk-aware routing with detours
            routes = optimizer.get_google_maps_route_with_detours(
                [start_lat, start_lng],
                [end_lat, end_lng],
                prioritized_risks
            )
            
            if routes and routes.get('primary'):
                # Check if the route contains any significant risks
                primary_route = routes['primary']
                safe_route, needs_recalculation = optimizer.check_route_for_risks(primary_route, prioritized_risks)
                
                if needs_recalculation:
                    print("Current route contains risks, recalculating with enhanced avoidance...")
                    # Recalculate with stronger avoidance, prioritizing user-reported risks
                    enhanced_risk_alerts = []
                    for risk in prioritized_risks:
                        # Increase the avoidance distance for all risks, especially user-reported ones
                        enhanced_risk = risk.copy()
                        source = risk.get('source', 'system')
                        is_user_reported = source == 'user_reported'
                        
                        # Treat user-reported risks as high severity for stronger avoidance
                        if is_user_reported:
                            enhanced_risk['severity'] = 'high'
                        enhanced_risk_alerts.append(enhanced_risk)
                    
                    # Get a new route with enhanced risk avoidance
                    routes = optimizer.get_google_maps_route(
                        [start_lat, start_lng],
                        [end_lat, end_lng],
                        enhanced_risk_alerts
                    )
                    
                    if routes and routes.get('primary'):
                        # Enhance with risk data
                        optimizer.enhance_routes_with_risk_data(routes, prioritized_risks)
                        result.update({
                            'routes': routes,
                            'risk_aware': True,
                            'recalculated': True,
                            'recalculation_reason': 'Route contained significant risks',
                            'risk_alerts_used': len(prioritized_risks),
                            'user_reported_risks_count': len(user_reported_risks)
                        })
                    else:
                        # Fallback to basic routing if enhanced avoidance fails
                        routes = optimizer.get_google_maps_route_with_detours(
                            [start_lat, start_lng],
                            [end_lat, end_lng],
                            []
                        )
                        
                        if routes and routes.get('primary'):
                            result.update({
                                'routes': routes,
                                'risk_aware': False,
                                'recalculated': True,
                                'recalculation_reason': 'Enhanced risk avoidance failed, using basic routing'
                            })
                        else:
                            # Try one more fallback - direct route without any risk avoidance
                            print("Enhanced risk avoidance failed, trying direct route")
                            direct_routes = optimizer.get_google_maps_route_with_detours(
                                [start_lat, start_lng],
                                [end_lat, end_lng],
                                []
                            )
                            
                            if direct_routes and direct_routes.get('primary'):
                                # Enhance with risk data even for direct route
                                optimizer.enhance_routes_with_risk_data(direct_routes, prioritized_risks)
                                result.update({
                                    'routes': direct_routes,
                                    'risk_aware': False,
                                    'recalculated': True,
                                    'recalculation_reason': 'Enhanced risk avoidance failed, using direct route'
                                })
                            else:
                                print("Enhanced risk avoidance failed and no direct routes available")
                                # Try one more fallback - return a simple straight line route
                                straight_line_route = {
                                    'primary': {
                                        'distance': optimizer.calculate_distance(start_lat, start_lng, end_lat, end_lng),
                                        'duration': optimizer.calculate_distance(start_lat, start_lng, end_lat, end_lng) * 2,
                                        'duration_in_traffic': optimizer.calculate_distance(start_lat, start_lng, end_lat, end_lng) * 2,
                                        'steps': ['Proceed to destination'],
                                        'overview_polyline': '',
                                        'route_points': [
                                            {'lat': start_lat, 'lng': start_lng},
                                            {'lat': end_lat, 'lng': end_lng}
                                        ],
                                        'start_address': 'Start location',
                                        'end_address': 'End location',
                                        'bounds': {}
                                    },
                                    'alternatives': []
                                }
                                result.update({
                                    'routes': straight_line_route,
                                    'risk_aware': False,
                                    'fallback_used': True,
                                    'fallback_reason': 'Google Maps API unavailable, using straight line'
                                })
                else:
                    # Route is safe, but we still want to enhance it with risk data
                    optimizer.enhance_routes_with_risk_data(routes, prioritized_risks)
                    result.update({
                        'routes': routes,
                        'risk_aware': True,
                        'recalculated': False,
                        'risk_alerts_used': len(prioritized_risks),
                        'user_reported_risks_count': len(user_reported_risks)
                    })
            else:
                print("Risk-aware routing failed, falling back to basic routing")
                # Fallback to basic Google Maps route without risk awareness
                routes = optimizer.get_google_maps_route(
                    [start_lat, start_lng],
                    [end_lat, end_lng],
                    []
                )
                
                if routes and routes.get('primary'):
                    result.update({
                        'routes': routes,
                        'risk_aware': False
                    })
                else:
                    # Try one more fallback - direct route without any risk avoidance
                    print("Risk-aware routing failed, trying direct route")
                    direct_routes = optimizer.get_google_maps_route_with_detours(
                        [start_lat, start_lng],
                        [end_lat, end_lng],
                        []
                    )
                    
                    if direct_routes and direct_routes.get('primary'):
                        result.update({
                            'routes': direct_routes,
                            'risk_aware': False,
                            'fallback_used': True,
                            'fallback_reason': 'Risk-aware routing failed'
                        })
                    else:
                        print("Risk-aware routing failed completely")
                        # Try one more fallback - return a simple straight line route
                        straight_line_route = {
                            'primary': {
                                'distance': optimizer.calculate_distance(start_lat, start_lng, end_lat, end_lng),
                                'duration': optimizer.calculate_distance(start_lat, start_lng, end_lat, end_lng) * 2,
                                'duration_in_traffic': optimizer.calculate_distance(start_lat, start_lng, end_lat, end_lng) * 2,
                                'steps': ['Proceed to destination'],
                                'overview_polyline': '',
                                'route_points': [
                                    {'lat': start_lat, 'lng': start_lng},
                                    {'lat': end_lat, 'lng': end_lng}
                                ],
                                'start_address': 'Start location',
                                'end_address': 'End location',
                                'bounds': {}
                            },
                            'alternatives': []
                        }
                        result.update({
                            'routes': straight_line_route,
                            'risk_aware': False,
                            'fallback_used': True,
                            'fallback_reason': 'Google Maps API unavailable, using straight line'
                        })
        else:
            print("Using basic routing")
            # Get basic route from Google Maps without risk awareness
            routes = optimizer.get_google_maps_route_with_detours(
                [start_lat, start_lng],
                [end_lat, end_lng],
                []
            )
            
            if routes and routes.get('primary'):
                result.update({
                    'routes': routes,
                    'risk_aware': False
                })
            else:
                # Try one more fallback - direct route without any risk avoidance
                print("Basic routing failed, trying direct route without waypoints")
                direct_routes = optimizer.get_google_maps_route_with_detours(
                    [start_lat, start_lng],
                    [end_lat, end_lng],
                    []
                )
                
                if direct_routes and direct_routes.get('primary'):
                    result.update({
                        'routes': direct_routes,
                        'risk_aware': False,
                        'fallback_used': True,
                        'fallback_reason': 'Basic routing failed'
                    })
                else:
                    print("Risk-aware routing failed completely")
                    # Try one more fallback - return a simple straight line route
                    straight_line_route = {
                        'primary': {
                            'distance': optimizer.calculate_distance(start_lat, start_lng, end_lat, end_lng),
                            'duration': optimizer.calculate_distance(start_lat, start_lng, end_lat, end_lng) * 2,
                            'duration_in_traffic': optimizer.calculate_distance(start_lat, start_lng, end_lat, end_lng) * 2,
                            'steps': ['Proceed to destination'],
                            'overview_polyline': '',
                            'route_points': [
                                {'lat': start_lat, 'lng': start_lng},
                                {'lat': end_lat, 'lng': end_lng}
                            ],
                            'start_address': 'Start location',
                            'end_address': 'End location',
                            'bounds': {}
                        },
                        'alternatives': []
                    }
                    result.update({
                        'routes': straight_line_route,
                        'risk_aware': False,
                        'fallback_used': True,
                        'fallback_reason': 'Google Maps API unavailable, using straight line'
                    })
        
        print(f"Returning result: {result}")
        # Ensure all data in result is properly encoded
        is_valid, sanitized_result = validate_json_response(result)
        if not is_valid:
            # Check if sanitized_result is a dict with error key
            if isinstance(sanitized_result, dict) and 'error' in sanitized_result:
                return jsonify(sanitized_result), 500
        return jsonify(sanitized_result)
    
    except Exception as e:
        print(f"Route optimization error: {str(e)}")
        import traceback
        traceback.print_exc()
        # Ensure proper encoding of error message
        error_msg = str(e)
        try:
            error_msg = error_msg.encode('utf-8', errors='ignore').decode('utf-8')
        except Exception:
            error_msg = "Internal server error occurred"
        return jsonify({'error': f'Internal server error: {error_msg}'}), 500

@app.route('/alternatives', methods=['POST'])
def get_alternatives():
    """Get alternative routes with risk awareness."""
    try:
        data = request.get_json()
        
        start_location = data.get('start_location')
        end_location = data.get('end_location')
        risk_alerts = data.get('risk_alerts', [])
        
        if not start_location or not end_location:
            return jsonify({'error': 'Start and end locations required'}), 400
        
        # Validate coordinates
        if not all(k in start_location for k in ('lat', 'lng')) or not all(k in end_location for k in ('lat', 'lng')):
            return jsonify({'error': 'Invalid coordinates format'}), 400
        
        alternatives = optimizer.get_google_maps_route_with_detours(
            [start_location['lat'], start_location['lng']],
            [end_location['lat'], end_location['lng']],
            risk_alerts
        )
        
        # Enhance routes with risk information
        if alternatives and risk_alerts:
            optimizer.enhance_routes_with_risk_data(alternatives, risk_alerts)
        
        result_data = {
            'routes': alternatives,
            'timestamp': datetime.utcnow().isoformat()
        }
        is_valid, sanitized_result = validate_json_response(result_data)
        if not is_valid:
            if isinstance(sanitized_result, dict) and 'error' in sanitized_result:
                return jsonify(sanitized_result), 500
        return jsonify(sanitized_result)
    
    except Exception as e:
        print(f"Alternative routes error: {str(e)}")
        error_msg = str(e)
        try:
            error_msg = error_msg.encode('utf-8', errors='ignore').decode('utf-8')
        except Exception:
            error_msg = "Internal server error occurred"
        return jsonify({'error': f'Internal server error: {error_msg}'}), 500

@app.route('/geocode', methods=['POST'])
def geocode():
    """Geocode an address to coordinates."""
    try:
        data = request.get_json()
        address = data.get('address')
        
        if not address:
            return jsonify({'error': 'Address required'}), 400
        
        result = optimizer.geocode_address(address)
        if not result:
            return jsonify({'error': 'Could not geocode address'}), 404
        
        is_valid, sanitized_result = validate_json_response(result)
        if not is_valid:
            if isinstance(sanitized_result, dict) and 'error' in sanitized_result:
                return jsonify(sanitized_result), 500
        return jsonify(sanitized_result)
    
    except Exception as e:
        print(f"Geocoding error: {str(e)}")
        error_msg = str(e)
        try:
            error_msg = error_msg.encode('utf-8', errors='ignore').decode('utf-8')
        except Exception:
            error_msg = "Internal server error occurred"
        return jsonify({'error': f'Internal server error: {error_msg}'}), 500

@app.route('/reverse-geocode', methods=['POST'])
def reverse_geocode():
    """Reverse geocode coordinates to address."""
    try:
        data = request.get_json()
        lat = data.get('lat')
        lng = data.get('lng')
        
        if lat is None or lng is None:
            return jsonify({'error': 'Latitude and longitude required'}), 400
        
        result = optimizer.reverse_geocode(lat, lng)
        if not result:
            return jsonify({'error': 'Could not reverse geocode coordinates'}), 404
        
        is_valid, sanitized_result = validate_json_response(result)
        if not is_valid:
            if isinstance(sanitized_result, dict) and 'error' in sanitized_result:
                return jsonify(sanitized_result), 500
        return jsonify(sanitized_result)
    
    except Exception as e:
        print(f"Reverse geocoding error: {str(e)}")
        error_msg = str(e)
        try:
            error_msg = error_msg.encode('utf-8', errors='ignore').decode('utf-8')
        except Exception:
            error_msg = "Internal server error occurred"
        return jsonify({'error': f'Internal server error: {error_msg}'}), 500

@app.route('/optimize-sequence', methods=['POST'])
def optimize_delivery_sequence():
    """Optimize delivery sequence."""
    try:
        data = request.get_json()
        delivery_locations = data.get('delivery_locations', [])
        
        if not delivery_locations or len(delivery_locations) < 2:
            return jsonify({'error': 'At least 2 delivery locations required'}), 400
        
        # Validate locations
        for loc in delivery_locations:
            if not all(k in loc for k in ('lat', 'lng')):
                return jsonify({'error': 'Invalid location format'}), 400
        
        optimized_sequence = optimizer.get_optimized_delivery_sequence(delivery_locations)
        
        result_data = {
            'optimized_sequence': optimized_sequence,
            'timestamp': datetime.utcnow().isoformat()
        }
        is_valid, sanitized_result = validate_json_response(result_data)
        if not is_valid:
            if isinstance(sanitized_result, dict) and 'error' in sanitized_result:
                return jsonify(sanitized_result), 500
        return jsonify(sanitized_result)
    
    except Exception as e:
        print(f"Delivery sequence optimization error: {str(e)}")
        error_msg = str(e)
        try:
            error_msg = error_msg.encode('utf-8', errors='ignore').decode('utf-8')
        except Exception:
            error_msg = "Internal server error occurred"
        return jsonify({'error': f'Internal server error: {error_msg}'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)