<script>
	import { getStoredPrivateKey } from '$lib/crypto.js';
	import { showFlash } from '$lib/store.js';

	let hasKey = $state(false);
	let transferInitiated = $state(false);

	$effect(() => {
		hasKey = !!getStoredPrivateKey();
	});

	function initiateTransfer() {
		transferInitiated = true;
		showFlash('Transfer mode active. Open this page in your other browser to receive the key.');
	}
</script>

<svelte:head>
	<title>Key Transfer - Radegast</title>
</svelte:head>

<div class="row justify-content-center">
	<div class="col-md-6">
		<h2 class="mb-4">Key Transfer</h2>

		{#if hasKey}
			<div class="alert alert-info">
				<p>You have a private key stored in this browser. You can transfer it to another session.</p>
			</div>

			{#if !transferInitiated}
				<button class="btn btn-primary" onclick={initiateTransfer}>Allow Key Transfer</button>
			{:else}
				<div class="alert alert-success">
					<p>
						Transfer mode is active. When you log in from another browser, you'll be able to
						receive the key from this session.
					</p>
					<p class="mb-0">
						<em>Note: In production, this would use encrypted server-mediated transfer.</em>
					</p>
				</div>
			{/if}
		{:else}
			<div class="alert alert-warning">
				<p>No private key found in this browser.</p>
				<p>Options:</p>
				<ul>
					<li><a href="/keys/recovery">Use your recovery key</a></li>
					<li>
						Open this page in a browser where you have the key and initiate a transfer
					</li>
				</ul>
			</div>
		{/if}
	</div>
</div>
