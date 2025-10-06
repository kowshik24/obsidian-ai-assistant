import { Editor, EditorPosition } from 'obsidian';

export class CommandDetector {
    // Simple direct check for "/ai" command without timing dependency
    public static checkForAICommand(editor: Editor, context: { event?: KeyboardEvent } = {}): boolean {
        const cursorPos = editor.getCursor();
        
        // If this is an Enter keypress event, we need to check the current line before Enter is pressed
        if (context.event && context.event.key === 'Enter') {
            // Current line before pressing Enter
            const currentLine = editor.getLine(cursorPos.line).trim();
            
            // Check if current line is "/ai"
            if (currentLine === '/ai') {
                return true;
            }
        } 
        // For editor-change events (after Enter is pressed), check the previous line
        else {
            // Current line (after pressing Enter)
            const line = editor.getLine(cursorPos.line).trim();
            
            // Previous line (where "/ai" would have been)
            const prevLine = cursorPos.line > 0 ? editor.getLine(cursorPos.line - 1).trim() : '';
            
            // Check if current line is empty and previous line was "/ai"
            if (line === '' && prevLine === '/ai') {
                return true;
            }
            
            // Check if current line is "/ai"
            if (line === '/ai') {
                return true;
            }
        }
        
        return false;
    }

    // Remove the '/ai' command from the document
    public static removeAICommand(editor: Editor): void {
        const cursorPos = editor.getCursor();
        const currentLine = editor.getLine(cursorPos.line).trim();
        
        // Check current line
        if (currentLine === '/ai') {
            // Remove the entire current line
            const from: EditorPosition = { 
                line: cursorPos.line, 
                ch: 0 
            };
            const to: EditorPosition = { 
                line: cursorPos.line, 
                ch: editor.getLine(cursorPos.line).length 
            };
            
            editor.replaceRange('', from, to);
            return;
        }
        
        // Check previous line
        if (cursorPos.line > 0) {
            const prevLine = editor.getLine(cursorPos.line - 1).trim();
            if (prevLine === '/ai') {
                // Remove the entire previous line
                const from: EditorPosition = { 
                    line: cursorPos.line - 1, 
                    ch: 0 
                };
                const to: EditorPosition = { 
                    line: cursorPos.line - 1, 
                    ch: editor.getLine(cursorPos.line - 1).length 
                };
                
                editor.replaceRange('', from, to);
                return;
            }
        }
    }
}