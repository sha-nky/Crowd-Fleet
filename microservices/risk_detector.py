"""
Risk Detection Engine for CrowdFleet
This microservice monitors real-time data sources to detect potential delivery risks.
"""

import os
import json
import requests
import tweepy
from flask import Flask, request, jsonify
from flask_cors import CORS  # Add CORS support
from datetime import datetime, timedelta
import re
from dotenv import load_dotenv
import math

# Load environment variables
load_dotenv()

# Configuration
TWITTER_API_KEY = os.getenv('TWITTER_API_KEY', 'X3W5O7qDjD4ArkkQuvkOr6gz7')
TWITTER_API_SECRET = os.getenv('TWITTER_API_SECRET', 'v2Iw2HLFIZQPj46tpxTZOJnCF7ipaVgxo9I843lU1cEvfrx7U4')
TWITTER_BEARER_TOKEN = os.getenv('TWITTER_BEARER_TOKEN', 'AAAAAAAAAAAAAAAAAAAAACUz4gEAAAAArFouP7tmiifVj38Fz1IQNq9wEiU%3Db64VwMEcKOaHTfZCuEGaNDnBpo72Gik63ZV3nRroCTOEHFZqkE')
NEWS_API_KEY = os.getenv('NEWS_API_KEY', '7c262759d2204d43864b274c75a60adc')
OPENWEATHER_API_KEY = os.getenv('OPENWEATHER_API_KEY', 'bb98915834d95e340f32ea812df6fa2b')
GDACS_API_URL = "https://www.gdacs.org/DesktopModules/GDACS/api/events"

try:
    import spacy
    try:
        nlp = spacy.load("en_core_web_sm")
    except OSError:
        print("Warning: spaCy English model not found. Location extraction may be limited.")
        nlp = None
except ImportError:
    print("Warning: spaCy not installed. Location extraction will use regex patterns.")
    nlp = None

app = Flask(__name__)
# Enable CORS with specific configuration for frontend communication
CORS(app, resources={r"/*": {"origins": "*"}})  # In production, restrict origins to specific domains

class SimulatedRisk:
    """Class to manage predefined simulated risks for testing and demonstration."""
    
    # Predefined simulated risks
    SIMULATED_RISKS = [
        {
            'source': 'simulated',
            'type': 'accident',
            'description': 'Simulated traffic accident on route',
            'severity': 'high',
            'location': 'Pulicat Rd, Kavaraipettai',
            'coordinates': [13.21494, 80.08234],
            'timestamp': datetime.utcnow().isoformat()
        },
        {
            'source': 'simulated',
            'type': 'road_construction',
            'description': 'Road construction causing delays',
            'severity': 'medium',
            'location': 'Kavaraipettai Main Rd',
            'coordinates': [13.365000, 80.140500],
            'timestamp': datetime.utcnow().isoformat()
        },
        {
            'source': 'simulated',
            'type': 'weather_alert',
            'description': 'Heavy rain causing slippery roads',
            'severity': 'medium',
            'location': 'Kilmudalambedu',
            'coordinates': [13.364500, 80.141000],
            'timestamp': datetime.utcnow().isoformat()
        }
    ]
    
    @classmethod
    def get_risks_in_area(cls, location, radius_km=10):
        """Get simulated risks within a specified area."""
        risks_in_area = []
        for risk in cls.SIMULATED_RISKS:
            # Calculate distance to check if within radius
            if 'coordinates' in risk:
                distance = cls.calculate_distance(
                    location['lat'], location['lng'],
                    risk['coordinates'][0], risk['coordinates'][1]
                )
                # Only include risks within the specified radius
                if distance <= radius_km:
                    risk_copy = risk.copy()
                    risk_copy['distance_km'] = distance
                    risks_in_area.append(risk_copy)
        return risks_in_area
    
    @classmethod
    def calculate_distance(cls, lat1, lon1, lat2, lon2):
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

class RiskDetector:
    def __init__(self):
        # Initialize Twitter API client
        try:
            self.twitter_client = tweepy.Client(
                bearer_token=TWITTER_BEARER_TOKEN,
                consumer_key=TWITTER_API_KEY,
                consumer_secret=TWITTER_API_SECRET
            ) if TWITTER_API_KEY != 'your_twitter_api_key' else None
        except Exception as e:
            print(f"Twitter API initialization error: {str(e)}")
            self.twitter_client = None
    
    def get_user_reported_risks(self, location, radius_km=10):
        """Get user-reported risk alerts from the database."""
        risks = []
        
        try:
            # Make HTTP request to backend API to get nearby risk alerts
            backend_url = "http://localhost:3000/api/risk/nearby"
            params = {
                'lat': location['lat'],
                'lng': location['lng'],
                'radius': radius_km
            }
            
            response = requests.get(backend_url, params=params, timeout=10)
            if response.status_code == 200:
                risk_alerts = response.json()
                for alert in risk_alerts:
                    risks.append({
                        'source': 'user_reported',
                        'type': alert.get('type', 'general'),
                        'description': alert.get('description', 'User reported risk'),
                        'severity': alert.get('severity', 'medium'),
                        'location': alert.get('location', location),
                        'timestamp': alert.get('timestamp', datetime.utcnow().isoformat()),
                        'coordinates': [
                            alert['location']['lat'] if 'location' in alert and 'lat' in alert['location'] else location['lat'],
                            alert['location']['lng'] if 'location' in alert and 'lng' in alert['location'] else location['lng']
                        ]
                    })
                print(f"Retrieved {len(risks)} user-reported risks from backend")
            else:
                print(f"Failed to fetch user-reported risks: {response.status_code}")
        except Exception as e:
            print(f"Error fetching user-reported risks: {str(e)}")
        
        return risks

    def detect_traffic_incidents(self, location, radius_km=10):
        """Detect traffic incidents from social media and news."""
        incidents = []
        
        # Twitter search for traffic incidents with #crowdfleet hashtag
        if self.twitter_client:
            try:
                # Search specifically for tweets with #crowdfleet hashtag
                query = f"#crowdfleet -is:retweet"
                print(f"Searching Twitter for #crowdfleet tweets with query: {query}")
                tweets = self.twitter_client.search_recent_tweets(
                    query=query,
                    max_results=50,  # Increased to capture more #crowdfleet tweets
                    tweet_fields=['created_at', 'geo', 'public_metrics'],
                    expansions=['author_id', 'geo.place_id'],
                    place_fields=['full_name', 'country', 'geo']
                )
                # Access data attribute safely
                tweet_data = getattr(tweets, 'data', None)
                print(f"Found {len(tweet_data) if tweet_data else 0} #crowdfleet tweets")
                
                for tweet in tweet_data if tweet_data else []:
                    # Extract location and incident type from tweet
                    tweet_location = self.extract_location_from_tweet(tweet.text, location)
                    
                    # Extract incident information from tweet
                    incident = self.extract_incident_from_tweet(tweet.text)
                    if incident:
                        # Calculate distance to check if within radius
                        if tweet_location and 'coordinates' in tweet_location:
                            distance = self.calculate_distance(
                                location['lat'], location['lng'],
                                tweet_location['coordinates'][0], tweet_location['coordinates'][1]
                            )
                            # Only include incidents within the specified radius
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
                            # If no location in tweet, assume it's relevant if it has #crowdfleet
                            incidents.append({
                                'source': 'twitter',
                                'type': incident['type'],
                                'description': tweet.text,
                                'severity': incident['severity'],
                                'location': location,  # Use search location as fallback
                                'timestamp': tweet.created_at.isoformat() if hasattr(tweet, 'created_at') else datetime.utcnow().isoformat(),
                                'coordinates': [location['lat'], location['lng']]
                            })
            except Exception as e:
                print(f"Twitter search error: {str(e)}")
        else:
            print("Twitter client not initialized")
        
        return incidents  # Return the incidents list
    
    def extract_location_from_tweet(self, text, search_location):
        """Extract location information from tweet text using regex patterns."""
        coordinates = None
        location_name = None
        
        # Regex patterns for coordinates
        coord_patterns = [
            r'(-?\d+\.\d+),\s*(-?\d+\.\d+)',  # Decimal format
            r'(-?\d+°\s*\d+\'\s*\d+"[NS]),\s*(-?\d+°\s*\d+\'\s*\d+"[EW])'  # DMS format
        ]
        
        for pattern in coord_patterns:
            matches = re.findall(pattern, text)
            if matches:
                # Return first match as [lat, lng]
                try:
                    if ',' in pattern:  # Decimal format
                        coordinates = [float(matches[0][0]), float(matches[0][1])]
                    else:  # DMS format would need conversion
                        coordinates = [search_location['lat'], search_location['lng']]  # Fallback
                except:
                    coordinates = [search_location['lat'], search_location['lng']]  # Fallback
                break
        
        # If no coordinates found, return search location as fallback
        if not coordinates:
            coordinates = [search_location['lat'], search_location['lng']]
        
        return {
            'location': location_name or f"Near {search_location['lat']}, {search_location['lng']}",
            'coordinates': coordinates
        }
    
    def extract_incident_from_tweet(self, text):
        """Extract incident information from tweet text."""
        # Simple keyword-based extraction
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
            # Get recent disaster events from GDACS
            params = {
                'eventtype': 'TC,EQ,FL,VO,DR,WF',  # Tropical Cyclone, Earthquake, Flood, Volcano, Drought, Wildfire
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
        
        # Twitter search for protests
        if self.twitter_client:
            try:
                query = f"protest OR demonstration OR rally OR unrest near {location} -is:retweet"
                tweets = self.twitter_client.search_recent_tweets(
                    query=query,
                    max_results=20,
                    tweet_fields=['created_at', 'geo']
                )
                # Access data attribute safely
                tweet_data = getattr(tweets, 'data', None)
                
                for tweet in tweet_data if tweet_data else []:
                    incidents.append({
                        'source': 'twitter',
                        'type': 'protest',
                        'description': tweet.text,
                        'severity': 'medium',
                        'location': location,  # Would need NER to extract location
                        'timestamp': tweet.created_at.isoformat(),
                        'coordinates': self.extract_coordinates_from_tweet(tweet.text)
                    })
            except Exception as e:
                print(f"Protest detection error: {str(e)}")
        
        return incidents
    
    def get_weather_risks(self, location):
        """Get weather-related risks from OpenWeatherMap API."""
        risks = []
        
        try:
            # First, geocode the location to get coordinates
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
                    
                    # Get current weather
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
                        
                        # Check for severe weather conditions
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
        # Simple regex patterns for coordinates
        patterns = [
            r'(-?\d+\.\d+),\s*(-?\d+\.\d+)',  # Decimal format
            r'(-?\d+°\s*\d+\'\s*\d+"[NS]),\s*(-?\d+°\s*\d+\'\s*\d+"[EW])'  # DMS format
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text)
            if matches:
                # Return first match as [lat, lng]
                return [float(matches[0][0]), float(matches[0][1])]
        return None
    
    def extract_coordinates_from_news(self, article):
        """Extract coordinates from news article."""
        # In a real implementation, this would use NER or geocoding
        # For now, we'll return None
        return None
    
    def calculate_risk_score(self, risks, delivery_route):
        """Calculate overall risk score for a delivery route."""
        if not risks:
            return 0.0
        
        # Risk scoring based on severity and proximity to route
        total_score = 0.0
        for risk in risks:
            severity = risk.get('severity', 'low')
            severity_multiplier = {'low': 1, 'medium': 2, 'high': 3}
            score = severity_multiplier.get(severity, 1)
            
            # If risk has coordinates, calculate proximity to route
            risk_coords = risk.get('coordinates') or risk.get('location')
            if risk_coords and delivery_route:
                proximity = self.calculate_proximity_to_route(risk_coords, delivery_route)
                # Higher score for risks closer to the route
                score *= (1 / (proximity + 1))
            
            total_score += score
        
        return min(total_score, 100.0)  # Cap at 100
    
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

# Initialize detector
detector = RiskDetector()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({'status': 'ok', 'service': 'risk-detector'})

@app.route('/detect', methods=['POST'])
def detect_risks():
    """Detect risks in a specific area."""
    try:
        data = request.get_json()
        location = data.get('location')
        radius_km = data.get('radius_km', 10)
        delivery_route = data.get('delivery_route')  # Optional route for proximity calculation
        
        if not location:
            return jsonify({'error': 'Location required'}), 400
        
        # Collect all risks
        all_risks = []
        
        # Traffic incidents
        traffic_incidents = detector.detect_traffic_incidents(location, radius_km) or []
        all_risks.extend(traffic_incidents)
        
        # Protests and civil unrest
        protests = detector.get_protests_and_civil_unrest(location) or []
        all_risks.extend(protests)
        
        # Weather-related risks
        weather_risks = detector.get_weather_risks(location) or []
        all_risks.extend(weather_risks)
        
        # Natural disasters (global)
        disasters = detector.get_natural_disasters() or []
        all_risks.extend(disasters)
        
        # Add user-reported risks from the database
        user_risks = detector.get_user_reported_risks(location, radius_km)
        all_risks.extend(user_risks)
        
        # Add simulated risks for testing and demonstration
        simulated_risks = SimulatedRisk.get_risks_in_area(location, radius_km)
        all_risks.extend(simulated_risks)
        
        # Calculate risk score if delivery route is provided
        risk_score = 0.0
        if delivery_route:
            risk_score = detector.calculate_risk_score(all_risks, delivery_route)
        
        # Sort risks by severity (high first)
        severity_order = {'high': 3, 'medium': 2, 'low': 1}
        all_risks.sort(key=lambda x: severity_order.get(x.get('severity', 'low'), 0), reverse=True)
        
        # Limit to top 50 risks
        all_risks = all_risks[:50]
        
        return jsonify({
            'risks': all_risks,
            'count': len(all_risks),
            'risk_score': risk_score,
            'timestamp': datetime.utcnow().isoformat()
        })
    
    except Exception as e:
        print(f"Risk detection error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/disasters', methods=['GET'])
def get_disasters():
    """Get global natural disaster alerts."""
    try:
        disasters = detector.get_natural_disasters()
        
        return jsonify({
            'disasters': disasters,
            'count': len(disasters),
            'timestamp': datetime.utcnow().isoformat()
        })
    
    except Exception as e:
        print(f"Disaster fetch error: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5002, debug=True)