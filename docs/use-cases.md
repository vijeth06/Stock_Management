# Use Cases

## Product Registration
- A manufacturer registers a product on chain.
- Off-chain product details remain in MongoDB.

## Ownership Transfer
- Authorized actors transfer the product to the next supply-chain party.
- The contract records immutable ownership history.

## IoT Monitoring
- ESP32 devices publish temperature, humidity, GPS, and timestamps through MQTT.
- The backend validates the payload, stores the full reading off-chain, and hashes the record on Ethereum.

## Verification
- Consumers and auditors verify product state and integrity using the product ID or QR code.

## Alerts and Audit
- Threshold violations create alerts.
- Auditors inspect timestamps, transaction hashes, and history entries.
