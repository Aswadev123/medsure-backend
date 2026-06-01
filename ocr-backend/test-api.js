// Simple test script to verify the OCR API is working
const fetch = require('node-fetch');

async function testAPI() {
  try {
    console.log('🧪 Testing OCR API...\n');

    // Test health endpoint
    console.log('1. Testing health endpoint...');
    const healthResponse = await fetch('http://localhost:3000/health');
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData.status);

    // Test API info endpoint
    console.log('\n2. Testing API info endpoint...');
    const infoResponse = await fetch('http://localhost:3000/api/info');
    const infoData = await infoResponse.json();
    console.log('✅ Supported image types:', infoData.supportedTypes.images.length);
    console.log('✅ Supported document types:', infoData.supportedTypes.documents.length);
    console.log('✅ Supported languages:', infoData.supportedLanguages.length);
    console.log('✅ Max file size:', infoData.maxFileSize);

    console.log('\n🎉 API is running successfully!');
    console.log('🌐 Web interface: http://localhost:3000');
    console.log('📡 API endpoint: http://localhost:3000/api/ocr');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testAPI();
