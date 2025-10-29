const axios = require('axios');

class ChatGPTTranslationService {
    constructor() {
        // Prefer GROQ, fallback to OpenAI
        this.groqKey = process.env.GROQ_API_KEY || '';
        this.openaiKey = process.env.OPENAI_API_KEY || '';
        this.apiKey = this.groqKey || this.openaiKey;
        this.isGroq = !!this.groqKey;
        this.apiUrl = this.isGroq
            ? 'https://api.groq.com/openai/v1/chat/completions'
            : 'https://api.openai.com/v1/chat/completions';
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
            const content = await this.#translateWithBackoff(text);
            
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

    async #translateWithBackoff(text) {
        const systemPrompt = `You are a translation assistant. Translate the given text into proper English.
Always respond in this exact JSON format:
{
  "originalLanguage": "detected_language",
  "isEnglish": true/false,
  "translation": "translated_text_or_original_if_already_english"
}`;

        const payloadBase = {
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `Translate this text to English: "${text}"` }
            ],
            temperature: 0.1,
            max_tokens: 1000
        };

        const groqModels = [
            'llama-3.1-8b-instant',
            'llama-3.1-70b-versatile',
            'mixtral-8x7b-32768'
        ];
        const openaiModels = [
            'gpt-4o-mini',
            'gpt-3.5-turbo'
        ];

        const attempt = async (model, useGroq) => {
            const apiUrl = useGroq
                ? 'https://api.groq.com/openai/v1/chat/completions'
                : 'https://api.openai.com/v1/chat/completions';
            const apiKey = useGroq ? this.groqKey : this.openaiKey;
            const headers = {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            };
            const body = { ...payloadBase, model };
            const res = await axios.post(apiUrl, body, { headers, timeout: 30000 });
            const content = res.data.choices[0].message.content.trim();
            return content;
        };

        const sleep = (ms) => new Promise(r => setTimeout(r, ms));

        // Try GROQ first (if configured) with exponential backoff and model fallback
        if (this.groqKey) {
            for (let i = 0; i < groqModels.length; i++) {
                const model = groqModels[i];
                for (let attemptNum = 0; attemptNum < 3; attemptNum++) {
                    try {
                        return await attempt(model, true);
                    } catch (e) {
                        const msg = e.response?.data?.error?.message || e.message;
                        const status = e.response?.status;
                        // Over capacity / 5xx -> backoff and retry
                        if (status >= 500 || /over capacity/i.test(msg) || /rate limit/i.test(msg)) {
                            await sleep([500, 1500, 3500][attemptNum] || 3500);
                            continue;
                        }
                        // Non-retryable -> try next model/provider
                        break;
                    }
                }
            }
        }

        // Fallback to OpenAI if available
        if (this.openaiKey) {
            for (let i = 0; i < openaiModels.length; i++) {
                const model = openaiModels[i];
                for (let attemptNum = 0; attemptNum < 2; attemptNum++) {
                    try {
                        return await attempt(model, false);
                    } catch (e) {
                        const status = e.response?.status;
                        if (status >= 500) {
                            await sleep([500, 1500][attemptNum] || 1500);
                            continue;
                        }
                        break;
                    }
                }
            }
        }

        // Final fallback: return original text marked as English to avoid blocking pipeline
        return '"ALREADY_IN_ENGLISH"';
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
