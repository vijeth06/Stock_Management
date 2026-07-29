# Supply Chain Workflow Flowchart

```plantuml
@startuml SupplyChain_Flowchart
skinparam backgroundColor #FFFFFF
skinparam arrowColor #3B82F6
skinparam defaultFontName DM Sans
skinparam defaultFontSize 14

start

:User Login;
if (Valid credentials?) then (yes)
  :Generate JWT Token;
  :Load Dashboard;
else (no)
  :Show Error;
  stop;
endif

repeat
  :Select Product Action;
  if (Register Product?) then (yes)
    :Fill Registration Form;
    :Submit to Gateway;
    :Call Smart Contract;
    :Store in MongoDB;
    :Show Success;
  elseif (Transfer Ownership?) then (yes)
    :Enter Product ID;
    :Select New Owner;
    :Submit Transfer;
    :Update Blockchain;
    :Update MongoDB;
    :Show Success;
  elseif (Record Shipment?) then (yes)
    :Enter Shipment Details;
    :Generate Hash;
    :Submit Shipment;
    :Update Product Status;
    :Show Success;
  elseif (Record Sensor?) then (yes)
    :Send MQTT Data;
    :Validate Reading;
    :Store in MongoDB;
    :Check Thresholds;
    :Generate Alerts?;
    if (Threshold Breach?) then (yes)
      :Create Alert;
    endif
  elseif (Mark Delivered?) then (yes)
    :Enter Product ID;
    :Submit Delivery;
    :Mark Delivered on Chain;
    :Update Database;
    :Show Success;
  elseif (Verify Product?) then (yes)
    :Enter Product ID;
    :Query Blockchain;
    :Query Database;
    :Compare States;
    if (Match?) then (yes)
      :Show VERIFIED;
    else (no)
      :Show WARNING;
    endif
  else (other)
    :Search Products;
    :Display Results;
  endif
repeat while (More actions?)

stop

@enduml
```

## Workflow Sequence Diagram

```plantuml
@startuml SupplyChain_Sequence
skinparam backgroundColor #FFFFFF
skinparam arrowColor #3B82F6

actor "Manufacturer" as M
actor "Transport Company" as T
actor "Warehouse" as W
actor "Retailer" as R
actor "Consumer" as C

participant "Web UI" as UI
participant "Gateway" as GW
participant "MongoDB" as DB
participant "Ethereum" as ETH
participant "ESP32" as ESP

M -> UI: Access Dashboard
UI -> GW: GET /api/dashboard
GW -> DB: Query Products/Alerts
DB --> GW: Return Data
GW --> UI: Render Dashboard

M -> UI: Register Product
UI -> GW: POST /assets
GW -> ETH: registerProduct()
ETH --> GW: Transaction
GW -> DB: Store Product + TxHash
GW --> UI: Success

T -> UI: Record Shipment
UI -> GW: POST /shipments
GW -> ETH: recordShipment()
ETH --> GW: Transaction
GW -> DB: Store Shipment
GW --> UI: Success

ESP -> GW: MQTT Sensor Data
GW -> DB: Store Reading
GW -> DB: Check Thresholds
alt Threshold Breach
  DB -> GW: Create Alert
  GW -> DB: Store Alert
end

W -> UI: Update Location
UI -> GW: POST /transfer
GW -> ETH: transferOwnership()
ETH --> GW: Transaction
GW -> DB: Update Product
GW --> UI: Success

R -> UI: Mark Delivered
UI -> GW: POST /deliveries
GW -> ETH: markDelivered()
ETH --> GW: Transaction
GW -> DB: Update Status
GW --> UI: Success

C -> UI: Verify Product (QR Scan)
UI -> GW: GET /verification/:id
GW -> ETH: getProduct()
GW -> DB: getProduct()
ETH --> GW: On-chain Data
DB --> GW: Off-chain Data
GW --> UI: Compare & Display
UI -> C: Show Verification Result

@enduml
```

## Process Flow

### 1. Product Registration Flow
```
Manufacturer → Web UI → Gateway → Smart Contract → Blockchain
                     ↓
                 MongoDB (Product + TxHash)
```

### 2. Sensor Data Ingestion Flow
```
ESP32 → MQTT Broker → Gateway → MongoDB
                              ↓
                     Check Thresholds → Alert (if needed)
```

### 3. Ownership Transfer Flow
```
User → Web UI → Gateway → Smart Contract → Blockchain
                     ↓
                 MongoDB (Update + Audit Log)
```

### 4. Verification Flow
```
Consumer → QR Scan → Web UI → Gateway
                            ↓
                     Compare: Blockchain vs MongoDB
                            ↓
                     Show: VERIFIED or WARNING
```

### 5. Alert Generation Flow
```
Sensor Reading → Threshold Check
              ↓
         Alert Conditions Met?
              ↓
         YES → Create Alert → Dashboard Notification
              ↓
         NO → Continue Monitoring
```