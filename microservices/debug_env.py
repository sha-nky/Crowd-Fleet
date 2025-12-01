import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Print environment variables
print("GOOGLE_MAPS_API_KEY:", os.getenv('GOOGLE_MAPS_API_KEY'))
print("GOOGLE_MAPS_GEOCODING_API_KEY:", os.getenv('GOOGLE_MAPS_GEOCODING_API_KEY'))
print("Current working directory:", os.getcwd())
print("Files in current directory:", os.listdir('.'))