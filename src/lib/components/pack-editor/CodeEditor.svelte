<script lang="ts">
	let { value = $bindable(''), language = $bindable('text'), onChange = $bindable(() => {}) } = $props<{
		value?: string;
		language?: string;
		onChange?: (value: string) => void;
	}>();

	let container: HTMLDivElement;

	// Syntax highlighting themes
	const themes: Record<string, { keywords?: string[]; comments?: string; strings?: string[] }> = {
		yaml: {
			keywords: ['true', 'false', 'null', 'and', 'or', 'not', 'if', 'then', 'else', 'title', 'description', 'author', 'date', 'modified', 'logsource', 'detection', 'selection', 'filter', 'condition'],
			comments: '#',
			strings: ['"', "'"]
		},
		yara: {
			keywords: ['rule', 'meta', 'strings', 'condition', 'import', 'private', 'global', 'all', 'any', 'none', 'in', 'contains', 'matches', 'wide', 'nocase', 'ascii', 'fullword', 'xor', 'base64', 'base64wide', 'pe', 'uint8', 'uint16', 'uint32', 'int8', 'int16', 'int32'],
			comments: '//',
			strings: ['"', "'"]
		},
		json: {
			keywords: ['true', 'false', 'null'],
			comments: '',
			strings: ['"']
		},
		text: {},
		javascript: {
			keywords: ['function', 'const', 'let', 'var', 'if', 'else', 'for', 'while', 'return', 'try', 'catch', 'throw', 'new', 'delete', 'typeof', 'instanceof'],
			comments: '//',
			strings: ['"', "'", '`']
		},
		python: {
			keywords: ['def', 'class', 'if', 'else', 'elif', 'for', 'while', 'return', 'try', 'except', 'finally', 'with', 'import', 'from', 'as', 'lambda', 'True', 'False', 'None'],
			comments: '#',
			strings: ['"', "'", '"""', "'''"]
		}
	};

	function escapeHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	function highlightCode(text: string, lang: string): string {
		const theme = themes[lang] || themes.text;
		const keywords = theme.keywords || [];
		const commentChar = theme.comments || '';
		const stringChars = theme.strings || [];

		let result = escapeHtml(text);

		// Highlight strings (handle both single and multi-line)
		for (const strChar of stringChars) {
			if (strChar.length === 1) {
				// Simple single-line strings
				const regex = new RegExp(`(${strChar}[^${strChar}]*${strChar})`, 'g');
				result = result.replace(regex, '<span class="code-string">$1</span>');
			} else {
				// Multi-line strings (like """ or ''')
				const regex = new RegExp(`(${strChar}[\\s\\S]*?${strChar})`, 'g');
				result = result.replace(regex, '<span class="code-string">$1</span>');
			}
		}

		// Highlight comments
		if (commentChar) {
			const regex = new RegExp(`(${commentChar}.*?)$`, 'gm');
			result = result.replace(regex, '<span class="code-comment">$1</span>');
		}

		// Highlight keywords
		if (keywords.length > 0) {
			const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
			result = result.replace(keywordRegex, '<span class="code-keyword">$1</span>');
		}

		return result;
	}

	function updateHighlighting(): void {
		if (!container) return;
		
		const highlighted = highlightCode(value, language);
		container.innerHTML = highlighted.replace(/\n/g, '<br>').replace(/ /g, '&nbsp;');
	}

	$effect(() => {
		value;
		language;
		updateHighlighting();
	});

	function handleInput(e: Event): void {
		const target = e.target as HTMLTextAreaElement;
		onChange(value);
		updateHighlighting();
	}

	function handleKeyDown(e: KeyboardEvent): void {
		// Tab key support
		if (e.key === 'Tab') {
			e.preventDefault();
			const textarea = e.target as HTMLTextAreaElement;
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			const spaces = '    ';
			
			value = value.substring(0, start) + spaces + value.substring(end);
			textarea.selectionStart = textarea.selectionEnd = start + spaces.length;
			onChange(value);
			updateHighlighting();
		}
	}
</script>

<div class="code-editor-container h-100 overflow-auto">
	<textarea 
		bind:value
		oninput={handleInput}
		onkeydown={handleKeyDown}
		class="code-editor-textarea w-100 h-100 border-0 p-0 bg-transparent"
		style="resize: none; outline: none; font-family: 'Courier New', monospace; font-size: 14px; line-height: 1.5;"
	></textarea>
	<div 
		bind:this={container}
		class="code-editor-highlighted w-100 h-100 position-absolute top-0 left-0 p-3 pointer-events-none"
		style="font-family: 'Courier New', monospace; font-size: 14px; line-height: 1.5; white-space: pre-wrap; word-break: break-all;"
	></div>
</div>

<style>
	.code-editor-container {
		position: relative;
		background: #1e1e1e;
		color: #d4d4d4;
		border-radius: 4px;
		overflow: auto;
		min-height: 200px;
	}
	
	.code-editor-textarea {
		color: transparent;
		background: transparent;
		caret-color: #d4d4d4;
		z-index: 1;
		position: relative;
		padding: 12px;
	}
	
	.code-editor-highlighted {
		z-index: 0;
		background: #1e1e1e;
		padding: 12px;
	}
	
	:global(.code-keyword) {
		color: #569cd6;
		font-weight: bold;
	}
	
	:global(.code-string) {
		color: #ce9178;
	}
	
	:global(.code-comment) {
		color: #6a9955;
		font-style: italic;
	}
</style>
