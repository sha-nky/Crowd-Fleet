# CrowdFleet: AI-Driven Delivery Optimization Platform

CrowdFleet is an intelligent, AI-driven delivery optimization platform that combines:

✅ Crowdsourced Micro-Logistics
✅ Dynamic Route Optimization
✅ Real-Time Risk Detection

It aims to maximize delivery efficiency, minimize delivery times, and proactively manage risks like traffic congestion, weather conditions, roadblocks, and natural disasters in real-time.

## Features

### Core Functionality
- **Crowdsourced Micro-Delivery**: Engage nearby individuals for small, quick deliveries
- **Real-Time Route Optimization**: Continuously update routes based on live traffic, weather, and dynamic risk alerts
- **Risk Detection Engine**: Real-time web and social media monitoring to proactively identify disruptions
- **Intelligent Dispatching**: Automatically assign tasks to the nearest available delivery agent based on location, availability, and delivery urgency

### Technical Features
- **Dynamic Route Optimization** using Google Maps, OSRM, and real-time data
- **Risk-Aware Routing** via live news scraping, Twitter API, and disaster alert systems
- **Crowdsourced Delivery Network** to enable fast, flexible last-mile logistics
- **Admin Dashboard** with real-time tracking, delivery analytics, and risk monitoring
- **Web-based Agent Portal** (instead of mobile app) for delivery agents to accept, track, and navigate deliveries

## Technical Architecture

### Frontend
- React.js + TailwindCSS → Admin Dashboard, Customer Portal, and Agent Portal (mobile-friendly web app)

### Backend
- Node.js + Express.js → REST APIs for authentication, task assignment, route handling, and agent management
- Python Microservices → Route optimization, risk detection engine, NER-based location extraction

### Databases
- MongoDB → User data, delivery records, and tracking

### Real-Time & Mapping
- Google Maps API / OSRM → Traffic, navigation, and route optimization
- WebSockets (Socket.IO) → Real-time task updates and notifications

### Risk Monitoring
- Twitter API, NewsAPI, Web Scraping → Real-time risk detection
- GDACS (Global Disaster Alert and Coordination System) → Disaster alerts

## Project Structure

```
CrowdFleet/
├── backend/              # Node.js backend API
│   ├── controllers/      # Request handlers
│   ├── middleware/      # Authentication middleware
│   ├── models/          # MongoDB models
│   ├── routers/         # API routes
│   ├── db/              # Database connection
│   ├── .env             # Environment variables
│   └── index.js         # Entry point
├── frontend/            # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── contexts/    # React contexts
│   │   ├── services/    # API services
│   │   ├── App.jsx      # Main app component
│   │   └── main.jsx     # Entry point
│   └── index.html       # HTML template
├── microservices/       # Python microservices
│   ├── route_optimizer.py  # Route optimization engine
│   ├── risk_detector.py    # Risk detection engine
│   └── requirements.txt    # Python dependencies
├── docker-compose.yml   # Docker configuration
└── README.md            # This file
```

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- Python (v3.9 or higher)
- MongoDB
- Docker (optional, for containerized deployment)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd CrowdFleet
   ```

2. **Backend Setup:**
   ```bash
   cd backend
   npm install
   cp .env.example .env  # Update with your credentials
   ```

3. **Frontend Setup:**
   ```bash
   cd frontend
   npm install
   ```

4. **Microservices Setup:**
   ```bash
   cd microservices
   pip install -r requirements.txt
   ```

### Running the Application

#### Option 1: Manual Start
1. Start MongoDB
2. Start backend:
   ```bash
   cd backend
   npm start
   ```
3. Start frontend:
   ```bash
   cd frontend
   npm run dev
   ```
4. Start microservices:
   ```bash
   cd microservices
   python route_optimizer.py
   python risk_detector.py
   ```

#### Option 2: Docker (Recommended)
```bash
docker-compose up
```

### Environment Variables

Create a `.env` file in the backend directory with the following variables:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/crowdfleet
JWT_SECRET=your_jwt_secret_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
TWITTER_API_KEY=your_twitter_api_key
NEWS_API_KEY=your_news_api_key
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user

### User Management
- `GET /api/profile` - Get user profile
- `PUT /api/profile` - Update user profile

### Delivery Management
- `POST /api/deliveries` - Create a new delivery
- `GET /api/deliveries/customer` - Get customer deliveries
- `GET /api/deliveries/available` - Get available deliveries (agents only)
- `PUT /api/deliveries/:deliveryId/assign` - Assign delivery to agent
- `PUT /api/deliveries/:deliveryId/status` - Update delivery status

### Analytics (Admin Only)
- `GET /api/analytics/dashboard` - Get dashboard statistics
- `GET /api/analytics/deliveries` - Get delivery analytics
- `GET /api/analytics/agents` - Get agent performance metrics

### Risk Management
- `POST /api/risk/alerts` - Create risk alert (admin only)
- `GET /api/risk/alerts` - Get all risk alerts
- `GET /api/risk/nearby` - Get nearby risk alerts
- `GET /api/risk/affecting-deliveries` - Get deliveries affected by risks

### Admin Routes
- `GET /api/admin/users` - Get all users
- `GET /api/admin/deliveries` - Get all deliveries
- `PUT /api/admin/users/:userId/role` - Update user role
- `DELETE /api/admin/users/:userId` - Delete user

## Key Resources Required

- Google Maps API key
- Twitter API access
- NewsAPI subscription
- OpenStreetMap datasets for custom routing

## Public Datasets

- 📦 OSRM / OpenStreetMap Road Networks
- 🌍 Global Disaster Data from GDACS
- 🚦 Traffic and Accident Datasets (Kaggle)
- 🗺 Geo-location Datasets for Route Simulation

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

For questions or support, please open an issue on the GitHub repository.