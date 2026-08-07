#!/bin/bash
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_MSPCONFIGPATH=/network/crypto-config/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=peer0.org1.example.com:7051
export FABRIC_CFG_PATH=/etc/hyperledger/fabric
peer chaincode invoke -o orderer.example.com:7050 -C assets -n asset-management --isInit -c '{"Args":[]}'
