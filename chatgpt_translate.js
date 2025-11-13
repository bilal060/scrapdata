require('dotenv').config();
const axios = require('axios');

/**
 * Groq Translation Function
 * Translates text to English using Groq API
 */
async function translateWithGroq(text, apiKey) {
    if (!text || text.trim().length === 0) {
        return { success: false, error: 'Empty text provided' };
    }

    if (!apiKey) {
        return { success: false, error: 'Groq API key not provided' };
    }

    const apiUrl = 'https://api.groq.com/openai/v1/chat/completions';

    try {
        const response = await axios.post(apiUrl, {
            model: 'llama-3.1-8b-instant',
            messages: [
                {
                    role: 'system',
                    content: `You are a translation assistant. Translate the given text into proper English.
                    Always respond in this exact JSON format:
                    {
                        "originalLanguage": "detected_language",
                        "isEnglish": true/false,
                        "translation": "translated_text_or_original_if_already_english"
                    }`
                },
                {
                    role: 'user',
                    content: `Translate this text to English: "${text}"`
                }
            ],

            temperature: 0.1,
            max_tokens: 2000
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        // Extract the response content
        const content = response.data.choices[0].message.content;
        
        try {
            // Parse the JSON response
            const result = JSON.parse(content);
            
            return {
                success: true,
                translation: result.translation,
            };
        } catch (parseError) {
            // If JSON parsing fails, treat the entire response as translation
            return {
                success: true,
                translation: content,
                originalLanguage: 'unknown',
                isEnglish: false,
                cached: false
            };
        }

    } catch (error) {
        console.error('Groq API Error:', error.response?.data || error.message);
        return {
            success: false,
            error: error.response?.data?.error?.message || error.message
        };
    }
}

// Example usage
async function testTranslation() {
    const apiKey = process.env.GROQ_API_KEY;
    
    const testTexts = [
        'Hola, ¿cómo estás?', // Spanish
        'Bonjour, comment allez-vous?', // French
        'Guten Tag! Wie geht es Ihnen?', // German
        'مرحبا، كيف حالك؟', // Arabic
        '你好，你好吗？', // Chinese
        'こんにちは、お元気ですか？', // Japanese
        '안녕하세요, 어떻게 지내세요?', // Korean
        'Привет, как дела?', // Russian
        'Hello, how are you?', // English,
        'Taend ene yalgadlyg avtomatchilakh argiig uzuulmeer baina uu?', 'Sain uu? Minii neriig Erdene gedeg. Bi odoo Ulaanbaatart amidarch baina. Ajil hiij, suraltsaj, amidralaa saijruulah gej hicheej baina. Mongol hunii setgel, eh ornii hair hezeed delhii deer hamgiin saihan medremj shuu.'
        
    ];

    console.log('🌐 Testing Groq Translation Function');
    console.log('===================================');

    for (const text of testTexts) {
        console.log(`\nOriginal: ${text}`);
        
        const result = await translateWithGroq(text, apiKey);
        
        if (result.success) {
            console.log(`✅ Translation: ${result.translation}`);
            console.log(`   Language: ${result.originalLanguage}`);
            console.log(`   Is English: ${result.isEnglish}`);
        } else {
            console.log(`❌ Error: ${result.error}`);
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
}

// Export the function
module.exports = translateWithGroq;

// Run test if this file is executed directly
if (require.main === module) {
    testTranslation().catch(console.error);
}
