<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { api } from '$lib/api';
	import Spinner from '$lib/components/Spinner.svelte';

	onMount(async () => {
		const idStr = page.params.id;
		if (!idStr) {
			goto(`${base}/alerts`);
			return;
		}

		try {
			const id = Number(idStr);
			const log = await api.getLog(id);
			if (log && log.time) {
				const logTime = new Date(log.time);
				// Calculate 24 hours before and after
				const from = new Date(logTime.getTime() - 24 * 60 * 60 * 1000);
				const to = new Date(logTime.getTime() + 24 * 60 * 60 * 1000);
				
				const pad = (num: number) => String(num).padStart(2, '0');
				const fromStr = `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}T${pad(from.getHours())}:${pad(from.getMinutes())}`;
				const toStr = `${to.getFullYear()}-${pad(to.getMonth() + 1)}-${pad(to.getDate())}T${pad(to.getHours())}:${pad(to.getMinutes())}`;

				goto(`${base}/alerts#from=${encodeURIComponent(fromStr)}&to=${encodeURIComponent(toStr)}&focused_alert=${id}`);
			} else {
				goto(`${base}/alerts`);
			}
		} catch (e) {
			console.error("Failed to redirect to alert:", e);
			goto(`${base}/alerts`);
		}
	});
</script>

<Spinner centered text="Redirecting to alert..." py={5} />
