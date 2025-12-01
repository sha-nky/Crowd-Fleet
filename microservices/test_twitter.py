#!/usr/bin/env python3
"""
Test script to verify Twitter API functionality for #crowdfleet hashtag detection
"""

import os
import sys
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_twitter_api():
    """Test Twitter API connection and #crowdfleet hashtag search"""
    try:
        import tweepy
        
        # Get Twitter API credentials from environment variables
        TWITTER_API_KEY = os.getenv('TWITTER_API_KEY')
        TWITTER_API_SECRET = os.getenv('TWITTER_API_SECRET')
        TWITTER_BEARER_TOKEN = os.getenv('TWITTER_BEARER_TOKEN')
        
        print("Twitter API Credentials:")
        if TWITTER_API_KEY:
            print(f"API Key: {TWITTER_API_KEY[:5]}...{TWITTER_API_KEY[-5:]}")
        else:
            print("API Key: None")
        if TWITTER_API_SECRET:
            print(f"API Secret: {TWITTER_API_SECRET[:5]}...{TWITTER_API_SECRET[-5:]}")
        else:
            print("API Secret: None")
        if TWITTER_BEARER_TOKEN:
            print(f"Bearer Token: {TWITTER_BEARER_TOKEN[:10]}...{TWITTER_BEARER_TOKEN[-10:]}")
        else:
            print("Bearer Token: None")
        
        # Check if all credentials are provided
        if not all([TWITTER_API_KEY, TWITTER_API_SECRET, TWITTER_BEARER_TOKEN]):
            print("ERROR: Missing Twitter API credentials!")
            print("Please ensure TWITTER_API_KEY, TWITTER_API_SECRET, and TWITTER_BEARER_TOKEN are set in .env file")
            return False
        
        # Initialize Twitter API client
        print("\nInitializing Twitter API client...")
        client = tweepy.Client(
            bearer_token=TWITTER_BEARER_TOKEN,
            consumer_key=TWITTER_API_KEY,
            consumer_secret=TWITTER_API_SECRET
        )
        print("Twitter API client initialized successfully!")
        
        # Test search for #crowdfleet hashtag
        print("\nSearching for #crowdfleet tweets...")
        query = "#crowdfleet -is:retweet"
        print(f"Query: {query}")
        
        try:
            tweets = client.search_recent_tweets(
                query=query,
                max_results=10,
                tweet_fields=['created_at', 'author_id', 'public_metrics']
            )
            
            tweet_data = getattr(tweets, 'data', None)
            print(f"Found {len(tweet_data) if tweet_data else 0} tweets")
            
            if tweet_data:
                print("\nRecent #crowdfleet tweets:")
                for i, tweet in enumerate(tweet_data[:5]):  # Show first 5 tweets
                    print(f"{i+1}. @{tweet.author_id}: {tweet.text[:100]}{'...' if len(tweet.text) > 100 else ''}")
                    print(f"   Created: {tweet.created_at}")
                    print()
            else:
                print("No #crowdfleet tweets found.")
                print("This could be because:")
                print("1. No recent tweets with #crowdfleet hashtag")
                print("2. Twitter API rate limiting")
                print("3. Issue with the search query")
                
        except Exception as search_error:
            print(f"Error searching for tweets: {search_error}")
            import traceback
            traceback.print_exc()
            return False
            
    except ImportError:
        print("ERROR: tweepy not installed!")
        print("Please install it with: pip install tweepy")
        return False
    except Exception as e:
        print(f"Error initializing Twitter API: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    return True

if __name__ == "__main__":
    print("Testing Twitter API for #crowdfleet hashtag detection...")
    print("=" * 60)
    
    success = test_twitter_api()
    
    if success:
        print("\n" + "=" * 60)
        print("Twitter API test completed successfully!")
    else:
        print("\n" + "=" * 60)
        print("Twitter API test failed!")
        sys.exit(1)