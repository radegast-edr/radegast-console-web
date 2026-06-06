import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import CodeEditor from './CodeEditor.svelte';

describe('CodeEditor Component', () => {
	it('renders a textarea element', () => {
		render(CodeEditor, { props: { value: '', language: 'text' } });
		const textarea = screen.getByRole('textbox');
		expect(textarea).toBeInTheDocument();
	});

	it('displays initial value in textarea', () => {
		const initialValue = 'const test = "hello";';
		render(CodeEditor, { props: { value: initialValue, language: 'javascript' } });
		const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
		expect(textarea.value).toBe(initialValue);
	});

	it('updates value when user types', async () => {
		const onChange = vi.fn();
		render(CodeEditor, { props: { value: '', language: 'text', onChange } });
		const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
		
		// Simulate user typing
		textarea.value = 'new content';
		fireEvent.input(textarea);
		
		// Check that onChange was called
		expect(onChange).toHaveBeenCalledWith('new content');
	});

	it('uses monospace font family', () => {
		render(CodeEditor, { props: { value: '', language: 'yaml' } });
		const textarea = screen.getByRole('textbox');
		expect(textarea).toHaveStyle('font-family: \'Courier New\', monospace');
	});

	it('has full width class', () => {
		render(CodeEditor, { props: { value: '', language: 'text' } });
		const textarea = screen.getByRole('textbox');
		expect(textarea).toHaveClass('w-100');
	});

	it('has full height class', () => {
		render(CodeEditor, { props: { value: '', language: 'text' } });
		const textarea = screen.getByRole('textbox');
		expect(textarea).toHaveClass('h-100');
	});

	it('has no border', () => {
		render(CodeEditor, { props: { value: '', language: 'text' } });
		const textarea = screen.getByRole('textbox');
		expect(textarea).toHaveClass('border-0');
	});

	it('has transparent background', () => {
		render(CodeEditor, { props: { value: '', language: 'text' } });
		const textarea = screen.getByRole('textbox');
		expect(textarea).toHaveStyle('background: transparent');
	});

	it('has form-control class for Bootstrap styling', () => {
		render(CodeEditor, { props: { value: '', language: 'text' } });
		const textarea = screen.getByRole('textbox');
		expect(textarea).toHaveClass('form-control');
	});

	it('has proper padding', () => {
		render(CodeEditor, { props: { value: '', language: 'text' } });
		const textarea = screen.getByRole('textbox');
		expect(textarea).toHaveClass('p-3');
	});

	it('has no resize handle', () => {
		render(CodeEditor, { props: { value: '', language: 'text' } });
		const textarea = screen.getByRole('textbox');
		expect(textarea).toHaveStyle('resize: none');
	});

	it('has no outline', () => {
		render(CodeEditor, { props: { value: '', language: 'text' } });
		const textarea = screen.getByRole('textbox');
		expect(textarea).toHaveStyle('outline: none');
	});

	it('has proper line height', () => {
		render(CodeEditor, { props: { value: '', language: 'text' } });
		const textarea = screen.getByRole('textbox');
		expect(textarea).toHaveStyle('line-height: 1.5');
	});

	it('has proper font size', () => {
		render(CodeEditor, { props: { value: '', language: 'text' } });
		const textarea = screen.getByRole('textbox');
		expect(textarea).toHaveStyle('font-size: 14px');
	});

	it('binds value correctly', async () => {
		let externalValue = 'initial';
		const onChange = (v: string) => { externalValue = v; };
		
		render(CodeEditor, { 
			props: { 
				value: externalValue, 
				language: 'text',
				onChange 
			} 
		});
		
		const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
		expect(textarea.value).toBe('initial');
		
		// Simulate change
		textarea.value = 'updated';
		fireEvent.input(textarea);
		
		expect(externalValue).toBe('updated');
	});

	it('handles empty initial value', () => {
		render(CodeEditor, { props: { value: '', language: 'text' } });
		const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
		expect(textarea.value).toBe('');
	});

	it('handles multiline content', () => {
		const multiline = 'line1\nline2\nline3';
		render(CodeEditor, { props: { value: multiline, language: 'text' } });
		const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
		expect(textarea.value).toBe(multiline);
	});

	it('accepts different language props without errors', () => {
		const languages = ['text', 'yaml', 'yara', 'json', 'javascript', 'python', 'bash', 'markdown'];
		
		for (const lang of languages) {
			render(CodeEditor, { props: { value: '', language: lang } });
			const textarea = screen.getByRole('textbox');
			expect(textarea).toBeInTheDocument();
		}
	});
});
