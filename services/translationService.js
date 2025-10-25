const axios = require('axios');

class ChatGPTTranslationService {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
        this.apiUrl = 'https://api.openai.com/v1/chat/completions';
        this.cache = new Map(); // Simple in-memory cache
        this.cacheTimeout = 24 * 60 * 60 * 1000; // 24 hours
        
        if (!this.apiKey) {
            console.warn('⚠️ OPENAI_API_KEY environment variable not set. Translation service will not work.');
        }
    }

    async translateText(text, targetLanguage = 'English') {
        if (!text || text.trim().length === 0) {
            return { success: false, error: 'Empty text provided' };
        }

        if (!this.apiKey) {
            return { success: false, error: 'OpenAI API key not configured' };
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
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: `translate mongolian language into english.
                        Always respond in this exact JSON format:
                        {
                            "originalLanguage": "english",
                            "isEnglish": true,
                            "translation": "translated_text_or_original_if_already_english"
                        }`
                    },
                    {
                        role: 'user',
                        content: text
                    }
                ],
                max_tokens: 1000,
                temperature: 0.3
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
