
const PORT = 3000;
const TTS_ENDPOINT = `http://localhost:${PORT}/api/voice/tts`;

async function testMultilingualTTS() {
    const tests = [
        { lang: "English", text: "Clario can read complete sentences. The deadline is 31 March 2026." },
        { lang: "Hindi", text: "नमस्ते। क्लैरियो को पूरा वाक्य पढ़ना चाहिए। अंतिम तिथि 31 मार्च 2026 है।" },
        { lang: "Tamil", text: "வணக்கம். கிளாரியோ முழு வாக்கியங்களையும் படிக்க வேண்டும். கடைசி தேதி 31 மார்ச் 2026." }
    ];
    
    for (const test of tests) {
        console.log(`Testing: ${test.lang} - "${test.text.slice(0, 30)}..."`);
        
        try {
            const response = await fetch(TTS_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: test.text, language: test.lang }),
            });
            
            console.log(`Response Status: ${response.status}`);
            if (response.ok) {
                const data = await response.json();
                console.log(`Audio format: ${data.format}, Bytes: ${data.sizeBytes}`);
            } else {
                const err = await response.text();
                console.error(`Error: ${err}`);
            }
        } catch (e) {
            console.error(`Request failed: ${e}`);
        }
    }
}

testMultilingualTTS().catch(console.error);
