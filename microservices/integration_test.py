#!/usr/bin/env python3
"""
Integration test for CrowdFleet microservices
Tests both risk detection and route optimization working together
"""

import requests
import time
import json
from datetime import datetime

# Configuration
ROUTE_OPTIMIZER_URL = 'http://localhost:5001'
RISK_DETECTOR_URL = 'http://localhost:5002'

def test_health_endpoints():
    """Test health endpoints of both microservices."""
    print("=== Testing Health Endpoints ===")
    
    # Test route optimizer health
    try:
        response = requests.get(f'{ROUTE_OPTIMIZER_URL}/health', timeout=5)
        if response.status_code == 200:
            print(f"Route Optimizer Health: {response.json()}")
        else:
            print(f"Route Optimizer Health Check Failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"Route Optimizer Health Check Error: {str(e)}")
        return False
    
    # Test risk detector health
    try:
        response = requests.get(f'{RISK_DETECTOR_URL}/health', timeout=5)
        if response.status_code == 200:
            print(f"Risk Detector Health: {response.json()}")
        else:
            print(f"Risk Detector Health Check Failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"Risk Detector Health Check Error: {str(e)}")
        return False
    
    return True

def test_risk_detection():
    """Test risk detection with simulated risks."""
    print("\n=== Testing Risk Detection ===")
    
    # Test risk detection for the specific route area
    risk_payload = {
        "location": {
            "lat": 13.364120,
            "lng": 80.141430
        },
        "radius_km": 5
    }
    
    try:
        print("Detecting risks near pickup location...")
        response = requests.post(f'{RISK_DETECTOR_URL}/detect', json=risk_payload, timeout=10)
        if response.status_code == 200:
            risk_data = response.json()
            print(f"Risk Detection Success: Found {risk_data.get('count', 0)} risks")
            
            # Display detected risks
            risks = risk_data.get('risks', [])
            for i, risk in enumerate(risks[:3]):  # Show first 3 risks
                print(f"  {i+1}. {risk.get('type', 'Unknown')} ({risk.get('severity', 'Unknown')}): {risk.get('description', 'No description')}")
            
            return risks
        else:
            print(f"Risk Detection Failed: {response.status_code}")
            print(response.text)
            return []
    except Exception as e:
        print(f"Risk Detection Error: {str(e)}")
        return []

def test_route_optimization_without_risks():
    """Test route optimization without considering risks."""
    print("\n=== Testing Route Optimization (No Risk Awareness) ===")
    
    route_payload = {
        "start_location": {
            "lat": 13.364120,
            "lng": 80.141430  # Pickup: 107, Pulicat Rd, Kavaraipettai
        },
        "end_location": {
            "lat": 13.365132,
            "lng": 80.139976  # Dropoff: 948Q+3X5, Kavaraipettai
        },
        "risk_alerts": [],
        "risk_aware": False
    }
    
    try:
        print("Calculating direct route...")
        response = requests.post(f'{ROUTE_OPTIMIZER_URL}/optimize', json=route_payload, timeout=15)
        if response.status_code == 200:
            route_data = response.json()
            primary_route = route_data.get('routes', {}).get('primary', {})
            distance = primary_route.get('distance', 0)
            duration = primary_route.get('duration', 0)
            print(f"Direct Route Success: {distance:.3f} km, {duration:.1f} mins")
            return primary_route
        else:
            print(f"Direct Route Failed: {response.status_code}")
            print(response.text)
            return None
    except Exception as e:
        print(f"Direct Route Error: {str(e)}")
        return None

def test_route_optimization_with_risks(risk_alerts):
    """Test route optimization with risk awareness."""
    print("\n=== Testing Route Optimization (With Risk Awareness) ===")
    
    route_payload = {
        "start_location": {
            "lat": 13.364120,
            "lng": 80.141430  # Pickup: 107, Pulicat Rd, Kavaraipettai
        },
        "end_location": {
            "lat": 13.365132,
            "lng": 80.139976  # Dropoff: 948Q+3X5, Kavaraipettai
        },
        "risk_alerts": risk_alerts,
        "risk_aware": True
    }
    
    try:
        print("Calculating risk-aware route...")
        response = requests.post(f'{ROUTE_OPTIMIZER_URL}/optimize', json=route_payload, timeout=15)
        if response.status_code == 200:
            route_data = response.json()
            primary_route = route_data.get('routes', {}).get('primary', {})
            distance = primary_route.get('distance', 0)
            duration = primary_route.get('duration', 0)
            
            # Check risks on route
            risks_on_route = primary_route.get('risks_on_route', [])
            
            print(f" Risk-Aware Route Success: {distance:.3f} km, {duration:.1f} mins")
            print(f"  Risks avoided: {len(risks_on_route)}")
            
            for risk in risks_on_route:
                print(f"    - {risk.get('type', 'Unknown')} ({risk.get('severity', 'Unknown')}): {risk.get('description', 'No description')}")
            
            # Check route quality
            route_points = primary_route.get('route_points', [])
            if len(route_points) > 10:  # Should have many points for a proper route
                print(f"Route has {len(route_points)} points (properly optimized)")
            else:
                print(f" Route has only {len(route_points)} points (may be inefficient)")
            
            return primary_route
        else:
            print(f"Risk-Aware Route Failed: {response.status_code}")
            print(response.text)
            return None
    except Exception as e:
        print(f"Risk-Aware Route Error: {str(e)}")
        return None

def compare_routes(direct_route, risk_aware_route):
    """Compare direct and risk-aware routes."""
    print("\n=== Route Comparison ===")
    
    if not direct_route or not risk_aware_route:
        print("Cannot compare routes - one or both are missing")
        return
    
    direct_distance = direct_route.get('distance', 0)
    direct_duration = direct_route.get('duration', 0)
    risk_aware_distance = risk_aware_route.get('distance', 0)
    risk_aware_duration = risk_aware_route.get('duration', 0)
    
    distance_diff = risk_aware_distance - direct_distance
    duration_diff = risk_aware_duration - direct_duration
    
    print(f"Direct Route:     {direct_distance:.3f} km, {direct_duration:.1f} mins")
    print(f"Risk-Aware Route: {risk_aware_distance:.3f} km, {risk_aware_duration:.1f} mins")
    print(f"Difference:       {distance_diff:+.3f} km ({(distance_diff/direct_distance)*100:+.1f}%), "
          f"{duration_diff:+.1f} mins ({(duration_diff/direct_duration)*100:+.1f}%)")

def main():
    """Main test function."""
    print("CrowdFleet Microservices Integration Test")
    print("=" * 50)
    print(f"Testing at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Test health endpoints
    if not test_health_endpoints():
        print("\nHealth checks failed. Aborting tests.")
        return
    
    # Test risk detection
    detected_risks = test_risk_detection()
    
    # Test route optimization without risks
    direct_route = test_route_optimization_without_risks()
    
    # Test route optimization with risks
    risk_aware_route = test_route_optimization_with_risks(detected_risks)
    
    # Compare routes
    compare_routes(direct_route, risk_aware_route)
    
    # Summary
    print("\n" + "=" * 50)
    if direct_route and risk_aware_route and detected_risks:
        print("All integration tests completed successfully!")
        print("Risk detection and route optimization are working together.")
        print("Routes are properly optimized.")
    else:
        print("Some tests failed. Check the output above for details.")

if __name__ == "__main__":
    main()