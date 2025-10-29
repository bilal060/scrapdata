const axios = require('axios');

class ChatGPTTranslationService {
    constructor() {
        // First try GROQ_API_KEY, then fallback to OPENAI_API_KEY
        this.apiKey = process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY;
        this.apiUrl = 'https://api.groq.com/openai/v1/chat/completions'; // Groq API endpoint
        this.cache = new Map(); // Simple in-memory cache
        this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
        
        if (!this.apiKey) {
            console.warn('⚠️ GROQ_API_KEY or OPENAI_API_KEY environment variable not set. Translation service will not work.');
        } else {
            console.log('✅ Translation service configured with API key');
        }
    }

    async translateText(text, targetLanguage = 'English') {
        if (!text || text.trim().length === 0) {
            return { success: false, error: 'Empty text provided' };
        }

        if (!this.apiKey) {
            console.warn('⚠️ API key not configured. Returning original text as English.');
            // Return a success response with the original text marked as English
            return {
                success: true,
                translation: text,
                originalLanguage: 'Unknown',
                isEnglish: true,
                cached: false,
                skipped: true
            };
        }

        // Check cache first
        const cacheKey = `${text}_${targetLanguage}`;
        const cached = this.cache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
            return {
                success: true,
                translation: cached.translation,
                originalLanguage: cached.originalLanguage,
                isEnglish: cached.isEnglish,
                cached: true
            };
        }

        try {
            const response = await axios.post(this.apiUrl, {
                model: 'llama-3.1-8b-instant', // Groq model
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
                max_tokens: 1000
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });
            console.log(response.data);
            const content = response.data.choices[0].message.content.trim();
            
            // Parse the JSON response
            let result;
            try {
                result = JSON.parse(content);
            } catch (parseError) {
                // If JSON parsing fails, treat as plain text translation
                result = {
                    originalLanguage: 'Unknown',
                    isEnglish: false,
                    translation: content
                };
            }

            // Handle special case for already English text
            if (content === 'ALREADY_IN_ENGLISH') {
                result = {
                    originalLanguage: 'English',
                    isEnglish: true,
                    translation: text
                };
            }

            // Cache the result
            this.cache.set(cacheKey, {
                translation: result.translation,
                originalLanguage: result.originalLanguage,
                isEnglish: result.isEnglish,
                timestamp: Date.now()
            });

            return {
                success: true,
                translation: result.translation,
                originalLanguage: result.originalLanguage,
                isEnglish: result.isEnglish,
                cached: false
            };

        } catch (error) {
            console.error('Translation API error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.error?.message || error.message || 'Translation failed'
            };
        }
    }

    async translateNotification(notification) {
        const textToTranslate = notification.text || notification.completeMessage || '';
        return await this.translateText(textToTranslate);
    }

    async translateTextInput(textInput) {
        const textToTranslate = textInput.keyboardInput || textInput.text || '';
        return await this.translateText(textToTranslate);
    }

    // Clear cache (useful for testing or memory management)
    clearCache() {
        this.cache.clear();
    }

    // Get cache statistics
    getCacheStats() {
        return {
            size: this.cache.size,
            maxAge: this.cacheTimeout,
            entries: Array.from(this.cache.keys()).map(key => ({
                key: key.substring(0, 50) + '...',
                timestamp: this.cache.get(key).timestamp
            }))
        };
    }
}

module.exports = new ChatGPTTranslationService();
