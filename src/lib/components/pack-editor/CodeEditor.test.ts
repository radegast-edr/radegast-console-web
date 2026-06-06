import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import CodeEditor from './CodeEditor.svelte';

describe('CodeEditor Component', () => {
	let onChange: (value: string) => void;

	beforeEach(() => {
		onChange = vi.fn();
	});

	it('renders with empty content', () => {
		render(CodeEditor, { props: { value: '', language: 'text', onChange } });
		const textarea = screen.getByRole('textbox');
		expect(textarea).toBeInTheDocument();
		expect(textarea.value).toBe('');
	});

	it('renders with initial content', () => {
		const initialValue = 'test content';
		render(CodeEditor, { props: { value: initialValue, language: 'text', onChange } });
		const textarea = screen.getByRole('textbox');
		expect(textarea.value).toBe(initialValue);
	});

	it('calls onChange when user types', async () => {
		render(CodeEditor, { props: { value: '', language: 'text', onChange } });
		const textarea = screen.getByRole('textbox');
		
		// Simulate typing
		await fireEvent.input(textarea, { target: { value: 'new content' } });
		
		expect(onChange).toHaveBeenCalled();
	});

	it('renders with different languages', () => {
		const languages = ['yaml', 'yara', 'json', 'javascript', 'python', 'text'];
		
		languages.forEach(lang => {
			const { unmount } = render(CodeEditor, { props: { value: '', language: lang, onChange } });
			const textarea = screen.getByRole('textbox');
			expect(textarea).toBeInTheDocument();
			unmount();
		});
	});

	it('has correct styling for code editor container', () => {
		const { container } = render(CodeEditor, { props: { value: '', language: 'text', onChange } });
		const editorContainer = container.querySelector('.code-editor-container');
		expect(editorContainer).toBeInTheDocument();
	});

	it('has highlighted content div', () => {
		const { container } = render(CodeEditor, { props: { value: 'test', language: 'text', onChange } });
		const highlighted = container.querySelector('.code-editor-highlighted');
		expect(highlighted).toBeInTheDocument();
	});

	it('has textarea for editing', () => {
		const { container } = render(CodeEditor, { props: { value: '', language: 'text', onChange } });
		const textarea = container.querySelector('.code-editor-textarea');
		expect(textarea).toBeInTheDocument();
		expect(textarea?.tagName).toBe('TEXTAREA');
	});

	it('supports YAML syntax highlighting', () => {
		const yamlContent = 'title: Test\ncondition: selection';
		render(CodeEditor, { props: { value: yamlContent, language: 'yaml', onChange } });
		const textarea = screen.getByRole('textbox');
		expect(textarea.value).toBe(yamlContent);
	});

	it('supports YARA syntax highlighting', () => {
		const yaraContent = 'rule Test { strings: $a = "test" condition: $a }';
		render(CodeEditor, { props: { value: yaraContent, language: 'yara', onChange } });
		const textarea = screen.getByRole('textbox');
		expect(textarea.value).toBe(yaraContent);
	});
});
