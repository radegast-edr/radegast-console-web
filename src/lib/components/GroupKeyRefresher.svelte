<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { api, type Group } from '$lib/api';
	import { user, showFlash, triggerKeyRefresh } from '$lib/store';
	import { getStoredPrivateKey, initAgeWasm, decrypt, generateKeypair, encrypt, getStoredPublicKey } from '$lib/crypto';
	import { refreshGroupKeys } from '$lib/groupHelpers';
	import Spinner from './Spinner.svelte';

	let refreshProgress = $state<{ current: number; total: number; refreshing: boolean }>({ current: 0, total: 0, refreshing: false });
	let adminGroupsToRefresh = $state<Group[]>([]);
	let intervalId: ReturnType<typeof setInterval> | undefined = undefined;
	let unsubscribe: (() => void) | undefined = undefined;

	onMount(() => {
		// Run on load if user is logged in
		checkAndRefreshKeys();

		// Set up background poll every 60 seconds
		intervalId = setInterval(checkAndRefreshKeys, 60000);

		// Subscribe to immediate key refresh triggers
		unsubscribe = triggerKeyRefresh.subscribe((val) => {
			if (val > 0) {
				checkAndRefreshKeys();
			}
		});
	});

	onDestroy(() => {
		if (intervalId !== undefined) {
			clearInterval(intervalId);
		}
		if (unsubscribe) {
			unsubscribe();
		}
	});

	async function checkAndRefreshKeys(): Promise<void> {
		const currentUser = $user;
		if (!currentUser) return;

		try {
			// Fetch groups needing refresh from backend custom endpoint
			const groupsRes = (await api.listGroupsNeedingRefresh()) || [];
			if (groupsRes.length === 0) {
				adminGroupsToRefresh = [];
				return;
			}

			const userPriv = await getStoredPrivateKey(currentUser.id);
			const autoRefreshQueue: Group[] = [];
			const adminQueue: Group[] = [];

			for (const g of groupsRes) {
				let canDecrypt = false;
				let needsSetup = false;
				if (g.user_has_admin && (!g.private_key || !g.public_key) && userPriv) {
					needsSetup = true;
				} else if (g.user_has_pack_write && g.private_key && userPriv) {
					try {
						await initAgeWasm();
						decrypt(g.private_key, userPriv);
						canDecrypt = true;
					} catch {
						canDecrypt = false;
					}
				}
				if (canDecrypt || needsSetup) {
					autoRefreshQueue.push(g);
				} else {
					adminQueue.push(g);
				}
			}

			adminGroupsToRefresh = adminQueue;

			if (autoRefreshQueue.length > 0) {
				refreshProgress = { current: 0, total: autoRefreshQueue.length, refreshing: true };
				for (let i = 0; i < autoRefreshQueue.length; i++) {
					const g = autoRefreshQueue[i];
					try {
						if (!g.private_key || !g.public_key) {
							// Generate new keys for the group
							await initAgeWasm();
							const { publicKey, privateKey } = generateKeypair();
							const pubKeys = await api.getGroupRecipientPublicKeys(g.id);
							const myPub = await getStoredPublicKey(currentUser.id);
							if (myPub && !pubKeys.includes(myPub)) {
								pubKeys.push(myPub);
							}
							const encPriv = encrypt(privateKey, pubKeys);
							await api.setupGroupKeys(g.id, {
								public_key: publicKey,
								private_key: encPriv
							});
						} else {
							await refreshGroupKeys(g.id, g.name, g.private_key!, g.public_key!, userPriv!);
						}
					} catch (err) {
						console.error(`Failed to automatically refresh group ${g.name} keys:`, err);
					}
					refreshProgress = { ...refreshProgress, current: i + 1 };
				}
				refreshProgress = { ...refreshProgress, refreshing: false };
				showFlash('All eligible group keys refreshed successfully');
			}
		} catch (err) {
			console.error("Error checking or refreshing group keys:", err);
		}
	}
</script>

{#if refreshProgress.refreshing}
	<div class="alert alert-info shadow-sm border-0 mb-4">
		<h5 class="fw-bold">Refreshing Group Keys</h5>
		<p class="mb-2">
			Converting and re-encrypting group keys...
		</p>
		<div class="d-flex align-items-center gap-2">
			<Spinner inline size="sm" />
			<span>Processed {refreshProgress.current} of {refreshProgress.total} group(s).</span>
		</div>
	</div>
{/if}

{#if adminGroupsToRefresh.length > 0}
	<div class="alert alert-warning shadow-sm border-0 mb-4">
		<h5 class="fw-bold">Key Refresh Pending (Admin Required)</h5>
		<p class="mb-2">
			The private key for the following group(s) needs to be re-encrypted and refreshed, but you do not have permission or are unable to decrypt them (e.g., because you were recently invited). Please ask a group admin to log in to Radegast to complete the refresh:
		</p>
		<ul class="mb-0">
			{#each adminGroupsToRefresh as group}
				<li>
					<span class="fw-bold text-danger">{group.name}</span>
				</li>
			{/each}
		</ul>
	</div>
{/if}
