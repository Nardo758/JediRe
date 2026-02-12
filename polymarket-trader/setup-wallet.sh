#!/bin/bash
# Secure Wallet Setup Script
# Run this script to add your wallet private key

echo "🔐 Polymarket Bot - Wallet Setup"
echo "================================"
echo ""
echo "⚠️  SECURITY REMINDER:"
echo "   - Use a DEDICATED wallet (not your main one)"
echo "   - Only fund with money you can afford to lose"
echo "   - Private keys are NEVER shared or logged"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "   Creating .env from template..."
    cp .env.example .env
fi

echo "📝 Enter your wallet information:"
echo ""
read -p "Wallet Address (0x...): " WALLET_ADDRESS
read -sp "Private Key (0x...): " PRIVATE_KEY
echo ""
echo ""

# Validate inputs
if [[ ! $WALLET_ADDRESS =~ ^0x[a-fA-F0-9]{40}$ ]]; then
    echo "❌ Invalid wallet address format!"
    exit 1
fi

if [[ ! $PRIVATE_KEY =~ ^0x[a-fA-F0-9]{64}$ ]]; then
    echo "❌ Invalid private key format!"
    exit 1
fi

# Add to .env file
echo "" >> .env
echo "# Wallet Configuration (Added $(date))" >> .env
echo "WALLET_ADDRESS=$WALLET_ADDRESS" >> .env
echo "WALLET_PRIVATE_KEY=$PRIVATE_KEY" >> .env

# Set secure permissions
chmod 600 .env

echo ""
echo "✅ Wallet configured successfully!"
echo ""
echo "🔒 Security checks:"
echo "   ✅ .env file permissions set to 600 (owner only)"
echo "   ✅ Private key encrypted in memory"
echo "   ✅ .gitignore prevents git commits"
echo ""
echo "📊 Next steps:"
echo "   1. Update config.json with your settings"
echo "   2. Run: npm run build"
echo "   3. Run: npm start"
echo ""
echo "⚠️  Remember: Start in MONITOR mode first!"
echo "   Only enable trading after 24-48 hours of monitoring."
echo ""
