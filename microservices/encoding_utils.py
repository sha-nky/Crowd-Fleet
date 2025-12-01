#!/usr/bin/env python3
"""
Utility functions for handling encoding issues in JSON responses
"""

import json
import logging

def sanitize_for_json(data):
    """
    Sanitize data to ensure it can be properly JSON encoded
    
    Args:
        data: Data to sanitize (dict, list, string, etc.)
        
    Returns:
        Sanitized data that can be JSON encoded
    """
    if isinstance(data, dict):
        sanitized = {}
        for key, value in data.items():
            sanitized_key = str(key) if not isinstance(key, str) else key
            sanitized[sanitized_key] = sanitize_for_json(value)
        return sanitized
    elif isinstance(data, list):
        return [sanitize_for_json(item) for item in data]
    elif isinstance(data, str):
        try:
            return data.encode('utf-8', errors='ignore').decode('utf-8')
        except Exception:
            return "[Content not available due to encoding issues]"
    elif isinstance(data, (int, float, bool, type(None))):
        return data
    else:
        try:
            str_data = str(data)
            return str_data.encode('utf-8', errors='ignore').decode('utf-8')
        except Exception:
            return "[Content not available due to encoding issues]"

def validate_json_response(data):
    """
    Validate that data can be JSON encoded and return sanitized data if needed
    
    Args:
        data: Data to validate
        
    Returns:
        tuple: (is_valid, sanitized_data) - is_valid is True if data can be JSON encoded,
               sanitized_data is the original or sanitized data
    """
    try:
        json.dumps(data)
        return True, data
    except Exception as encode_error:
        logging.warning(f"Encoding error in data: {str(encode_error)}")
        try:
            sanitized_data = sanitize_for_json(data)
            json.dumps(sanitized_data)
            return False, sanitized_data
        except Exception as sanitize_error:
            logging.error(f"Failed to sanitize data: {str(sanitize_error)}")
            return False, {"error": "Failed to process data due to encoding issues"}