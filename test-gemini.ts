// test-gemini-latest.ts
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

async function testLatestModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log('Testing Gemini with API key:', apiKey ? '✓ Found' : '✗ Not found');
  
  if (!apiKey) {
    console.error('No API key found');
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Latest model names as of 2026 [citation:3][citation:8]
  const modelsToTry = [
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gemini-2.0-flash',
    'gemini-2.0-pro',
    'gemini-2.0-flash-lite'
  ];

  console.log('\n=== Testing Latest Gemini Models ===\n');

  for (const modelName of modelsToTry) {
    try {
      console.log(`Trying model: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });
      
      const result = await model.generateContent("Say 'Hello, this model works!' in one sentence.");
      const response = await result.response;
      const text = response.text();
      
      console.log(`✅ SUCCESS with model: ${modelName}`);
      console.log(`   Response: ${text.substring(0, 100)}...\n`);
      console.log(`👉 Use this in your .env file: GEMINI_MODEL=${modelName}\n`);
      return modelName;
    } catch (error: any) {
      console.log(`❌ Failed: ${error?.message || String(error)}...\n`);
      // Print detailed error info for debugging
      try {
        if (error?.response) {
          console.error('--- Gemini HTTP error response ---');
          // Some libs use error.response.data
          console.error(JSON.stringify(error.response.data, null, 2));
        }
      } catch (e) {
        // ignore
      }
      if (error?.stack) console.error(error.stack);
      console.error('\n');
    }
  }
  
  console.log('\n❌ All models failed. Check your API key permissions.');
  console.log('Visit: https://aistudio.google.com/app/apikey to verify your key');
}

testLatestModels();