// Define plugin interface to avoid circular dependencies
import { Plugin } from 'obsidian';
import { OpenAIService } from './services/openai-service';
import { AIAssistantSettings } from './settings';

export interface AIAssistantPluginInterface extends Plugin {
    settings: AIAssistantSettings;
    openaiService: OpenAIService;
    activeModal: unknown | null;
    loadSettings(): Promise<void>;
    saveSettings(): Promise<void>;
}