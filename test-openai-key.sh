#!/bin/bash

# Test OpenAI API Key Script
# Usage: ./test-openai-key.sh YOUR_API_KEY

if [ -z "$1" ]; then
  echo "Usage: ./test-openai-key.sh YOUR_API_KEY"
  echo ""
  echo "Example:"
  echo "  ./test-openai-key.sh sk-proj-abc123..."
  exit 1
fi

API_KEY=$1

echo "🔍 Testing OpenAI API Key..."
echo ""

# Test 1: List models
echo "Test 1: Checking API key validity..."
MODELS_RESPONSE=$(curl -s https://api.openai.com/v1/models \
  -H "Authorization: Bearer $API_KEY")

if echo "$MODELS_RESPONSE" | grep -q "error"; then
  echo "❌ API Key is INVALID!"
  echo ""
  echo "Error details:"
  echo "$MODELS_RESPONSE" | jq -r '.error.message' 2>/dev/null || echo "$MODELS_RESPONSE"
  echo ""
  echo "Please:"
  echo "1. Generate a new API key from: https://platform.openai.com/api-keys"
  echo "2. Make sure you're using a key from a project with billing enabled"
  exit 1
fi

echo "✅ API Key is valid!"
echo ""

# Test 2: Check gpt-4o-mini access
echo "Test 2: Checking gpt-4o-mini model access..."
if echo "$MODELS_RESPONSE" | grep -q "gpt-4o-mini"; then
  echo "✅ gpt-4o-mini model is accessible!"
else
  echo "⚠️  Warning: gpt-4o-mini model not found in available models"
  echo ""
  echo "Available GPT-4 models:"
  echo "$MODELS_RESPONSE" | jq -r '.data[] | select(.id | contains("gpt-4")) | .id' 2>/dev/null | head -5
  echo ""
  echo "Note: You may need to upgrade your OpenAI account to access gpt-4o-mini"
fi

echo ""

# Test 3: Test transcription (Whisper)
echo "Test 3: Testing Whisper API access..."
if echo "$MODELS_RESPONSE" | grep -q "whisper"; then
  echo "✅ Whisper models are accessible!"
else
  echo "⚠️  Warning: Whisper models not found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if echo "$MODELS_RESPONSE" | grep -q "error"; then
  echo "Status: ❌ FAILED - API key is invalid"
  exit 1
elif ! echo "$MODELS_RESPONSE" | grep -q "gpt-4o-mini"; then
  echo "Status: ⚠️  WARNING - API key valid but gpt-4o-mini not accessible"
  echo ""
  echo "Action required:"
  echo "1. Check billing: https://platform.openai.com/account/billing"
  echo "2. Upgrade to a paid plan if needed"
  echo "3. Or use a different model (edit parse-reservation function)"
  exit 1
else
  echo "Status: ✅ ALL TESTS PASSED"
  echo ""
  echo "Your API key is ready to use!"
  echo ""
  echo "Next steps:"
  echo "1. Add this key to Supabase:"
  echo "   supabase secrets set OPENAI_API_KEY=\"$API_KEY\" --project-ref wbkkchcgnehauypaysen"
  echo ""
  echo "2. Or via Dashboard:"
  echo "   https://supabase.com/dashboard/project/wbkkchcgnehauypaysen/settings/vault/secrets"
fi

echo ""
