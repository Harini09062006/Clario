
const VERBX_API_KEY = process.env.VERBX_API_KEY || '';
const VERBX_TTS_ENDPOINT = 'https://api.verbxeco.com/v1/tts';

async function testTTS() {
    const text = "Clario can read complete sentences. The deadline is 31 March 2026.";
    
    console.log(`Testing: ${text}`);
    console.log(`Length: ${text.length}`);
    const response = await fetch(VERBX_TTS_ENDPOINT, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${VERBX_API_KEY}`,
            'x-api-key': VERBX_API_KEY,
        },
        body: JSON.stringify({ text: text.replace(/[\r\n]+/g, ' ') }),
    });
    
    console.log(`Status: ${response.status}`);
    if (response.ok) {
        const buffer = await response.arrayBuffer();
        console.log(`Received ${buffer.byteLength} bytes.`);
    } else {
        const err = await response.text();
        console.error(`Error: ${err}`);
    }
}

testTTS().catch(console.error);
