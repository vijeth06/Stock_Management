#!/bin/bash
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_MSPCONFIGPATH=/network/crypto-config/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/msp
export CORE_PEER_ADDRESS=peer0.org1.example.com:7051
export FABRIC_CFG_PATH=/etc/hyperledger/fabric
peer lifecycle chaincode install /chaincode/chaincode.tar.gz
