import { App, Editor, EditorPosition, MarkdownView, Notice, Plugin, PluginSettingTab } from 'obsidian';
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
		
		// Load styles
		this.loadStyles();
		
		// Clean up any existing modal elements from previous sessions
		this.cleanupExistingModals();
		
		// Initialize OpenAI service
		this.openaiService = new OpenAIService(this.settings);
		
		// Add ribbon icon
		this.addRibbonIcon('message-square', 'AI Assistant', () => {
			this.openAIAssistant();
		});
		
		// Add command to open AI Assistant
		this.addCommand({
			id: 'open-ai-assistant',
			name: 'Open AI Assistant',
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
					CommandDetector.removeAICommand(editor);
					
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
				console.log("Error focusing modal:", e);
			}
			
			// If we couldn't focus the modal, close it and create a new one
			try {
				this.activeModal.close();
			} catch (e) {
				console.log("Error closing modal:", e);
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
	
	// Load the plugin styles
	private loadStyles() {
		const styleEl = document.createElement('style');
		styleEl.id = 'ai-assistant-styles';
		styleEl.textContent = `
			/* Modal styling */
			.ai-assistant-modal .modal-content {
				max-width: 800px;
				min-width: 500px;
				height: auto;
				padding: 0;
				overflow: hidden;
				display: flex;
				flex-direction: column;
			}
			
			.ai-assistant-draggable {
				position: fixed !important;
				border-radius: 8px;
				box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
				transition: none !important;
				overflow: hidden;
			}
			
			.ai-assistant-dragging {
				cursor: move;
			}
			
			/* Header styling */
			.ai-assistant-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 12px 16px;
				background-color: var(--background-secondary);
				border-bottom: 1px solid var(--background-modifier-border);
				cursor: move;
			}
			
			.ai-assistant-header h3 {
				margin: 0;
				font-size: 16px;
			}
			
			.ai-assistant-close-button {
				cursor: pointer;
				font-size: 24px;
				line-height: 1;
				padding: 0 4px;
				color: var(--text-muted);
			}
			
			/* Context section */
			.ai-assistant-context-section {
				padding: 8px 16px;
				border-bottom: 1px solid var(--background-modifier-border);
				background-color: var(--background-primary);
			}
			
			.ai-assistant-label {
				font-weight: 500;
				margin-bottom: 8px;
			}
			
			.ai-assistant-context-buttons {
				display: flex;
				gap: 8px;
			}
			
			/* Container styling */
			.ai-assistant-container {
				display: flex;
				flex-direction: column;
				height: 100%;
				padding: 16px;
				overflow-y: auto;
				max-height: 70vh;
				background-color: var(--background-primary);
			}
			
			/* Context display */
			.ai-assistant-context-display {
				margin-bottom: 16px;
			}
			
			.ai-assistant-context-files-label {
				font-size: 12px;
				font-weight: 500;
				color: var(--text-muted);
				margin-bottom: 6px;
			}
			
			.ai-assistant-context-files {
				display: flex;
				flex-wrap: wrap;
				gap: 6px;
				margin-bottom: 8px;
			}
			
			.ai-assistant-context-file {
				background-color: var(--background-secondary);
				border-radius: 4px;
				padding: 4px 8px;
				font-size: 12px;
				display: flex;
				align-items: center;
			}
			
			.ai-assistant-remove-context {
				cursor: pointer;
				margin-left: 6px;
				color: var(--text-muted);
			}
			
			/* Question input section */
			.ai-assistant-question-section {
				display: flex;
				flex-direction: column;
				margin-bottom: 16px;
			}
			
			.ai-assistant-question-input {
				width: 100%;
				min-height: 100px;
				padding: 12px;
				border-radius: 4px;
				border: 1px solid var(--background-modifier-border);
				background-color: var(--background-primary);
				font-family: inherit;
				font-size: 14px;
				resize: vertical;
				margin-bottom: 8px;
			}
			
			.ai-assistant-button-container {
				display: flex;
				justify-content: flex-end;
			}
			
			/* Response container */
			.ai-assistant-response-container {
				display: flex;
				flex-direction: column;
				gap: 16px;
			}
			
			/* Button styling */
			.ai-assistant-button {
				padding: 8px 12px;
				border-radius: 4px;
				background-color: var(--background-secondary);
				border: 1px solid var(--background-modifier-border);
				color: var(--text-normal);
				font-size: 14px;
				cursor: pointer;
				display: flex;
				align-items: center;
				justify-content: center;
			}
			
			.ai-assistant-primary-button {
				background-color: var(--interactive-accent);
				color: var(--text-on-accent);
			}
			
			.ai-assistant-button-icon {
				margin-right: 6px;
				display: flex;
				align-items: center;
			}
			
			/* Response styling */
			.ai-assistant-response {
				background-color: var(--background-secondary);
				border-radius: 8px;
				padding: 16px;
				display: flex;
				flex-direction: column;
				gap: 12px;
			}
			
			.ai-assistant-question {
				font-weight: 600;
				color: var(--text-normal);
			}
			
			.ai-assistant-answer {
				line-height: 1.5;
				white-space: pre-wrap;
			}
			
			.ai-assistant-action-buttons {
				display: flex;
				gap: 8px;
				margin-top: 8px;
			}
			
			.ai-assistant-copy-button,
			.ai-assistant-insert-button {
				font-size: 12px;
				padding: 4px 8px;
			}
			
			.ai-assistant-copied,
			.ai-assistant-inserted {
				background-color: var(--text-accent);
				color: var(--text-on-accent);
			}
			
			/* Loading state */
			.ai-assistant-loading {
				padding: 12px;
				text-align: center;
				color: var(--text-muted);
				font-style: italic;
			}
			
			/* Error state */
			.ai-assistant-error {
				padding: 12px;
				color: var(--text-error);
				background-color: var(--background-modifier-error);
				border-radius: 4px;
			}
		`;
		
		document.head.appendChild(styleEl);
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
		// Clean up styles
		const styleEl = document.getElementById('ai-assistant-styles');
		if (styleEl) {
			styleEl.remove();
		}
		
		// Close any open modals
		if (this.activeModal) {
			try {
				this.activeModal.close();
			} catch (e) {
				console.log("Error closing modal:", e);
			}
			this.activeModal = null;
		}
		
		// Final cleanup of any remaining modal elements
		setTimeout(() => {
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
		}, 100);
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