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
		
		// Clean up any existing modal elements from previous sessions
		this.cleanupExistingModals();
		
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
		
		// Monitor keydown events to detect '/ai' + Enter
		this.registerDomEvent(document, 'keydown', (event: KeyboardEvent) => {
			if (event.key === 'Enter') {
				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (activeView && activeView.editor) {
					// Check for "/ai" command with the event context
					if (CommandDetector.checkForAICommand(activeView.editor, { event })) {
						// Add a small delay to allow the editor to update
						setTimeout(() => {
							// Remove the "/ai" command
							CommandDetector.removeAICommand(activeView.editor);
							
							// Open the AI Assistant
							this.openAIAssistant(activeView.editor);
						}, 10);
					}
				}
			}
		});
		
		// Also listen for editor changes to catch any other ways the command might be triggered
		this.registerEvent(
			this.app.workspace.on('editor-change', (editor: Editor) => {
				// Check for "/ai" command without event context (post-enter state)
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
		// If there's already an active modal, focus it instead of creating a new one
		if (this.activeModal) {
			// Try to focus the existing modal
			try {
				const modalEl = document.querySelector('.modal.ai-assistant-modal');
				if (modalEl) {
					// Focus the modal
					(modalEl as HTMLElement).focus();
					return;
				}
			} catch (e) {
				console.warn("Error focusing modal:", e);
			}
			
			// If we couldn't focus the modal, close it and create a new one
			try {
				this.activeModal.close();
			} catch (e) {
				console.warn("Error closing modal:", e);
			}
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
	
	// Clean up any orphaned modal containers from previous sessions
	private cleanupExistingModals() {
		// Remove any AI assistant modal containers
		document.querySelectorAll('.modal-container').forEach(container => {
			const aiModal = container.querySelector('.ai-assistant-modal');
			if (aiModal) {
				container.remove();
			}
		});
		
		// Also check for any black background overlays that might be lingering
		document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
			// Only remove backdrops that don't have an associated modal
			const modalContainer = document.querySelector('.modal-container');
			if (!modalContainer) {
				backdrop.remove();
			}
		});
	}

	onunload() {
		// Close any open modals
		if (this.activeModal) {
			try {
				this.activeModal.close();
			} catch (e) {
				console.warn("Error closing modal:", e);
			}
			this.activeModal = null;
		}
		
		// Final cleanup of any remaining modal elements
		this.register(() => {
			// Remove any lingering modal containers
			document.querySelectorAll('.modal-container').forEach(container => {
				const aiModal = container.querySelector('.ai-assistant-modal');
				if (aiModal) {
					container.remove();
				}
			});
			
			// Remove any lingering backdrop elements
			document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
				backdrop.remove();
			});
		});
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