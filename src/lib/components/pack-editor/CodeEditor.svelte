<script lang="ts">
	let { value = $bindable(''), language = $bindable('text'), onChange = $bindable(() => {}) } = $props<{
		value?: string;
		language?: string;
		onChange?: (value: string) => void;
	}>();
</script>

<textarea 
	bind:value
	oninput={(e) => { value = (e.target as HTMLTextAreaElement).value; onChange(value); }}
	class="form-control w-100 h-100 border-0 p-3"
	style="resize: none; outline: none; font-family: 'Courier New', monospace; font-size: 14px; line-height: 1.5; background: transparent;"
></textarea>
