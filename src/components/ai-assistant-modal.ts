import { App, Editor, FuzzySuggestModal, Modal, Notice, TFile, MarkdownView, setIcon } from 'obsidian';
import { AIAssistantPluginInterface } from '../types';
import { Message } from '../services/openai-service';

export class AIAssistantModal extends Modal {
    private plugin: AIAssistantPluginInterface;
    private editor?: Editor;
    private questionInput: HTMLTextAreaElement;
    private responseContainer: HTMLElement;
    private contextFilesEl: HTMLElement;
    private contextFiles: TFile[] = [];
    private messages: Message[] = [];
    private isProcessing = false;
    
    constructor(app: App, plugin: AIAssistantPluginInterface, editor?: Editor) {
        super(app);
        this.plugin = plugin;
        this.editor = editor;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('ai-assistant-modal');

        // Title
        contentEl.createEl('h2', { text: 'AI assistant' });

        // Context selection section
        const contextSection = contentEl.createDiv({ cls: 'ai-assistant-context-section' });
        
        contextSection.createSpan({ text: 'Context:', cls: 'ai-assistant-label' });
        
        const contextButtonsContainer = contextSection.createDiv({ cls: 'ai-assistant-context-buttons' });
        
        const addContextBtn = contextButtonsContainer.createEl('button', {
            text: 'Add page to context',
            cls: 'ai-assistant-button'
        });
        addContextBtn.addEventListener('click', () => {
            const pageSuggestModal = new PageSuggestModal(this.app, (file) => {
                if (!this.contextFiles.includes(file)) {
                    this.contextFiles.push(file);
                    this.updateContextDisplay();
                }
            });
            pageSuggestModal.open();
        });
        
        const clearContextBtn = contextButtonsContainer.createEl('button', {
            text: 'Clear context',
            cls: 'ai-assistant-button'
        });
        clearContextBtn.addEventListener('click', () => {
            this.contextFiles = [];
            this.updateContextDisplay();
        });
        
        // Context display
        const contextDisplay = contentEl.createDiv({ cls: 'ai-assistant-context-display' });
        contextDisplay.createDiv({ text: 'Selected pages:', cls: 'ai-assistant-context-files-label' });
        this.contextFilesEl = contextDisplay.createDiv({ cls: 'ai-assistant-context-files' });
        
        // Question input section
        const questionSection = contentEl.createDiv({ cls: 'ai-assistant-question-section' });
        
        this.questionInput = questionSection.createEl('textarea', {
            cls: 'ai-assistant-question-input',
            attr: { placeholder: 'Ask a question...' }
        });
        
        const buttonContainer = questionSection.createDiv({ cls: 'ai-assistant-button-container' });
        
        const askButton = buttonContainer.createEl('button', {
            text: 'Ask',
            cls: 'ai-assistant-button ai-assistant-primary-button'
        });
        askButton.addEventListener('click', () => {
            void this.askQuestion();
        });
        
        // Response section
        this.responseContainer = contentEl.createDiv({ cls: 'ai-assistant-response-container' });
        
        // Handle Ctrl+Enter or Cmd+Enter to submit
        this.questionInput.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                void this.askQuestion();
            }
        });
        
        // Initialize context display
        this.updateContextDisplay();
        
        // Focus the input
        this.questionInput.focus();
    }
    
    private async askQuestion(): Promise<void> {
        const question = this.questionInput.value.trim();
        if (!question || this.isProcessing) return;
        
        this.isProcessing = true;
        
        // Show loading indicator
        const loadingEl = this.responseContainer.createDiv({ 
            text: 'Thinking...', 
            cls: 'ai-assistant-loading' 
        });
        
        try {
            // Start with system message
            this.messages = [
                { role: 'system', content: 'You are a helpful AI assistant for Obsidian users. Provide clear, concise answers.' }
            ];
            
            // Add context from selected files if any
            if (this.contextFiles.length > 0) {
                const contextContent = await this.getContextContent();
                this.messages.push({
                    role: 'system',
                    content: `Here is some context information to help you answer: ${contextContent}`
                });
            }
            
            // Add user question
            this.messages.push({ role: 'user', content: question });
            
            // Get response from OpenAI
            const response = await this.plugin.openaiService.generateCompletion(this.messages);
            
            // Remove loading indicator
            loadingEl.remove();
            
            // Display the response
            const responseEl = this.responseContainer.createDiv({ cls: 'ai-assistant-response' });
            
            responseEl.createDiv({ text: question, cls: 'ai-assistant-question' });
            responseEl.createDiv({ text: response, cls: 'ai-assistant-answer' });
            
            // Add action buttons
            const actionButtons = responseEl.createDiv({ cls: 'ai-assistant-action-buttons' });
            
            // Add Copy button
            const copyButton = actionButtons.createEl('button', { cls: 'ai-assistant-button' });
            const copyIconContainer = copyButton.createSpan({ cls: 'ai-assistant-button-icon' });
            setIcon(copyIconContainer, 'copy');
            const copyText = copyButton.createSpan({ text: 'Copy response' });
            
            copyButton.addEventListener('click', () => {
                navigator.clipboard.writeText(response)
                    .then(() => {
                        const originalText = copyText.textContent;
                        copyText.textContent = 'Copied!';
                        setIcon(copyIconContainer, 'check');
                        copyButton.classList.add('ai-assistant-copied');
                        
                        setTimeout(() => {
                            copyText.textContent = originalText;
                            setIcon(copyIconContainer, 'copy');
                            copyButton.classList.remove('ai-assistant-copied');
                        }, 2000);
                        
                        new Notice('Response copied to clipboard');
                    })
                    .catch(err => {
                        console.error('Could not copy text: ', err);
                        new Notice('Failed to copy response');
                    });
            });
            
            // Add Insert button
            const insertButton = actionButtons.createEl('button', { cls: 'ai-assistant-button' });
            const insertIconContainer = insertButton.createSpan({ cls: 'ai-assistant-button-icon' });
            setIcon(insertIconContainer, 'arrow-down-to-line');
            const insertText = insertButton.createSpan({ text: 'Insert to note' });
            
            insertButton.addEventListener('click', () => {
                this.insertResponseToNote(response);
                
                const originalText = insertText.textContent;
                insertText.textContent = 'Inserted!';
                setIcon(insertIconContainer, 'check');
                insertButton.classList.add('ai-assistant-inserted');
                
                setTimeout(() => {
                    insertText.textContent = originalText;
                    setIcon(insertIconContainer, 'arrow-down-to-line');
                    insertButton.classList.remove('ai-assistant-inserted');
                }, 2000);
                
                new Notice('Response inserted into note');
            });
            
            // Clear question input for next question
            this.questionInput.value = '';
            
            // Store response in message history
            this.messages.push({ role: 'assistant', content: response });
            
            // Scroll to the new response
            setTimeout(() => {
                responseEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
            
        } catch (error) {
            loadingEl.remove();
            
            this.responseContainer.createDiv({
                text: `Error: ${error.message}`,
                cls: 'ai-assistant-error'
            });
        } finally {
            this.isProcessing = false;
        }
    }
    
    private async getContextContent(): Promise<string> {
        let contextContent = '';
        
        for (const file of this.contextFiles) {
            if (file instanceof TFile) {
                const content = await this.app.vault.read(file);
                contextContent += `# ${file.basename}\n${content}\n\n`;
            }
        }
        
        return contextContent;
    }
    
    private insertResponseToNote(response: string): void {
        if (this.editor) {
            const cursor = this.editor.getCursor();
            this.editor.replaceRange(response, cursor);
        } else {
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView) {
                const editor = activeView.editor;
                const cursor = editor.getCursor();
                editor.replaceRange(response, cursor);
            } else {
                new Notice('No active editor to insert content into');
            }
        }
    }
    
    private updateContextDisplay(): void {
        if (!this.contextFilesEl) return;
        
        this.contextFilesEl.empty();
        
        if (this.contextFiles.length === 0) {
            this.contextFilesEl.createDiv({ text: 'No pages selected' });
        } else {
            for (const file of this.contextFiles) {
                const fileEl = this.contextFilesEl.createDiv({ 
                    text: file.basename, 
                    cls: 'ai-assistant-context-file' 
                });
                
                const removeButton = fileEl.createSpan({ 
                    text: '×', 
                    cls: 'ai-assistant-remove-context' 
                });
                
                removeButton.addEventListener('click', () => {
                    this.contextFiles = this.contextFiles.filter(f => f !== file);
                    this.updateContextDisplay();
                });
            }
        }
    }
    
    onClose(): void {
        // Clear the plugin's reference to this modal
        if (this.plugin.activeModal === this) {
            this.plugin.activeModal = null;
        }
    }
}

class PageSuggestModal extends FuzzySuggestModal<TFile> {
    private callback: (file: TFile) => void;
    
    constructor(app: App, callback: (file: TFile) => void) {
        super(app);
        this.callback = callback;
    }
    
    getItems(): TFile[] {
        return this.app.vault.getMarkdownFiles();
    }
    
    getItemText(file: TFile): string {
        return file.basename;
    }
    
    onChooseItem(file: TFile, evt: MouseEvent | KeyboardEvent): void {
        this.callback(file);
    }
}
