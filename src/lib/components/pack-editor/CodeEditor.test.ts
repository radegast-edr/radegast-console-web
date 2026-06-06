import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import CodeEditor from './CodeEditor.svelte';

describe('CodeEditor Component', () => {
	it('renders with empty content', () => {
		render(CodeEditor, { props: { value: '', language: 'text' } });
		const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
		expect(textarea).toBeInTheDocument();
		expect(textarea.value).toBe('');
	});

	it('renders with initial content', () => {
		const initialValue = 'test content';
		render(CodeEditor, { props: { value: initialValue, language: 'text' } });
		const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
		expect(textarea.value).toBe(initialValue);
	});

	it('renders with different languages', () => {
		const languages = ['yaml', 'yara', 'json', 'javascript', 'python', 'text'];
		
		languages.forEach(lang => {
			render(CodeEditor, { props: { value: '', language: lang } });
			const textarea = screen.getByRole('textbox');
			expect(textarea).toBeInTheDocument();
		});
	});

	it('has correct styling for code editor container', () => {
		const { container } = render(CodeEditor, { props: { value: '', language: 'text' } });
		const editorContainer = container.querySelector('.code-editor-container');
		expect(editorContainer).toBeInTheDocument();
	});

	it('has highlighted content div', () => {
		const { container } = render(CodeEditor, { props: { value: 'test', language: 'text' } });
		const highlighted = container.querySelector('.code-editor-highlighted');
		expect(highlighted).toBeInTheDocument();
	});
});
