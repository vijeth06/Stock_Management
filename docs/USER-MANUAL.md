# User Manual

## Table of Contents
1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [User Roles](#user-roles)
4. [Dashboard Guide](#dashboard-guide)
5. [Product Management](#product-management)
6. [Logistics Operations](#logistics-operations)
7. [IoT & Sensor Monitoring](#iot--sensor-monitoring)
8. [Governance & Verification](#governance--verification)
9. [Reports & Analytics](#reports--analytics)
10. [Alerts & Notifications](#alerts--notifications)
11. [Troubleshooting](#troubleshooting)

---

## Introduction

ChainTrack is an enterprise-grade supply chain management platform that uses Ethereum blockchain technology for secure, transparent, and immutable product tracking. This manual provides step-by-step instructions for using all features of the system.

---

## Getting Started

### 1. Access the Platform
- Open your web browser
- Navigate to `http://localhost:3000`
- The login page will be displayed

### 2. Login
1. Enter your credentials:
   - **Email**: Your registered email address
   - **Password**: Your account password
2. Click **Sign In**
3. You will be redirected to the Dashboard

### 3. Registration (New Users)
1. Click **Create Account** on the login page
2. Fill in the registration form:
   - Full Name
   - Email Address
   - Password (minimum 8 characters)
   - Role (select your role)
3. Click **Create Account**
4. Check your email for confirmation (if email verification is enabled)

---

## User Roles

### Administrator
- Full system access
- User management
- Device registration
- All reports and analytics

### Manufacturer
- Register new products
- View own products
- Generate reports

### Distributor
- Transfer ownership
- Record shipments
- View logistics data

### Transport Company
- Record shipments
- Submit sensor data
- Update product status

### Warehouse Manager
- Record shipments
- Update product location
- View inventory

### Retailer
- Transfer ownership
- Mark deliveries
- Verify products

### Consumer
- Verify product authenticity
- View product history
- Scan QR codes

### Auditor
- View all reports
- Access audit logs
- Verify compliance

---

## Dashboard Guide

### Overview
The Dashboard provides real-time statistics and recent activity across the supply chain.

### KPI Cards
Located at the top of the dashboard:

| Card | Metric | Description |
|------|--------|-------------|
| Products | Total registered products | Count of all products on blockchain |
| Shipments | Total shipments | Count of all shipment records |
| Sensors | Sensor readings | Count of sensor data entries |
| Alerts | Active alerts | Count of open alerts |
| Devices | Registered devices | Count of IoT devices |
| Reports | Generated reports | Count of created reports |

### Analytics Charts
- **Product Status Distribution**: Pie chart showing product status breakdown
- **Shipment Timeline**: Line chart showing daily shipment counts
- **Alert Distribution**: Bar chart showing alert types and severity
- **Sensor Heatmap**: 24-hour activity heatmap

### Recent Activity
- **Recent Products**: Latest registered products
- **Recent Alerts**: Most recent system alerts
- **Reports**: Recently generated reports
- **Devices**: Recently active devices

---

## Product Management

### Register a Product
1. Navigate to **Products** page
2. Click **Register New Product**
3. Fill in details:
   - Product ID (unique identifier)
   - Product Name
   - Location (starting location)
   - Status (e.g., "Manufactured")
4. Click **Register on Blockchain**
5. Wait for transaction confirmation

### Search Products
1. Go to **Products** page
2. Use search filters:
   - Product ID
   - Status
   - Location
3. Click **Search Registry**
4. Results appear in the table

### View Product Details
1. Enter Product ID in the search field
2. Click **Fetch Product**
3. View complete product information including:
   - Owner
   - Location
   - Status
   - Transaction history

### Product History
1. Enter Product ID
2. Click **Fetch History**
3. View chronological event history:
   - Registration
   - Transfers
   - Shipment updates
   - Sensor readings
   - Delivery confirmation

---

## Logistics Operations

### Transfer Ownership
1. Go to **Logistics** page
2. Enter:
   - Product ID
   - New Owner (name or wallet address)
   - New Location
   - Status
3. Click **Transfer Custody**
4. Transaction is recorded on blockchain

### Record Shipment
1. Go to **Logistics** page
2. Enter:
   - Product ID
   - Status (e.g., "Shipped", "In Transit")
   - Current Location
   - Shipment Hash (or payload for auto-generation)
   - Transport Company
3. Click **Record Shipment**
4. Shipment is recorded on blockchain

### Record Sensor Data
1. Go to **Logistics** page
2. Enter:
   - Product ID
   - Status (e.g., "Temperature Normal")
   - Sensor Hash
   - Device ID
   - Temperature (optional)
   - Humidity (optional)
   - GPS coordinates (optional)
3. Click **Record Sensor Data**
4. Data is stored in MongoDB and hash is on blockchain

### Mark Delivered
1. Go to **Logistics** page
2. Enter Product ID
3. Enter Status (default: "Delivered")
4. Click **Mark as Delivered**
5. Product status is updated on blockchain

---

## IoT & Sensor Monitoring

### MQTT Integration
The system automatically receives sensor data from ESP32 devices via MQTT:
- **Topic**: `iot/supplychain/#`
- **Data Format**: JSON
- **Fields**: productId, deviceId, temperature, humidity, latitude, longitude

### Sensor Thresholds
- **Temperature**: Alert if > 8°C
- **Humidity**: Alert if > 85%
- **Shipment Delay**: Alert if > 48 hours

### View Sensor Readings
1. Navigate to **Product Explorer**
2. Enter Product ID
3. Check timeline for sensor events
4. View temperature, humidity, and location history

---

## Governance & Verification

### Device Registration
1. Go to **Governance** page
2. Enter Device Address (wallet address)
3. Click **Register Device**
4. Device is authorized on smart contract

### Product Verification
1. Go to **Governance** page
2. Enter Product ID
3. Click **Run Verification**
4. System compares:
   - On-chain data (blockchain)
   - Off-chain data (MongoDB)
5. Results show:
   - Product exists
   - Blockchain sync status
   - Owner match
   - Status match
   - Location match

### QR Code Verification
1. Scan QR code with mobile device
2. Or enter Product ID manually
3. System verifies product authenticity
4. Shows verification result

---

## Reports & Analytics

### Generate Report
1. Go to **Reports** page
2. Fill report details:
   - Report ID
   - Title
   - Type (summary, detailed)
   - Summary
3. Click **Generate Report**

### Export Reports
- **CSV Export**: Download raw data
- **PDF Export**: Download formatted report

### View Reports
1. Go to **Reports** page
2. View list of generated reports
3. Click to view details
4. Use filters to find specific reports

---

## Alerts & Notifications

### Viewing Alerts
1. Go to **Alerts** page
2. View list of all alerts
3. Filter by:
   - Severity (low, medium, high, critical)
   - Status (open, acknowledged, resolved)
   - Type (temperature, humidity, shipment-delay)

### Acknowledging Alerts
1. Select alert(s)
2. Click **Acknowledge**
3. Enter your credentials
4. Alert status changes to "acknowledged"

### Alert Types
- **Temperature**: Temperature threshold breach
- **Humidity**: Humidity threshold breach
- **Shipment Delay**: Shipment overdue

---

## Troubleshooting

### Common Issues

**Issue: "Connection failed" error**
- Solution: Check if gateway is running on port 3000
- Solution: Check if Hardhat node is running on port 8545

**Issue: "Product not found"**
- Solution: Verify product ID is correct
- Solution: Check if product exists on blockchain

**Issue: "Authorization token required"**
- Solution: Login first
- Solution: Clear browser storage and login again

**Issue: "Database unavailable"**
- Solution: Check MongoDB connection
- Solution: Verify MONGO_URI in .env

**Issue: "Transaction failed"**
- Solution: Check if product already exists
- Solution: Verify contract is deployed

### Getting Help
1. Check the console output in browser developer tools
2. Review API responses for error messages
3. Contact system administrator for persistent issues

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+L | Focus search |
| Ctrl+R | Refresh dashboard |
| Ctrl+S | Submit form |
| Esc | Close modal |

---

## Mobile Access

The platform is fully responsive and accessible on mobile devices:
- Sidebar collapses to hamburger menu
- Touch-friendly form inputs
- Optimized table views
- Mobile-friendly QR scanner

---

## Logout

1. Click your name/avatar in the header
2. Click **Sign Out**
3. Session is terminated
4. You will be redirected to login page