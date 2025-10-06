// Define plugin interface to avoid circular dependencies
import { Plugin } from 'obsidian';
import { OpenAIService } from './services/openai-service';
import { AIAssistantSettings } from './settings';

export interface AIAssistantPluginInterface extends Plugin {
    settings: AIAssistantSettings;
    openaiService: OpenAIService;
    activeModal: any | null;  // Use 'any' to avoid circular dependency
    loadSettings(): Promise<void>;
    saveSettings(): Promise<void>;
}