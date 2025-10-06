import { RequestUrlResponse, requestUrl } from 'obsidian';
import { AIAssistantSettings } from '../settings';

export interface Message {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ChatCompletionOptions {
    messages: Message[];
    model: string;
    max_tokens: number;
    temperature: number;
}

export class OpenAIService {
    private apiKey: string;
    private settings: AIAssistantSettings;
    
    constructor(settings: AIAssistantSettings) {
        this.settings = settings;
        this.apiKey = settings.openaiApiKey;
    }
    
    public updateSettings(settings: AIAssistantSettings) {
        this.settings = settings;
        this.apiKey = settings.openaiApiKey;
    }

    public async generateCompletion(messages: Message[]): Promise<string> {
        if (!this.apiKey) {
            throw new Error('OpenAI API key is not set. Please configure it in the plugin settings.');
        }

        try {
            const response = await this.makeRequest({
                messages,
                model: this.settings.model,
                max_tokens: this.settings.maxTokens,
                temperature: this.settings.temperature,
            });

            const data = JSON.parse(response.text);
            if (data.error) {
                throw new Error(`OpenAI API Error: ${data.error.message}`);
            }

            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error('Error generating completion:', error);
            throw error;
        }
    }

    private async makeRequest(options: ChatCompletionOptions): Promise<RequestUrlResponse> {
        return await requestUrl({
            url: 'https://api.openai.com/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(options),
        });
    }
}