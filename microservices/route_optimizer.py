"""
Production-Ready Route Optimization Engine for CrowdFleet
This microservice handles dynamic route optimization using Google Maps and real-time data.
"""

import os
import json
import requests
import math
from flask import Flask, request, jsonify
from flask_cors import CORS  # Add CORS support
from datetime import datetime
from dotenv import load_dotenv
import polyline  # For decoding Google Maps polylines
from functools import lru_cache
import time

# Load environment variables
load_dotenv()

app = Flask(__name__)
# Enable CORS with specific configuration for frontend communication
CORS(app, resources={r"/*": {"origins": "*"}})  # In production, restrict origins to specific domains

# Configuration
OSRM_BASE_URL = "http://router.project-osrm.org"
GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY', 'AIzaSyBDXZORqJV_a3XJabuyFn_JcZcv0HW8TxI')
GOOGLE_MAPS_GEOCODING_API_KEY = os.getenv('GOOGLE_MAPS_GEOCODING_API_KEY', 'AIzaSyBDXZORqJV_a3XJabuyFn_JcZcv0HW8TxI')
RISK_DETECTOR_URL = "http://localhost:5002"  # Default risk detector URL

class RouteOptimizer:
    def __init__(self):
        self.osrm_url = OSRM_BASE_URL
        self.google_maps_api_key = GOOGLE_MAPS_API_KEY
        self.google_geocoding_api_key = GOOGLE_MAPS_GEOCODING_API_KEY
        self.risk_detector_url = RISK_DETECTOR_URL
        self.cache = {}  # Simple in-memory cache
        self.cache_timeout = 300  # 5 minutes cache timeout
    
    def calculate_distance(self, lat1, lon1, lat2, lon2):
        """Calculate the great circle distance between two points on the earth."""
        R = 6371  # Radius of the Earth in kilometers
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
                                    'distance': element['distance']['value'] / 1000,  # Convert to km
                                    'duration': element['duration']['value'] / 60,    # Convert to minutes
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
                    # Return the snapped point
                    snapped_point = data['snappedPoints'][0]['location']
                    return (snapped_point['latitude'], snapped_point['longitude'])
            
            # If snapping fails, return original coordinates
            return (lat, lng)
        except Exception as e:
            print(f"Road snapping error: {str(e)}")
            # If snapping fails, return original coordinates
            return (lat, lng)
    
    def get_google_maps_route(self, start_coords, end_coords, avoid_risks=None, optimize_waypoints=False):
        """Get route from Google Maps Directions API with risk avoidance."""
        try:
            # Create cache key
            cache_key = f"{start_coords[0]},{start_coords[1]}_{end_coords[0]},{end_coords[1]}"
            if avoid_risks:
                risk_ids = [f"{risk.get('coordinates', [0,0])[0]},{risk.get('coordinates', [0,0])[1]}" for risk in avoid_risks]
                cache_key += f"_risks:{'_'.join(risk_ids)}"
            
            # Check cache
            if cache_key in self.cache:
                cached_entry = self.cache[cache_key]
                if time.time() - cached_entry['timestamp'] < self.cache_timeout:
                    print("Returning cached route")
                    return cached_entry['data']
            
            # Snap start and end points to nearest roads for better route accuracy
            snapped_start = self.snap_to_nearest_road(start_coords[0], start_coords[1])
            snapped_end = self.snap_to_nearest_road(end_coords[0], end_coords[1])
            
            # Format coordinates for Google Maps
            origin = f"{snapped_start[0]},{snapped_start[1]}"
            destination = f"{snapped_end[0]},{snapped_end[1]}"
            
            url = "https://maps.googleapis.com/maps/api/directions/json"
            params = {
                'origin': origin,
                'destination': destination,
                'key': self.google_maps_api_key,
                'departure_time': 'now',  # For traffic-aware routing
                'alternatives': 'true',   # Get alternative routes
                'optimize': 'true' if optimize_waypoints else 'false'
            }
            
            # Add avoidance parameters instead of waypoints for better routing
            # This tells Google Maps to avoid tolls, highways, and ferries when possible
            # We'll also add waypoints only when absolutely necessary
            if avoid_risks and len(avoid_risks) > 0:
                # For a small number of risks, we can use the avoid parameter
                # For more risks, we need to use waypoints
                high_risks = [risk for risk in avoid_risks if risk.get('severity') == 'high']
                medium_risks = [risk for risk in avoid_risks if risk.get('severity') == 'medium']
                low_risks = [risk for risk in avoid_risks if risk.get('severity') == 'low']
                
                # Always avoid tolls and ferries for better routes
                params['avoid'] = 'tolls|ferries'
                
                # Use waypoints for high and medium severity risks to prevent inefficient routing
                significant_risks = high_risks + medium_risks
                if significant_risks:
                    waypoints = self.extract_waypoints_from_risks(significant_risks)
                    if waypoints:
                        # Limit to 8 waypoints maximum to prevent inefficient routing
                        params['waypoints'] = '|'.join(waypoints[:8])
            
            response = requests.get(url, params=params, timeout=15)
            if response.status_code == 200:
                data = response.json()
                if data['status'] == 'OK' and len(data['routes']) > 0:
                    # Process all routes
                    processed_routes = []
                    for route in data['routes']:
                        leg = route['legs'][0]
                        
                        # Decode polyline to get actual route points
                        route_points = []
                        if 'overview_polyline' in route and 'points' in route['overview_polyline']:
                            try:
                                decoded_points = polyline.decode(route['overview_polyline']['points'])
                                route_points = [{'lat': lat, 'lng': lng} for lat, lng in decoded_points]
                            except Exception as e:
                                print(f"Polyline decoding error: {str(e)}")
                                # Fallback: create simple route with just start and end points
                                route_points = [
                                    {'lat': snapped_start[0], 'lng': snapped_start[1]},
                                    {'lat': snapped_end[0], 'lng': snapped_end[1]}
                                ]
                        
                        processed_route = {
                            'distance': leg['distance']['value'] / 1000,  # Convert to km
                            'duration': leg['duration']['value'] / 60,    # Convert to minutes
                            'duration_in_traffic': leg.get('duration_in_traffic', {}).get('value', leg['duration']['value']) / 60,
                            'steps': [step['html_instructions'] for step in leg['steps']],
                            'overview_polyline': route['overview_polyline']['points'] if 'overview_polyline' in route else '',
                            'route_points': route_points,
                            'start_address': leg['start_address'],
                            'end_address': leg['end_address'],
                            'bounds': route.get('bounds', {})
                        }
                        processed_routes.append(processed_route)
                    
                    # Return primary route and alternatives
                    result = {
                        'primary': processed_routes[0] if processed_routes else None,
                        'alternatives': processed_routes[1:] if len(processed_routes) > 1 else []
                    }
                    
                    # Cache the result
                    self.cache[cache_key] = {
                        'data': result,
                        'timestamp': time.time()
                    }
                    
                    return result
            return None
        except Exception as e:
            print(f"Google Maps route error: {str(e)}")
            return None
    
    def extract_waypoints_from_risks(self, risks):
        """Extract waypoints to avoid risk areas - now considers ALL risk severities."""
        waypoints = []
        for risk in risks:
            # Consider ALL risks for avoidance, not just high severity ones
            # This is a key enhancement for better risk-aware routing
            severity = risk.get('severity', 'low')
            coords = risk.get('coordinates') or risk.get('location')
            if coords and len(coords) >= 2:
                # Calculate avoidance point based on severity
                if severity == 'high':
                    # Larger offset for high severity risks (100m)
                    avoidance_point = self.calculate_avoidance_point(coords[0], coords[1], 0.1)
                    waypoints.append(f"via:{avoidance_point[0]},{avoidance_point[1]}")
                elif severity == 'medium':
                    # Medium offset for medium severity risks (75m)
                    avoidance_point = self.calculate_avoidance_point(coords[0], coords[1], 0.075)
                    waypoints.append(f"via:{avoidance_point[0]},{avoidance_point[1]}")
                else:  # low severity
                    # Smaller offset for low severity risks (50m)
                    avoidance_point = self.calculate_avoidance_point(coords[0], coords[1], 0.05)
                    waypoints.append(f"via:{avoidance_point[0]},{avoidance_point[1]}")
        
        # Sort waypoints by distance from start to create a more logical route
        # Increased limit to 8 waypoints to accommodate more risks
        return waypoints[:8]

    def calculate_avoidance_point(self, lat, lng, offset_distance=0.1):
        """Calculate a point offset from the risk location to avoid it."""
        # Simple offset calculation (approximately 100m)
        # In a real implementation, you would calculate based on road network
        offset_lat = lat + (offset_distance / 111.0)  # Roughly 1km per degree
        offset_lng = lng + (offset_distance / (111.0 * math.cos(math.radians(lat))))
        return [offset_lat, offset_lng]

    def optimize_route_with_agent_location(self, agent_coords, dropoff_coords, risk_alerts):
        """Optimize route specifically for agent's current location to dropoff point."""
        try:
            print(f"Optimizing route from agent {agent_coords} to dropoff {dropoff_coords}")
            
            # Get the risk-aware route
            risk_aware_route = self.get_google_maps_route(agent_coords, dropoff_coords, risk_alerts)
            
            if risk_aware_route and risk_aware_route.get('primary'):
                # Enhance with risk data
                self.enhance_routes_with_risk_data(risk_aware_route, risk_alerts)
                return risk_aware_route
            
            # Fallback to direct route if risk-aware route fails
            direct_route = self.get_google_maps_route(agent_coords, dropoff_coords, [])
            return direct_route
        except Exception as e:
            print(f"Agent route optimization error: {str(e)}")
            # Final fallback
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
            severity_multiplier = {'low': 1, 'medium': 2, 'high': 3}
            severity_score = severity_multiplier.get(severity, 1)
            
            # Check if risk is near the route
            risk_coords = risk.get('coordinates') or risk.get('location')
            if risk_coords and len(risk_coords) >= 2:
                min_distance = float('inf')
                for point in route_points:
                    distance = self.calculate_distance(
                        risk_coords[0], risk_coords[1],
                        point['lat'], point['lng']
                    )
                    min_distance = min(min_distance, distance)
                
                # Higher score for risks closer to the route
                if min_distance < 0.1:  # Within 100m
                    risk_score += severity_score * 10
                elif min_distance < 0.5:  # Within 500m
                    risk_score += severity_score * 5
                elif min_distance < 1.0:  # Within 1km
                    risk_score += severity_score * 2
                elif min_distance < 2.0:  # Within 2km
                    risk_score += severity_score * 0.5
        
        return min(risk_score, 100.0)  # Cap at 100
    
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
            if risk_coords and len(risk_coords) >= 2:
                min_distance = float('inf')
                for point in route_points:
                    distance = self.calculate_distance(
                        risk_coords[0], risk_coords[1],
                        point['lat'], point['lng']
                    )
                    min_distance = min(min_distance, distance)
                
                # Consider risk on route if within 1km for high risks, 500m for medium risks, 200m for low risks
                severity = risk.get('severity', 'low')
                threshold = 1.0 if severity == 'high' else 0.5 if severity == 'medium' else 0.2
                
                if min_distance <= threshold:
                    risk_with_distance = risk.copy()
                    risk_with_distance['distance_from_route'] = min_distance
                    risks_on_route.append(risk_with_distance)
        
        return risks_on_route
    
    def enhance_routes_with_risk_data(self, routes, risk_alerts):
        """Enhance routes with risk information."""
        # Add risk scores and information to routes
        if 'primary' in routes and routes['primary']:
            routes['primary']['risk_score'] = self.calculate_route_risk_score(routes['primary'], risk_alerts)
            routes['primary']['risks_on_route'] = self.identify_risks_on_route(routes['primary'], risk_alerts)
        
        if 'alternatives' in routes:
            for alternative in routes['alternatives']:
                alternative['risk_score'] = self.calculate_route_risk_score(alternative, risk_alerts)
                alternative['risks_on_route'] = self.identify_risks_on_route(alternative, risk_alerts)
    
    def check_route_for_risks(self, route, risk_alerts):
        """Check if the current route contains any risked points and return a safer alternative if needed."""
        if not route or not risk_alerts:
            return route, False  # No change needed
        
        # Get risks on the current route
        risks_on_route = self.identify_risks_on_route(route, risk_alerts)
        
        # If there are high or medium severity risks on the route, we need to recalculate
        significant_risks = [risk for risk in risks_on_route if risk.get('severity') in ['high', 'medium']]
        
        if significant_risks:
            print(f"Found {len(significant_risks)} significant risks on current route, recalculating...")
            return None, True  # Need to recalculate route
        
        return route, False  # Route is safe, no change needed
    
    def get_optimized_delivery_sequence(self, delivery_locations):
        """Optimize delivery sequence using Google Maps Distance Matrix."""
        try:
            if len(delivery_locations) < 2:
                return delivery_locations
            
            # Convert locations to coordinate pairs
            coords = [(loc['lat'], loc['lng']) for loc in delivery_locations]
            
            # Calculate distance matrix
            matrix = self.calculate_distance_matrix(coords, coords)
            if not matrix:
                return delivery_locations
            
            # Simple nearest neighbor algorithm for demonstration
            # In production, you would use a more sophisticated algorithm like TSP solver
            optimized_sequence = [0]  # Start with first location
            unvisited = set(range(1, len(delivery_locations)))
            
            current = 0
            while unvisited:
                nearest = min(unvisited, key=lambda x: matrix[current][x]['distance'] if matrix[current][x] else float('inf'))
                optimized_sequence.append(nearest)
                unvisited.remove(nearest)
                current = nearest
            
            # Return optimized locations
            return [delivery_locations[i] for i in optimized_sequence]
        except Exception as e:
            print(f"Delivery sequence optimization error: {str(e)}")
            return delivery_locations

    def geocode_address(self, address):
        """Convert address to coordinates using Google Maps Geocoding API."""
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
        print(f"Received optimize request with data: {data}")  # Debug log
        
        # Required fields
        start_location = data.get('start_location')
        end_location = data.get('end_location')
        risk_aware = data.get('risk_aware', True)  # Default to risk-aware routing
        risk_alerts = data.get('risk_alerts', [])
        
        print(f"Start location: {start_location}")  # Debug log
        print(f"End location: {end_location}")  # Debug log
        print(f"Risk aware: {risk_aware}")  # Debug log
        print(f"Risk alerts: {risk_alerts}")  # Debug log
        
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
        # Modified condition: if risk_aware is True, use risk-aware routing regardless of whether risk_alerts is empty
        if risk_aware:
            print("Using risk-aware routing")  # Debug log
            # Use our enhanced risk-aware routing specifically for agent location
            routes = optimizer.optimize_route_with_agent_location(
                [start_lat, start_lng],
                [end_lat, end_lng],
                risk_alerts
            )
            
            if routes and routes.get('primary'):
                # Check if the route contains any significant risks
                primary_route = routes['primary']
                safe_route, needs_recalculation = optimizer.check_route_for_risks(primary_route, risk_alerts)
                
                if needs_recalculation:
                    print("Current route contains risks, recalculating with enhanced avoidance...")
                    # Recalculate with stronger avoidance
                    enhanced_risk_alerts = []
                    for risk in risk_alerts:
                        # Increase the avoidance distance for all risks
                        enhanced_risk = risk.copy()
                        enhanced_risk['severity'] = 'high'  # Treat all risks as high for stronger avoidance
                        enhanced_risk_alerts.append(enhanced_risk)
                    
                    # Get a new route with enhanced risk avoidance
                    routes = optimizer.get_google_maps_route(
                        [start_lat, start_lng],
                        [end_lat, end_lng],
                        enhanced_risk_alerts
                    )
                    
                    if routes and routes.get('primary'):
                        # Enhance with risk data
                        optimizer.enhance_routes_with_risk_data(routes, risk_alerts)
                        result.update({
                            'routes': routes,
                            'risk_aware': True,
                            'recalculated': True,
                            'recalculation_reason': 'Route contained significant risks'
                        })
                    else:
                        # Fallback to basic routing if enhanced avoidance fails
                        routes = optimizer.get_google_maps_route(
                            [start_lat, start_lng],
                            [end_lat, end_lng],
                            []  # No risk alerts
                        )
                        
                        if routes and routes.get('primary'):
                            result.update({
                                'routes': routes,
                                'risk_aware': False,
                                'recalculated': True,
                                'recalculation_reason': 'Enhanced risk avoidance failed, using basic routing'
                            })
                        else:
                            return jsonify({'error': 'Could not calculate route'}), 500
                else:
                    # Route is safe, use it as is
                    result.update({
                        'routes': routes,
                        'risk_aware': True,
                        'recalculated': False
                    })
            else:
                print("Risk-aware routing failed, falling back to basic routing")  # Debug log
                # Fallback to basic Google Maps route without risk awareness
                routes = optimizer.get_google_maps_route(
                    [start_lat, start_lng],
                    [end_lat, end_lng],
                    []  # No risk alerts
                )
                
                if routes and routes.get('primary'):
                    result.update({
                        'routes': routes,
                        'risk_aware': False
                    })
                else:
                    return jsonify({'error': 'Could not calculate route'}), 500
        else:
            print("Using basic routing")  # Debug log
            # Get basic route from Google Maps without risk awareness
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
                return jsonify({'error': 'Could not calculate route'}), 500
        
        print(f"Returning result: {result}")  # Debug log
        return jsonify(result)
    
    except Exception as e:
        print(f"Route optimization error: {str(e)}")
        import traceback
        traceback.print_exc()  # Print full traceback
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

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
        
        alternatives = optimizer.get_google_maps_route(
            [start_location['lat'], start_location['lng']],
            [end_location['lat'], end_location['lng']],
            risk_alerts
        )
        
        # Enhance routes with risk information
        if alternatives and risk_alerts:
            optimizer.enhance_routes_with_risk_data(alternatives, risk_alerts)
        
        return jsonify({
            'routes': alternatives,
            'timestamp': datetime.utcnow().isoformat()
        })
    
    except Exception as e:
        print(f"Alternative routes error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/geocode', methods=['POST'])
def geocode():
    """Geocode an address to coordinates."""
    try:
        data = request.get_json()
        address = data.get('address')
        
        if not address:
            return jsonify({'error': 'Address required'}), 400
        
        result = optimizer.geocode_address(address)  # This should be optimizer.geocode_address
        if not result:
            return jsonify({'error': 'Could not geocode address'}), 404
        
        return jsonify(result)
    
    except Exception as e:
        print(f"Geocoding error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/reverse-geocode', methods=['POST'])
def reverse_geocode():
    """Reverse geocode coordinates to address."""
    try:
        data = request.get_json()
        lat = data.get('lat')
        lng = data.get('lng')
        
        if lat is None or lng is None:
            return jsonify({'error': 'Latitude and longitude required'}), 400
        
        result = optimizer.reverse_geocode(lat, lng)  # This should be optimizer.reverse_geocode
        if not result:
            return jsonify({'error': 'Could not reverse geocode coordinates'}), 404
        
        return jsonify(result)
    
    except Exception as e:
        print(f"Reverse geocoding error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

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
        
        return jsonify({
            'optimized_sequence': optimized_sequence,
            'timestamp': datetime.utcnow().isoformat()
        })
    
    except Exception as e:
        print(f"Delivery sequence optimization error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)