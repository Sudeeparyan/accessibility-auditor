#!/bin/bash

# AccessibilityAI Auditor - Quick Setup Script

echo "=========================================="
echo "AccessibilityAI Auditor - Setup"
echo "=========================================="
echo ""

# Check Node.js
echo "Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ from https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version must be 18 or higher. Current: $(node -v)"
    exit 1
fi

echo "✓ Node.js $(node -v) found"
echo ""

# Install dependencies
echo "Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✓ Dependencies installed"
echo ""

# Create .env file
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example .env
    echo "✓ .env file created"
    echo ""
    echo "⚠️  IMPORTANT: Add your OpenAI API key to .env file:"
    echo "   OPENAI_API_KEY=sk-your-key-here"
    echo ""
else
    echo "✓ .env file already exists"
    echo ""
fi

# Check for OpenAI API key
if grep -q "your_openai_api_key_here" .env 2>/dev/null; then
    echo "⚠️  WARNING: OpenAI API key not configured in .env"
    echo "   LLM analysis will be disabled without a valid API key"
    echo "   Get your key from: https://platform.openai.com/api-keys"
    echo ""
fi

echo "=========================================="
echo "Setup Complete! 🎉"
echo "=========================================="
echo ""
echo "Quick Start:"
echo ""
echo "1. Add OpenAI API key to .env file (optional)"
echo "   OPENAI_API_KEY=sk-your-key-here"
echo ""
echo "2. Start the API server:"
echo "   npm start"
echo ""
echo "3. In another terminal, run tests:"
echo "   npm test"
echo ""
echo "4. Test via curl:"
echo "   curl -X POST http://localhost:3001/api/audit \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"url\": \"https://example.com\"}'"
echo ""
echo "=========================================="
