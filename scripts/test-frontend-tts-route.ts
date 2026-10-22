
const PORT = 3000;
const TTS_ENDPOINT = `http://localhost:${PORT}/api/voice/tts`;

async function testTTSRoute() {
    const testText = "Clario can read complete sentences. The deadline is 31 March 2026.";
    const language = "English";

    console.log(`Sending to backend: "${testText}" (length: ${testText.length})`);
    
    try {
        const response = await fetch(TTS_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: testText, language: language }),
        });
        
        console.log(`Backend Response Status: ${response.status}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log(`Audio URL (preview): ${data.audioUrl?.slice(0, 50)}...`);
            console.log(`Audio Format: ${data.format}, Bytes: ${data.sizeBytes}`);
        } else {
            const err = await response.text();
            console.error(`Error: ${err}`);
        }
    } catch (e) {
        console.error(`Request failed: ${e}`);
    }
}

testTTSRoute().catch(console.error);
