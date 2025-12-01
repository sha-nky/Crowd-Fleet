"""
Risk Detection Engine for CrowdFleet
"""

import os
import json
import requests
import tweepy
from flask import Flask, request, jsonify
from flask_cors import CORS
from datetime import datetime, timedelta
import re
from dotenv import load_dotenv
import math
import sys
import time
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from encoding_utils import validate_json_response
try:
    from geopy.geocoders import Nominatim
    GEOCODING_AVAILABLE = True
except ImportError:
    Nominatim = None
    GEOCODING_AVAILABLE = False
    print("Warning: geopy not installed. Location geocoding will be disabled.")

# Load environment variables
load_dotenv()

# Configuration
TWITTER_API_KEY = os.getenv('TWITTER_API_KEY')
TWITTER_API_SECRET = os.getenv('TWITTER_API_SECRET')
TWITTER_BEARER_TOKEN = os.getenv('TWITTER_BEARER_TOKEN')
NEWS_API_KEY = os.getenv('NEWS_API_KEY')
OPENWEATHER_API_KEY = os.getenv('OPENWEATHER_API_KEY')
GDACS_API_URL = "https://www.gdacs.org/DesktopModules/GDACS/api/events"

BACKEND_API_URL = "http://localhost:5000"

# Simple in-memory cache for risk data
risk_cache = {}
CACHE_DURATION = 60

try:
    import spacy
    try:
        nlp = spacy.load("en_core_web_sm")
        print("spaCy English model loaded successfully")
    except OSError:
        print("Warning: spaCy English model not found. Location extraction may be limited.")
        print("Please install the model using: python -m spacy download en_core_web_sm")
        nlp = None
except ImportError:
    print("Warning: spaPy not installed. Location extraction will use regex patterns.")
    print("Please install spaCy using: pip install spacy")
    nlp = None

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})


class RiskDetector:
    def __init__(self):
        try:
            if TWITTER_API_KEY and TWITTER_API_SECRET and TWITTER_BEARER_TOKEN:
                self.twitter_client = tweepy.Client(
                    bearer_token=TWITTER_BEARER_TOKEN,
                    consumer_key=TWITTER_API_KEY,
                    consumer_secret=TWITTER_API_SECRET
                )
                print("Twitter API client initialized successfully")
            else:
                print("Twitter API credentials not provided. Twitter integration disabled.")
                self.twitter_client = None
        except Exception as e:
            print(f"Twitter API initialization error: {str(e)}")
            self.twitter_client = None
    
    def get_cached_risks(self, location, radius_km):
        """Get cached risks if available and not expired."""
        cache_key = f"{location['lat']}_{location['lng']}_{radius_km}"
        if cache_key in risk_cache:
            cached_entry = risk_cache[cache_key]
            if time.time() - cached_entry['timestamp'] < CACHE_DURATION:
                print("Returning cached risk data")
                return cached_entry['data']
            else:
                del risk_cache[cache_key]
        return None
    
    def cache_risks(self, location, radius_km, risks):
        """Cache risk data."""
        cache_key = f"{location['lat']}_{location['lng']}_{radius_km}"
        risk_cache[cache_key] = {
            'data': risks,
            'timestamp': time.time()
        }
    
    def get_user_reported_risks(self, location, radius_km=10):
        """Get user-reported risk alerts from the database."""
        risks = []
        
        try:
            backend_url = f"{BACKEND_API_URL}/api/risk/nearby"
            params = {
                'lat': location['lat'],
                'lng': location['lng'],
                'radius': radius_km
            }
            
            print(f"Fetching user-reported risks from: {backend_url} with params: {params}")
            response = requests.get(backend_url, params=params, timeout=60)
            print(f"Response status: {response.status_code}")
            if response.status_code == 200:
                risk_alerts = response.json()
                print(f"Received {len(risk_alerts)} risk alerts from backend API")
                for alert in risk_alerts:
                    print(f"Processing risk alert: {alert}")
                    risk_data = {
                        'source': 'user_reported',
                        'type': alert.get('type', 'general'),
                        'description': alert.get('description', 'User reported risk'),
                        'severity': alert.get('severity', 'medium'),
                        'location': {
                            'lat': alert['location']['lat'] if 'location' in alert and 'lat' in alert['location'] else location['lat'],
                            'lng': alert['location']['lng'] if 'location' in alert and 'lng' in alert['location'] else location['lng']
                        },
                        'timestamp': alert.get('timestamp', datetime.utcnow().isoformat()),
                        'coordinates': [
                            alert['location']['lat'] if 'location' in alert and 'lat' in alert['location'] else location['lat'],
                            alert['location']['lng'] if 'location' in alert and 'lng' in alert['location'] else location['lng']
                        ]
                    }
                    risks.append(risk_data)
                print(f"Retrieved {len(risks)} user-reported risks from backend")
            else:
                print(f"Failed to fetch user-reported risks: {response.status_code}")
                print(f"Response text: {response.text}")
        except Exception as e:
            print(f"Error fetching user-reported risks: {str(e)}")
            import traceback
            traceback.print_exc()
        
        return risks

    def detect_traffic_incidents(self, location, radius_km=10):
        """Detect traffic incidents from social media and news."""
        incidents = []
        
        if self.twitter_client:
            try:
                query = f"#crowdfleet -is:retweet"
                print(f"Searching Twitter for #crowdfleet tweets with query: {query}")
                tweets = self.twitter_client.search_recent_tweets(
                    query=query,
                    max_results=50,
                    tweet_fields=['created_at', 'geo', 'public_metrics'],
                    expansions=['author_id', 'geo.place_id'],
                    place_fields=['full_name', 'country', 'geo'],
                    timeout=30
                )
                tweet_data = getattr(tweets, 'data', None)
                print(f"Found {len(tweet_data) if tweet_data else 0} #crowdfleet tweets")
                
                for tweet in tweet_data if tweet_data else []:
                    tweet_location = self.extract_location_from_tweet(tweet.text, location)
                    incident = self.extract_incident_from_tweet(tweet.text)
                    if incident:
                        if tweet_location and 'coordinates' in tweet_location:
                            distance = self.calculate_distance(
                                location['lat'], location['lng'],
                                tweet_location['coordinates'][0], tweet_location['coordinates'][1]
                            )
                            if distance <= radius_km:
                                incidents.append({
                                    'source': 'twitter',
                                    'type': incident['type'],
                                    'description': tweet.text,
                                    'severity': incident['severity'],
                                    'location': tweet_location.get('location', location),
                                    'timestamp': tweet.created_at.isoformat() if hasattr(tweet, 'created_at') else datetime.utcnow().isoformat(),
                                    'coordinates': tweet_location['coordinates'],
                                    'distance_km': distance
                                })
                        else:
                            incidents.append({
                                'source': 'twitter',
                                'type': incident['type'],
                                'description': tweet.text,
                                'severity': incident['severity'],
                                'location': location,
                                'timestamp': tweet.created_at.isoformat() if hasattr(tweet, 'created_at') else datetime.utcnow().isoformat(),
                                'coordinates': [location['lat'], location['lng']]
                            })
            except Exception as e:
                print(f"Twitter search error: {str(e)}")
        else:
            print("Twitter client not initialized")
        
        return incidents
    
    def extract_location_from_tweet(self, text, search_location):
        """Extract location information from tweet text using spaCy NER or regex patterns."""
        coordinates = None
        location_name = None
        
        if nlp:
            try:
                doc = nlp(text)
                locations = [ent.text for ent in doc.ents if ent.label_ in ["GPE", "LOC"]]
                if locations:
                    location_name = locations[0]
                    print(f"Location detected by spaCy NER: {location_name}")
            except Exception as nlp_error:
                print(f"spaCy NLP error: {str(nlp_error)}")
        
        if not coordinates:
            coord_patterns = [
                r'(-?\d+\.\d+),\s*(-?\d+\.\d+)',
                r'(-?\d+°\s*\d+\'\s*\d+"[NS]),\s*(-?\d+°\s*\d+\'\s*\d+"[EW])'
            ]
            
            for pattern in coord_patterns:
                matches = re.findall(pattern, text)
                if matches:
                    try:
                        if ',' in pattern:
                            coordinates = [float(matches[0][0]), float(matches[0][1])]
                        else:
                            coordinates = [search_location['lat'], search_location['lng']]
                    except:
                        coordinates = [search_location['lat'], search_location['lng']]
                    break
        
        if not coordinates:
            coordinates = [search_location['lat'], search_location['lng']]
        
        return {
            'location': location_name or f"Near {search_location['lat']}, {search_location['lng']}",
            'coordinates': coordinates
        }
    
    def extract_incident_from_tweet(self, text):
        """Extract incident information from tweet text."""
        traffic_keywords = ['accident', 'crash', 'collision', 'traffic jam', 'roadblock', 'delay', 'slow']
        severity_keywords = {
            'high': ['major', 'severe', 'serious', 'fatal', 'catastrophic', 'huge'],
            'medium': ['moderate', 'minor', 'delay', 'slow', 'disruption'],
            'low': ['light', 'small', 'minor delay']
        }
        
        text_lower = text.lower()
        
        # Determine incident type
        incident_type = None
        for keyword in traffic_keywords:
            if keyword in text_lower:
                incident_type = keyword.replace(' ', '_')
                break
        
        if not incident_type:
            return None
        
        # Determine severity
        severity = 'low'
        for sev, keywords in severity_keywords.items():
            for keyword in keywords:
                if keyword in text_lower:
                    severity = sev
                    break
        
        return {
            'type': incident_type,
            'severity': severity
        }
    
    def get_natural_disasters(self):
        """Get natural disaster alerts from GDACS."""
        disasters = []
        
        try:
            params = {
                'eventtype': 'TC,EQ,FL,VO,DR,WF',
                'limit': 20
            }
            
            response = requests.get(GDACS_API_URL, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                for event in data.get('features', []):
                    properties = event.get('properties', {})
                    geometry = event.get('geometry', {})
                    
                    disasters.append({
                        'source': 'gdacs',
                        'type': properties.get('eventtype', 'natural_disaster').lower(),
                        'description': properties.get('description', ''),
                        'severity': self.map_gdacs_severity(properties.get('alertlevel', 0)),
                        'location': geometry.get('coordinates', [0, 0]) if geometry.get('coordinates') else [0, 0],
                        'timestamp': properties.get('fromdate', datetime.utcnow().isoformat()),
                        'population_exposed': properties.get('population_exposed', 0),
                        'population_death': properties.get('population_death', 0)
                    })
        except Exception as e:
            print(f"GDACS API error: {str(e)}")
        
        return disasters
    
    def map_gdacs_severity(self, alert_level):
        """Map GDACS alert level to our severity scale."""
        if alert_level >= 3:
            return 'high'
        elif alert_level >= 2:
            return 'medium'
        else:
            return 'low'
    
    def get_protests_and_civil_unrest(self, location):
        """Detect protests and civil unrest."""
        incidents = []
        
        if self.twitter_client:
            try:
                query = f"protest OR demonstration OR rally OR unrest near {location} -is:retweet"
                tweets = self.twitter_client.search_recent_tweets(
                    query=query,
                    max_results=20,
                    tweet_fields=['created_at', 'geo'],
                    timeout=30
                )
                tweet_data = getattr(tweets, 'data', None)
                
                for tweet in tweet_data if tweet_data else []:
                    tweet_location = self.extract_location_from_tweet(tweet.text, location)
                    incidents.append({
                        'source': 'twitter',
                        'type': 'protest',
                        'description': tweet.text,
                        'severity': 'medium',
                        'location': tweet_location.get('location', location),
                        'timestamp': tweet.created_at.isoformat(),
                        'coordinates': tweet_location.get('coordinates', [location['lat'], location['lng']])
                    })
            except Exception as e:
                print(f"Protest detection error: {str(e)}")
        
        return incidents
    
    def get_weather_risks(self, location):
        """Get weather-related risks from OpenWeatherMap API."""
        if not OPENWEATHER_API_KEY:
            print("OpenWeatherMap API key not available. Weather risk detection disabled.")
            return []
            
        risks = []
        
        try:
            geocode_url = "http://api.openweathermap.org/geo/1.0/direct"
            geocode_params = {
                'q': location,
                'limit': 1,
                'appid': OPENWEATHER_API_KEY
            }
            
            geocode_response = requests.get(geocode_url, params=geocode_params, timeout=10)
            if geocode_response.status_code == 200:
                geocode_data = geocode_response.json()
                if geocode_data:
                    lat = geocode_data[0]['lat']
                    lon = geocode_data[0]['lon']
                    
                    weather_url = "https://api.openweathermap.org/data/2.5/weather"
                    weather_params = {
                        'lat': lat,
                        'lon': lon,
                        'appid': OPENWEATHER_API_KEY,
                        'units': 'metric'
                    }
                    
                    weather_response = requests.get(weather_url, params=weather_params, timeout=10)
                    if weather_response.status_code == 200:
                        weather_data = weather_response.json()
                        weather_desc = weather_data['weather'][0]['main'].lower()
                        
                        if weather_desc in ['thunderstorm', 'snow', 'rain']:
                            risks.append({
                                'source': 'openweathermap',
                                'type': f'weather_{weather_desc}',
                                'description': f'Severe weather: {weather_data["weather"][0]["description"]}',
                                'severity': 'medium',
                                'location': [lat, lon],
                                'timestamp': datetime.utcnow().isoformat()
                            })
                        elif weather_desc in ['extreme']:
                            risks.append({
                                'source': 'openweathermap',
                                'type': f'weather_{weather_desc}',
                                'description': f'Extreme weather: {weather_data["weather"][0]["description"]}',
                                'severity': 'high',
                                'location': [lat, lon],
                                'timestamp': datetime.utcnow().isoformat()
                            })
        except Exception as e:
            print(f"Weather API error: {str(e)}")
        
        return risks
    
    def extract_coordinates_from_tweet(self, text):
        """Extract coordinates from tweet text using regex patterns."""
        patterns = [
            r'(-?\d+\.\d+),\s*(-?\d+\.\d+)',
            r'(-?\d+°\s*\d+\'\s*\d+"[NS]),\s*(-?\d+°\s*\d+\'\s*\d+"[EW])'
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text)
            if matches:
                return [float(matches[0][0]), float(matches[0][1])]
        return None
    
    def extract_coordinates_from_news(self, article):
        """Extract coordinates from news article."""
        return None
    
    def calculate_risk_score(self, risks, delivery_route):
        """Calculate overall risk score for a delivery route."""
        if not risks:
            return 0.0
        
        total_score = 0.0
        user_reported_count = 0
        
        for risk in risks:
            source = risk.get('source', 'system')
            is_user_reported = source == 'user_reported'
            
            if is_user_reported:
                user_reported_count += 1
            
            severity = risk.get('severity', 'low')
            severity_multiplier = {'low': 1, 'medium': 2, 'high': 3}
            score = severity_multiplier.get(severity, 1)
            
            if is_user_reported:
                score *= 1.5
                if risk.get('verified', False):
                    score *= 1.2
            
            risk_coords = risk.get('coordinates') or risk.get('location')
            if risk_coords and delivery_route:
                proximity = self.calculate_proximity_to_route(risk_coords, delivery_route)
                if is_user_reported:
                    score *= (1.5 / (proximity + 1))
                else:
                    score *= (1 / (proximity + 1))
            
            total_score += score
        
        if user_reported_count == 0:
            total_score *= 0.8
        
        return min(total_score, 100.0)
    
    def get_risks_within_avoidance_radius(self, risks, delivery_route, radius_meters=10):
        """Get risks that are within the avoidance radius of the delivery route."""
        if not risks or not delivery_route:
            return []
        
        risks_in_radius = []
        for risk in risks:
            risk_coords = risk.get('coordinates') or risk.get('location')
            if not risk_coords:
                continue
            
            for point in delivery_route:
                if self.is_within_avoidance_radius(risk_coords, point, radius_meters):
                    risks_in_radius.append(risk)
                    break
        
        return risks_in_radius

    def calculate_proximity_to_route(self, risk_coords, delivery_route):
        """Calculate proximity of risk to delivery route."""
        if not risk_coords or not delivery_route:
            return float('inf')
        
        min_distance = float('inf')
        for point in delivery_route:
            distance = self.calculate_distance(
                risk_coords[0], risk_coords[1],
                point['lat'], point['lng']
            )
            min_distance = min(min_distance, distance)
        
        return min_distance
    
    def is_within_avoidance_radius(self, risk_coords, route_point, radius_meters=10):
        """Check if a route point is within the avoidance radius of a risk point."""
        if not risk_coords or not route_point:
            return False
        
        distance_km = self.calculate_distance(
            risk_coords[0], risk_coords[1],
            route_point['lat'], route_point['lng']
        )
        distance_meters = distance_km * 1000
        
        return distance_meters <= radius_meters
    
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

# Initialize detector
detector = RiskDetector()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({'status': 'ok', 'service': 'risk-detector'})

@app.route('/detect', methods=['POST'])
def detect_risks():
    """Detect risks in the specified area."""
    try:
        data = request.get_json()
        location = data.get('location')
        radius_km = data.get('radius_km', 10)
        
        if not location or 'lat' not in location or 'lng' not in location:
            return jsonify({'error': 'Invalid location data'}), 400
        
        # Initialize risk detector
        detector = RiskDetector()
        
        # Check cache first
        cached_risks = detector.get_cached_risks(location, radius_km)
        if cached_risks is not None:
            return jsonify(cached_risks)
        
        # Get user-reported risks from database
        user_risks = detector.get_user_reported_risks(location, radius_km)
        print(f"Found {len(user_risks)} user-reported risks")
        
        # Detect traffic incidents from social media
        traffic_incidents = detector.detect_traffic_incidents(location, radius_km)
        print(f"Found {len(traffic_incidents)} traffic incidents")
        
        # Combine all risks
        all_risks = user_risks + traffic_incidents
        
        # Remove duplicates based on coordinates and type
        unique_risks = []
        seen_risks = set()
        for risk in all_risks:
            # Create a unique identifier for each risk
            coord_key = f"{risk['coordinates'][0]:.4f}_{risk['coordinates'][1]:.4f}_{risk['type']}"
            if coord_key not in seen_risks:
                seen_risks.add(coord_key)
                unique_risks.append(risk)
        
        # Calculate overall risk score (pass None for delivery_route since we don't have it in this context)
        risk_score = detector.calculate_risk_score(unique_risks, None)
        
        result = {
            'risks': unique_risks,
            'count': len(unique_risks),
            'risk_score': risk_score
        }
        
        # Cache the result
        detector.cache_risks(location, radius_km, result)
        
        validated_result = validate_json_response(result)
        return jsonify(validated_result)
        
    except Exception as e:
        print(f"Error in detect_risks: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Internal server error: {str(e)}'}), 500

@app.route('/disasters', methods=['GET'])
def get_disasters():
    """Get global natural disaster alerts."""
    try:
        disasters = detector.get_natural_disasters()
        
        result_data = {
            'disasters': disasters,
            'count': len(disasters),
            'timestamp': datetime.utcnow().isoformat()
        }
        
        is_valid, sanitized_result = validate_json_response(result_data)
        if not is_valid:
            if isinstance(sanitized_result, dict) and 'error' in sanitized_result:
                return jsonify(sanitized_result), 500
        return jsonify(sanitized_result)
    
    except Exception as e:
        print(f"Disaster fetch error: {str(e)}")
        error_msg = str(e)
        try:
            error_msg = error_msg.encode('utf-8', errors='ignore').decode('utf-8')
        except Exception:
            error_msg = "Internal server error occurred"
        return jsonify({'error': f'Internal server error: {error_msg}'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)