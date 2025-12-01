import requests
import os
from dotenv import load_dotenv

# Load environment variables from the current directory
load_dotenv()

# Get the Google Maps API key
GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY')
print(f"Google Maps API Key: {GOOGLE_MAPS_API_KEY}")

# Test the Directions API
url = "https://maps.googleapis.com/maps/api/directions/json"
params = {
    'origin': '12.840641,80.153428',
    'destination': '12.835736,80.228920',
    'key': GOOGLE_MAPS_API_KEY
}

try:
    response = requests.get(url, params=params)
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Status: {data.get('status')}")
        if 'error_message' in data:
            print(f"Error Message: {data['error_message']}")
        if 'routes' in data and len(data['routes']) > 0:
            print(f"Found {len(data['routes'])} routes")
            route = data['routes'][0]
            print(f"Route distance: {route['legs'][0]['distance']['text']}")
            print(f"Route duration: {route['legs'][0]['duration']['text']}")
        else:
            print("No routes found")
    else:
        print(f"Response: {response.text}")
except Exception as e:
    print(f"Error: {str(e)}")