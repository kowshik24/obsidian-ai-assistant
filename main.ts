import { Editor, MarkdownView, Plugin } from 'obsidian';
import { AIAssistantSettings, AIAssistantSettingTab, DEFAULT_SETTINGS } from './src/settings';
import { AIAssistantModal } from './src/components/ai-assistant-modal';
import { OpenAIService } from './src/services/openai-service';
import { CommandDetector } from './src/utils/command-detector';

export default class AIAssistantPlugin extends Plugin {
	settings: AIAssistantSettings;
	openaiService: OpenAIService;
	activeModal: AIAssistantModal | null = null;

	async onload() {
		// Load settings
		await this.loadSettings();
		
		// Initialize OpenAI service
		this.openaiService = new OpenAIService(this.settings);
		
		// Add ribbon icon
		this.addRibbonIcon('message-square', 'AI assistant', () => {
			this.openAIAssistant();
		});
		
		// Add command to open AI Assistant
		this.addCommand({
			id: 'open-ai-assistant',
			name: 'Open AI assistant',
			callback: () => {
				this.openAIAssistant();
			}
		});
		
		// Add command to insert AI response
		this.addCommand({
			id: 'insert-ai-response',
			name: 'Insert AI response at cursor',
			editorCallback: (editor: Editor) => {
				this.openAIAssistant(editor);
			}
		});
		
		// Add settings tab
		this.addSettingTab(new AIAssistantSettingTab(this.app, this));
		
		// Listen for editor changes to detect '/ai' command
		this.registerEvent(
			this.app.workspace.on('editor-change', (editor: Editor) => {
				// Check for "/ai" command (after user types /ai and presses Enter)
				if (CommandDetector.checkForAICommand(editor)) {
					// Remove the "/ai" command
					void CommandDetector.removeAICommand(editor);
					
					// Open the AI Assistant
					this.openAIAssistant(editor);
				}
			})
		);
	}
	
	// Open the AI Assistant modal
	private openAIAssistant(editor?: Editor) {
		// If there's already an active modal, close it first
		if (this.activeModal) {
			this.activeModal.close();
			this.activeModal = null;
		}
		
		// Get the active editor if not provided
		if (!editor) {
			const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView) {
				editor = activeView.editor;
			}
		}
		
		// Create and open a new modal
		this.activeModal = new AIAssistantModal(
			this.app, 
			this, 
			editor || undefined
		);
		this.activeModal.open();
	}
	
	onunload() {
		// Close any open modals
		if (this.activeModal) {
			this.activeModal.close();
			this.activeModal = null;
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		
		// If settings changed, update the OpenAI service
		if (this.openaiService) {
			this.openaiService.updateSettings(this.settings);
		}
	}
}