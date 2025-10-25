const axios = require('axios');

/**
 * Translate text using Groq API
 * @param {string} text - The text to translate
 * @param {string} apiKey - The Groq API key
 * @returns {Promise<Object>} Translation result
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
            max_tokens: 100
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const content = response.data.choices[0].message.content;

        try {
            const result = JSON.parse(content);

            return {
                success: true,
                translation: result.translation,
                originalLanguage: result.originalLanguage,
                isEnglish: result.isEnglish,
                cached: false
            };
        } catch (parseError) {
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

/**
 * Translate notification text to English
 * @param {string} text - The text to translate
 * @returns {Promise<Object>} Translation result
 */
async function translateNotificationText(text) {
    const apiKey = process.env.GROQ_API_KEY;
    return await translateWithGroq(text, apiKey);
}

/**
 * Translate text input to English
 * @param {string} text - The text to translate
 * @returns {Promise<Object>} Translation result
 */
async function translateTextInput(text) {
    const apiKey = process.env.GROQ_API_KEY;
    return await translateWithGroq(text, apiKey);
}

module.exports = {
    translateWithGroq,
    translateNotificationText,
    translateTextInput
};