
const VERBX_API_KEY = process.env.VERBX_API_KEY || '';
const VERBX_TTS_ENDPOINT = 'https://api.verbxeco.com/v1/tts';

async function testTTS() {
    const texts = [
        "Hello world.",
        "The application deadline is 31 March 2026.",
        "இத்திட்டத்தின் கீழ் பயன்பெற குடும்பத்தின் அதிகபட்ச ஆண்டு வருமான வரம்பு ரூ. 1,20,000/- (ஒரு லட்சத்து இருபதாயிரம் ரூபாய்) என நிர்ணயிக்கப்பட்டுள்ளது."
    ];
    
    for (const text of texts) {
        console.log(`Testing: ${text}`);
        const response = await fetch(VERBX_TTS_ENDPOINT, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${VERBX_API_KEY}`,
                'x-api-key': VERBX_API_KEY,
            },
            body: JSON.stringify({ text }),
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
}

testTTS().catch(console.error);
