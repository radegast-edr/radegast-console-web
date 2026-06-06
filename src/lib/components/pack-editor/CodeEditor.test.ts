import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import CodeEditor from './CodeEditor.svelte';

describe('CodeEditor', () => {
	it('renders a textarea element', () => {
		render(CodeEditor, { props: { value: '', language: 'text' } });
		const textarea = screen.getByRole('textbox');
		expect(textarea).toBeInTheDocument();
	});

	it('displays initial value', () => {
		const initialValue = 'test content';
		render(CodeEditor, { props: { value: initialValue, language: 'text' } });
		const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
		expect(textarea.value).toBe(initialValue);
	});

	it('updates value on user input', async () => {
		render(CodeEditor, { props: { value: '', language: 'text' } });
		const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
		
		// Simulate user typing
		textarea.value = 'new content';
		textarea.dispatchEvent(new Event('input'));
		
		expect(textarea.value).toBe('new content');
	});

	it('uses monospace font', () => {
		render(CodeEditor, { props: { value: '', language: 'yaml' } });
		const textarea = screen.getByRole('textbox');
		expect(textarea).toHaveStyle('font-family: \'Courier New\', monospace');
	});

	it('has no border', () => {
		render(CodeEditor, { props: { value: '', language: 'text' } });
		const textarea = screen.getByRole('textbox');
		expect(textarea).toHaveClass('border-0');
	});

	it('fills available width', () => {
		render(CodeEditor, { props: { value: '', language: 'text' } });
		const textarea = screen.getByRole('textbox');
		expect(textarea).toHaveClass('w-100');
	});

	it('fills available height', () => {
		render(CodeEditor, { props: { value: '', language: 'text' } });
		const textarea = screen.getByRole('textbox');
		expect(textarea).toHaveClass('h-100');
	});

	it('has transparent background', () => {
		render(CodeEditor, { props: { value: '', language: 'text' } });
		const textarea = screen.getByRole('textbox');
		expect(textarea).toHaveStyle('background: transparent');
	});

	it('calls onChange when value changes', async () => {
		let changedValue = '';
		const onChange = (value: string) => { changedValue = value; };
		
		render(CodeEditor, { 
			props: { 
				value: '', 
				language: 'text',
				onChange 
			} 
		});
		
		const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
		textarea.value = 'changed';
		textarea.dispatchEvent(new Event('input'));
		
		expect(changedValue).toBe('changed');
	});
});
