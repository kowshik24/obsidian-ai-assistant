import { App, Editor, FuzzySuggestModal, Modal, Notice, TFile, MarkdownView, setIcon, Scope } from 'obsidian';
import { AIAssistantPluginInterface } from '../types';
import { Message } from '../services/openai-service';

export class AIAssistantModal extends Modal {
    private plugin: AIAssistantPluginInterface;
    private editor?: Editor;
    public containerEl: HTMLElement;
    private questionInput: HTMLTextAreaElement;
    private responseContainer: HTMLElement;
    private headerEl: HTMLElement;
    private contextFilesEl: HTMLElement;
    private contextFiles: TFile[] = [];
    private messages: Message[] = [];
    private isProcessing = false;
    
    constructor(app: App, plugin: AIAssistantPluginInterface, editor?: Editor) {
        super(app);
        this.plugin = plugin;
        this.editor = editor;
        
        // Register ESC key to close modal
        this.scope = new Scope();
        this.scope.register([], 'Escape', () => {
            this.close();
            return false;
        });
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('ai-assistant-modal');
        
        // Apply styles to the modal parent container
        const modalEl = contentEl.closest('.modal') as HTMLElement;
        if (modalEl) {
            modalEl.classList.add('ai-assistant-draggable');
            
            // Center the modal if it hasn't been positioned before
            if (!modalEl.hasAttribute('data-has-been-moved')) {
                modalEl.classList.add('ai-assistant-centered');
            } else {
                modalEl.classList.add('ai-assistant-positioned');
            }
        }

        // Header with title and close button
        this.headerEl = document.createElement('div');
        this.headerEl.className = 'ai-assistant-header';
        contentEl.appendChild(this.headerEl);
        
		const titleEl = document.createElement('h3');
		titleEl.textContent = 'AI assistant';
		this.headerEl.appendChild(titleEl);        // Add close button
        const closeButton = document.createElement('div');
        closeButton.className = 'ai-assistant-close-button';
        closeButton.textContent = '×';
        closeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.close();
        });
        this.headerEl.appendChild(closeButton);

        // Context selection section
        const contextSection = document.createElement('div');
        contextSection.className = 'ai-assistant-context-section';
        contentEl.appendChild(contextSection);
        
        const contextLabel = document.createElement('div');
        contextLabel.className = 'ai-assistant-label';
        contextLabel.textContent = 'Context:';
        contextSection.appendChild(contextLabel);
        
        const contextButtonsContainer = document.createElement('div');
        contextButtonsContainer.className = 'ai-assistant-context-buttons';
        contextSection.appendChild(contextButtonsContainer);
        
		const addContextBtn = document.createElement('button');
		addContextBtn.className = 'ai-assistant-button';
		addContextBtn.textContent = 'Add page to context';
		contextButtonsContainer.appendChild(addContextBtn);        addContextBtn.addEventListener('click', () => {
            // Create a new PageSuggestModal instance
            const pageSuggestModal = new PageSuggestModal(this.app, (file) => {
                // This callback is executed when a file is selected
                if (!this.contextFiles.includes(file)) {
                    this.contextFiles.push(file);
                    this.updateContextDisplay();
                }
            });
            pageSuggestModal.open();
        });
        
        const clearContextBtn = document.createElement('button');
        clearContextBtn.className = 'ai-assistant-button';
        clearContextBtn.textContent = 'Clear Context';
        contextButtonsContainer.appendChild(clearContextBtn);
        
        clearContextBtn.addEventListener('click', () => {
            this.contextFiles = [];
            this.updateContextDisplay();
        });
        
        // Main container
        this.containerEl = document.createElement('div');
        this.containerEl.className = 'ai-assistant-container';
        contentEl.appendChild(this.containerEl);
        
        // Context display
        const contextDisplay = document.createElement('div');
        contextDisplay.className = 'ai-assistant-context-display';
        this.containerEl.appendChild(contextDisplay);
        
        const filesLabel = document.createElement('div');
        filesLabel.className = 'ai-assistant-context-files-label';
        filesLabel.textContent = 'Selected pages:';
        contextDisplay.appendChild(filesLabel);
        
        this.contextFilesEl = document.createElement('div');
        this.contextFilesEl.className = 'ai-assistant-context-files';
        contextDisplay.appendChild(this.contextFilesEl);
        
        // Question input section
        const questionSection = document.createElement('div');
        questionSection.className = 'ai-assistant-question-section';
        this.containerEl.appendChild(questionSection);
        
        this.questionInput = document.createElement('textarea');
        this.questionInput.className = 'ai-assistant-question-input';
        this.questionInput.placeholder = 'Ask a question...';
        questionSection.appendChild(this.questionInput);
        
        this.questionInput.focus();
        
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'ai-assistant-button-container';
        questionSection.appendChild(buttonContainer);
        
        const askButton = document.createElement('button');
        askButton.className = 'ai-assistant-button ai-assistant-primary-button';
        askButton.textContent = 'Ask';
        buttonContainer.appendChild(askButton);
        
        askButton.addEventListener('click', async () => {
            await this.askQuestion();
        });
        
        // Response section
        this.responseContainer = document.createElement('div');
        this.responseContainer.className = 'ai-assistant-response-container';
        this.containerEl.appendChild(this.responseContainer);
        
        // Handle Ctrl+Enter or Cmd+Enter to submit
        this.questionInput.addEventListener('keydown', async (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                await this.askQuestion();
            }
        });
        
        // Make the modal draggable
        this.makeDraggable();
        
        // Initialize context display
        this.updateContextDisplay();
    }
    
    private async askQuestion(): Promise<void> {
        const question = this.questionInput.value.trim();
        if (!question || this.isProcessing) return;
        
        this.isProcessing = true;
        
        // Show loading indicator
        const loadingEl = document.createElement('div');
        loadingEl.className = 'ai-assistant-loading';
        loadingEl.textContent = 'Thinking...';
        this.responseContainer.appendChild(loadingEl);
        
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
            const responseEl = document.createElement('div');
            responseEl.className = 'ai-assistant-response';
            this.responseContainer.appendChild(responseEl);
            
            const questionEl = document.createElement('div');
            questionEl.className = 'ai-assistant-question';
            questionEl.textContent = question;
            responseEl.appendChild(questionEl);
            
            const answerEl = document.createElement('div');
            answerEl.className = 'ai-assistant-answer';
            answerEl.textContent = response;
            responseEl.appendChild(answerEl);
            
            // Add action buttons
            const actionButtons = document.createElement('div');
            actionButtons.className = 'ai-assistant-action-buttons';
            responseEl.appendChild(actionButtons);
            
            // Add Copy button
            const copyButton = document.createElement('button');
            copyButton.className = 'ai-assistant-button ai-assistant-copy-button';
            
            // Create copy icon container
            const copyIconContainer = document.createElement('span');
            copyIconContainer.className = 'ai-assistant-button-icon';
            copyButton.appendChild(copyIconContainer);
            
            // Set copy icon
            setIcon(copyIconContainer, 'copy');
            
			// Add text
			const copyText = document.createElement('span');
			copyText.textContent = 'Copy response';
			copyButton.appendChild(copyText);            actionButtons.appendChild(copyButton);
            
            copyButton.addEventListener('click', () => {
                navigator.clipboard.writeText(response)
                    .then(() => {
                        // Visual feedback
                        const originalText = copyText.textContent;
                        copyText.textContent = 'Copied!';
                        setIcon(copyIconContainer, 'check');
                        copyButton.classList.add('ai-assistant-copied');
                        
                        // Reset after 2 seconds
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
            const insertButton = document.createElement('button');
            insertButton.className = 'ai-assistant-button ai-assistant-insert-button';
            
            // Create insert icon container
            const insertIconContainer = document.createElement('span');
            insertIconContainer.className = 'ai-assistant-button-icon';
            insertButton.appendChild(insertIconContainer);
            
            // Set insert icon
            setIcon(insertIconContainer, 'arrow-down-to-line');
            
			// Add text
			const insertText = document.createElement('span');
			insertText.textContent = 'Insert to note';
			insertButton.appendChild(insertText);            actionButtons.appendChild(insertButton);
            
            insertButton.addEventListener('click', () => {
                this.insertResponseToNote(response);
                
                // Visual feedback
                const originalText = insertText.textContent;
                insertText.textContent = 'Inserted!';
                setIcon(insertIconContainer, 'check');
                insertButton.classList.add('ai-assistant-inserted');
                
                // Reset after 2 seconds
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
            
            // Scroll to the new response to ensure buttons are visible
            setTimeout(() => {
                responseEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
            
        } catch (error) {
            // Remove loading indicator
            loadingEl.remove();
            
            // Show error
            const errorEl = document.createElement('div');
            errorEl.className = 'ai-assistant-error';
            errorEl.textContent = `Error: ${error.message}`;
            this.responseContainer.appendChild(errorEl);
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
        // If we have an editor from constructor, use that
        if (this.editor) {
            const cursor = this.editor.getCursor();
            this.editor.replaceRange(response, cursor);
        } else {
            // Otherwise get the active editor
            const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (activeView) {
                const editor = activeView.editor;
                const cursor = editor.getCursor();
                editor.replaceRange(response, cursor);
            } else {
                // No editor available, show a notice
                new Notice('No active editor to insert content into');
            }
        }
    }
    
    private updateContextDisplay(): void {
        if (!this.contextFilesEl) return;
        
        // Clear all children
        this.contextFilesEl.empty();
        
        if (this.contextFiles.length === 0) {
            const noFilesEl = document.createElement('div');
            noFilesEl.textContent = 'No pages selected';
            this.contextFilesEl.appendChild(noFilesEl);
        } else {
            // Add a file element for each context file
            for (const file of this.contextFiles) {
                const fileEl = document.createElement('div');
                fileEl.className = 'ai-assistant-context-file';
                fileEl.textContent = file.basename;
                this.contextFilesEl.appendChild(fileEl);
                
                const removeButton = document.createElement('span');
                removeButton.className = 'ai-assistant-remove-context';
                removeButton.textContent = '×';
                fileEl.appendChild(removeButton);
                
                removeButton.addEventListener('click', () => {
                    this.contextFiles = this.contextFiles.filter(f => f !== file);
                    this.updateContextDisplay();
                });
            }
        }
    }
    
    onClose(): void {
        // Clean up modal references
        const modalEl = this.contentEl.closest('.modal') as HTMLElement;
        if (modalEl) {
            modalEl.classList.remove('ai-assistant-draggable');
            modalEl.classList.remove('ai-assistant-dragging');
            
            // Find and remove the modal container to prevent black window
            const modalContainer = modalEl.closest('.modal-container');
            if (modalContainer) {
                // Use setTimeout to ensure this happens after Obsidian's modal cleanup
                setTimeout(() => {
                    if (document.body.contains(modalContainer)) {
                        modalContainer.remove();
                    }
                }, 0);
            }
        }
        
        // If the plugin has an activeModal reference, clear it
        if (this.plugin.activeModal === this) {
            this.plugin.activeModal = null;
        }
        
        // Call the parent class implementation
        const { contentEl } = this;
        contentEl.empty();
        
        // Remove any dangling event listeners
        document.querySelectorAll('.ai-assistant-button, .ai-assistant-close-button, .ai-assistant-remove-context')
            .forEach(el => {
                // Clone and replace elements to remove all event listeners
                if (el.parentNode) {
                    const clone = el.cloneNode(true);
                    el.parentNode.replaceChild(clone, el);
                }
            });
    }
    
    private makeDraggable(): void {
        // Get the modal element (the parent of contentEl in Obsidian's Modal class)
        const modalEl = this.contentEl.closest('.modal') as HTMLElement;
        if (!modalEl) return;
        
        let isDragging = false;
        let offsetX = 0, offsetY = 0;
        
        // Mouse down event handler
        const onMouseDown = (e: MouseEvent) => {
            // Only start dragging when clicking on the header
            if (e.target instanceof Element && !this.headerEl.contains(e.target)) {
                return;
            }
            
            isDragging = true;
            
            const rect = modalEl.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            
            // Mark this modal as having been manually positioned
            modalEl.setAttribute('data-has-been-moved', 'true');
            modalEl.classList.add('ai-assistant-dragging');
            modalEl.classList.remove('ai-assistant-centered');
            modalEl.classList.add('ai-assistant-positioned');
        };
        
        // Mouse move event handler
        const onMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            
            const x = e.clientX - offsetX;
            const y = e.clientY - offsetY;
            
            // Keep modal within viewport bounds
            const maxX = window.innerWidth - modalEl.offsetWidth;
            const maxY = window.innerHeight - modalEl.offsetHeight;
            
            const boundedX = Math.min(Math.max(0, x), maxX);
            const boundedY = Math.min(Math.max(0, y), maxY);
            
            // Set position using top and left
            modalEl.style.top = `${boundedY}px`;
            modalEl.style.left = `${boundedX}px`;
        };
        
        // Mouse up event handler
        const onMouseUp = () => {
            isDragging = false;
            modalEl.classList.remove('ai-assistant-dragging');
        };
        
        // Add event listeners
        this.headerEl.addEventListener('mousedown', onMouseDown);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        
        // Store original onClose to extend it
        const originalOnClose = this.onClose.bind(this);
        this.onClose = () => {
            // Clean up event listeners
            this.headerEl.removeEventListener('mousedown', onMouseDown);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            
            // Call original onClose
            originalOnClose();
        };
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