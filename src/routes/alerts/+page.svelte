<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { askConfirm } from '$lib/confirm';
	import { onMount, onDestroy } from 'svelte';
	import { api, type Log, type Device, type Group, type Team, type ExclusionCreate } from '$lib/api';
	import { showError, showFlash, user } from '$lib/store';
	import { initAgeWasm, getStoredPrivateKey, decrypt, encrypt } from '$lib/crypto';
	import { decryptExclusion, encryptExclusion } from '$lib/exclusionHelpers';
	import { LogManager } from '$lib/logManager.svelte';
	import { formatFullDateTime, mapSeverityToNumber, toLocalISOString, toUTCISOString } from '$lib/utils';
	import ExclusionModal from '$lib/components/ExclusionModal.svelte';
	import AlertDetail from '$lib/components/AlertDetail.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Spinner from '$lib/components/Spinner.svelte';

	// Parse URL hash synchronously before Svelte state initialization
	const initialHash = typeof window !== 'undefined' ? window.location.hash : '';
	const hashParams = new URLSearchParams(initialHash.slice(1));
	const initialQ = hashParams.get('q');
	const initialFrom = hashParams.get('from');
	const initialTo = hashParams.get('to');
	const hasHashParams = !!(initialQ || initialFrom || initialTo);

	const getDefaultFromTime = () => {
		const now = new Date();
		const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
		const pad = (num: number) => String(num).padStart(2, '0');
		return `${fourDaysAgo.getFullYear()}-${pad(fourDaysAgo.getMonth()+1)}-${pad(fourDaysAgo.getDate())}T${pad(fourDaysAgo.getHours())}:${pad(fourDaysAgo.getMinutes())}`;
	};

	const getDefaultToTime = () => {
		const now = new Date();
		const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
		const pad = (num: number) => String(num).padStart(2, '0');
		return `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth()+1)}-${pad(tomorrow.getDate())}T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`;
	};

	let initialized = $state(false);
	let logManager: LogManager | null = $state(null);
	let privateKey = $state<string | null>(null);

	let searchQuery = $state(initialQ || '');

	let selectedLog = $state<Log | null>(null);
	let resolution = $state<string>('none');
	let triageNote = $state<string>('');
	let savingResolution = $state(false);
	let selectedDeviceDetails = $state<any>(null);

	let fromTime = $state<string | null>(toLocalISOString(initialFrom) || (hasHashParams ? null : getDefaultFromTime()));
	let toTime = $state<string | null>(toLocalISOString(initialTo) || (hasHashParams ? null : getDefaultToTime()));

	// Exclusion creation from alert
	let showExclusionModal = $state(false);
	let exclusionName = $state('');
	let exclusionQuery = $state('');
	let exclusionDescription = $state('');
	let exclusionType = $state<'hard' | 'soft'>('hard');
	let userGroups = $state<Group[]>([]);
	let selectedGroupId = $state<number | null>(null);
	let exclusionEncrypted = $state(false);
	let userTeamsForPermission = $state<Team[]>([]);
	let currentAlertObj = $state<Record<string, unknown> | null>(null);
	let editingExclusion = $state<any>(null);

	let hasAnyPackWritePermission = $derived(
		!!$user &&
		userTeamsForPermission.some((t: { permission_pack?: string | null }) => t.permission_pack === 'write')
	);

	function showBrowserNotification(log: Log, devObj: Device | undefined) {
		if (typeof window !== 'undefined' && 'Notification' in window) {
			if (Notification.permission === 'granted') {
				const deviceName = devObj ? devObj.name : `Device #${log.device_id}`;
				const severityStr = log.severity ? ` [${log.severity.toUpperCase()}]` : '';
				new Notification(`New Alert${severityStr} - Radegast EDR`, {
					body: `New alert from ${deviceName}`
				});
			}
		}
	}

	function syncFromHash() {
		if (typeof window === 'undefined') return;
		const hash = window.location.hash;
		const hashParams = new URLSearchParams(hash.slice(1));
		searchQuery = hashParams.get('q') || '';
		
		const f = hashParams.get('from');
		if (f) {
			fromTime = toLocalISOString(f);
		} else {
			fromTime = hasHashParams ? null : getDefaultFromTime();
		}
		
		const t = hashParams.get('to');
		if (t) {
			toTime = toLocalISOString(t);
		} else {
			toTime = hasHashParams ? null : getDefaultToTime();
		}
		
		const focused = hashParams.get('focused_alert');
		if (!focused) {
			selectedLog = null;
		} else if (logManager) {
			const focusedId = Number(focused);
			const matchedLog = logManager.logs.find(l => l.id === focusedId);
			if (matchedLog) {
				selectedLog = matchedLog;
			}
		}
	}

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('hashchange', syncFromHash);
		}
	});

	onMount(async () => {
		if (typeof window !== 'undefined') {
			window.addEventListener('hashchange', syncFromHash);
		}
		try {
			await initAgeWasm();
			const me = await api.me();
			$user = me;
			privateKey = await getStoredPrivateKey(me.id);
			
			logManager = new LogManager(privateKey, showBrowserNotification);
			const devicesData = await api.listDevices();
			logManager.setDevices(devicesData);

			// Load user teams and groups for exclusion creation
			userTeamsForPermission = await api.listTeams();
			userGroups = await api.listGroups();

			await performSearch();

			const initialFocusedAlert = hashParams.get('focused_alert');
			if (initialFocusedAlert && logManager) {
				const focusedId = Number(initialFocusedAlert);
				const matchedLog = logManager.logs.find(l => l.id === focusedId);
				if (matchedLog) {
					selectLog(matchedLog);
				}
			}
			
			if (typeof window !== 'undefined' && 'Notification' in window) {
				if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
					Notification.requestPermission();
				}
			}
			initialized = true;
		} catch (e) {
			showError('Failed to initialize: ' + (e as Error).message);
		}
	});

	async function performSearch() {
		if (!logManager) return;
		await logManager.performSearch(fromTime, toTime);
		await logManager.runFilter(searchQuery);
	}

	$effect(() => {
		if (logManager) {
			const _ = logManager.logs;
			logManager.runFilter(searchQuery);
		}
	});

	// Reactively update the URL hash when search inputs change
	$effect(() => {
		if (!initialized || typeof window === 'undefined') return;
		const params = new URLSearchParams();
		if (searchQuery) params.set('q', searchQuery);
		if (fromTime) params.set('from', toUTCISOString(fromTime));
		if (toTime) params.set('to', toUTCISOString(toTime));
		if (selectedLog) params.set('focused_alert', String(selectedLog.id));
		
		const hash = params.toString();
		const newHash = hash ? `#${hash}` : '';
		if (window.location.hash !== newHash) {
			goto(window.location.pathname + window.location.search + newHash, {
				replaceState: true,
				noScroll: true,
				keepFocus: true
			});
		}
	});


	const markedSeenIds = new Set<number>();

	async function selectLog(log: Log) {
		selectedLog = log;
		resolution = log.alert_resolution || 'none';
		selectedDeviceDetails = null;
		const devicePromise = api.getDevice(log.device_id);
		if (devicePromise && typeof devicePromise.then === 'function') {
			devicePromise.then(details => {
				if (selectedLog?.id === log.id) {
					selectedDeviceDetails = details;
				}
			}).catch(e => {
				console.error("Failed to load device details for groups", e);
			});
		}
		
		if (log.triage_note && privateKey) {
			try {
				triageNote = decrypt(log.triage_note, privateKey);
			} catch (e) {
				triageNote = 'Failed to decrypt note: ' + (e as Error).message;
			}
		} else {
			triageNote = '';
		}

		// In basic mode: mark as seen on click (no resolution required).
		// In extended EDR mode: only mark as seen if the log already has a resolution
		// (alerts without a resolution must stay active/unread until triaged).
		const hasResolution = !!(log.alert_resolution && log.alert_resolution !== 'none');
		const shouldMarkSeen = $user && !log.seen && !markedSeenIds.has(log.id) &&
			(!$user.extended_edr_enabled || hasResolution);

		if (shouldMarkSeen) {
			try {
				await api.markLogSeen(log.id);
				markedSeenIds.add(log.id);
				// Always update local state to reflect seen status —
				// in extended EDR the visual indicator is resolution-based, but seen
				// still needs to be accurate so the opacity/border reflects the DB state.
				log.seen = true;
			} catch (e) {
				console.error("Failed to mark log as seen", e);
			}
		}
	}

	async function saveResolution() {
		if (!selectedLog || !logManager) return;
		savingResolution = true;
		try {
			let encryptedNote: string | null = null;
			if (triageNote.trim() && privateKey) {
				// Fetch device-based public keys: all users with log-read access on this log's device.
				// Using the /device-keys endpoint (user-accessible) which replicates the same
				// key set as the device-facing encryption-keys endpoint via a shared utility.
				const keysRes = await api.client.GET('/api/v1/logs/{log_id}/device-keys', {
					params: { path: { log_id: selectedLog.id } }
				});
				if (keysRes.error) {
					const detail = typeof keysRes.error.detail === 'string' ? keysRes.error.detail : (keysRes.error.detail ? JSON.stringify(keysRes.error.detail) : 'Unknown error');
					throw new Error("Failed to fetch encryption keys: " + detail);
				}
				const keys = (keysRes.data as any) || [];
				const activeKeys = keys.filter((k: any) => k.key_type !== 'recovery').map((k: any) => k.public_key);
				if (activeKeys.length === 0) {
					throw new Error("No active public keys found to encrypt the triage note.");
				}
				encryptedNote = encrypt(triageNote, activeKeys);
			}
			
			const res = await api.client.PATCH('/api/v1/logs/{log_id}/resolve', {
				params: { path: { log_id: selectedLog.id } },
				body: { alert_resolution: resolution === 'none' ? null : resolution, triage_note: encryptedNote }
			});

			if (res.error) {
				const detail = typeof res.error.detail === 'string' ? res.error.detail : (res.error.detail ? JSON.stringify(res.error.detail) : 'Unknown error');
				throw new Error(detail);
			}

			showFlash('Resolution saved successfully');
			
			// Update local state
			selectedLog.alert_resolution = resolution === 'none' ? null : resolution;
			selectedLog.triage_note = encryptedNote; 
			// In extended EDR, only mark as seen when a real resolution is set.
			// Clearing the resolution should leave the log visually "active" (unread).
			const hasRealResolution = resolution && resolution !== 'none';
			if (!$user?.extended_edr_enabled || hasRealResolution) {
				selectedLog.seen = true;
			}
			
		} catch (e) {
			showError('Failed to save resolution: ' + (e as Error).message);
		} finally {
			savingResolution = false;
		}
	}

	async function markAllSeen() {
		if (!logManager) return;

		const isEdr = $user?.extended_edr_enabled;
		if (isEdr) {
			// Only mark alerts that don't yet have a resolution
			const unresolvedLogs = logManager.filteredLogs.filter(log => !log.alert_resolution || log.alert_resolution === "none");
			const count = unresolvedLogs.length;
			if (count === 0) return;

			const confirmed = await askConfirm(`Are you sure you want to resolve all ${count} currently shown unresolved alerts as 'read'?`);
			if (!confirmed) return;

			try {
				logManager.loading = true;
				await Promise.all(
					unresolvedLogs.map(async (log) => {
						const res = await api.client.PATCH('/api/v1/logs/{log_id}/resolve', {
							params: { path: { log_id: log.id } },
							body: { alert_resolution: 'read', triage_note: null }
						});
						if (res.error) {
							const detail = typeof res.error.detail === 'string' ? res.error.detail : (res.error.detail ? JSON.stringify(res.error.detail) : 'Unknown error');
							throw new Error(detail);
						}
						log.alert_resolution = 'read';
						log.seen = true;
					})
				);
				logManager.logs = [...logManager.logs];
				showFlash(`Successfully resolved ${count} alerts as 'read'`);
			} catch (e) {
				showError('Failed to resolve alerts: ' + (e as Error).message);
			} finally {
				logManager.loading = false;
			}
		} else {
			const confirmed = await askConfirm('Are you sure you want to mark all alerts as seen?');
			if (!confirmed) return;

			try {
				logManager.loading = true;
				await api.markAllLogsSeen();
				logManager.logs.forEach(log => {
					log.seen = true;
				});
				logManager.logs = [...logManager.logs];
				showFlash('All alerts marked as seen successfully');
			} catch (e) {
				showError('Failed to mark all as seen: ' + (e as Error).message);
			} finally {
				logManager.loading = false;
			}
		}
	}

	// Exclusion creation functions
	async function openCreateExclusionFromAlert(): Promise<void> {
		if (!selectedLog || !logManager) return;

		try {
			// Fetch device to get its groups
			const deviceDetail = await api.getDevice(selectedLog.device_id);
			if (!deviceDetail.groups || deviceDetail.groups.length === 0) {
				showError('This device does not belong to any groups.');
				return;
			}

			// Fetch details for all groups the device is part of
			const groupDetails = await Promise.all(
				deviceDetail.groups.map((g) => api.getGroup(g.id))
			);

			// Filter to groups where the user has pack write permissions (matched by team membership)
			const permittedGroups = groupDetails.filter((g) => {
				return (g.teams ?? []).some((teamInGroup) => {
					return (
						teamInGroup.permission_pack === 'write' &&
						userTeamsForPermission.some((userTeam) => userTeam.id === teamInGroup.id)
					);
				});
			});

			if (permittedGroups.length === 0) {
				showError('You do not have pack write permissions on any group this device belongs to.');
				return;
			}

			userGroups = permittedGroups;
		} catch (e) {
			showError('Failed to verify permissions: ' + (e as Error).message);
			return;
		}

		const alertObj = logManager.getAlertObject(selectedLog);
		// Store a plain snapshot — the flat alert data (keys like "rule.name") is passed directly to JSONata
		currentAlertObj = typeof alertObj.alert === 'object' && alertObj.alert !== null
			? (alertObj.alert as Record<string, unknown>)
			: null;

		// Generate a suggested JSONata query. The alert is a flat object with dotted keys,
		// so use backtick notation (`rule.name`) to reference them in JSONata.
		const ruleName = currentAlertObj?.['rule.name'] as string | undefined;
		let suggestedQuery = '';

		if (ruleName) {
			suggestedQuery = `\`rule.name\` = '${ruleName.replace(/'/g, "\\'")}'`;
		} else if (currentAlertObj) {
			const firstKey = Object.keys(currentAlertObj)[0];
			if (firstKey) {
				const firstValue = currentAlertObj[firstKey];
				suggestedQuery = typeof firstValue === 'string'
					? `\`${firstKey}\` = '${firstValue.replace(/'/g, "\\'")}'`
					: `$exists(\`${firstKey}\`)`;
			}
		}

		let existingExclusion = null;
		const excludedBy = selectedLog.excluded_by;
		if (excludedBy) {
			try {
				existingExclusion = await api.getExclusion(excludedBy.id);
			} catch (e) {
				console.error('Failed to load existing exclusion:', e);
			}
		}

		if (existingExclusion && excludedBy) {
			const decrypted = await decryptExclusion(existingExclusion, excludedBy.group.id);
			exclusionName = decrypted.name;
			exclusionQuery = decrypted.jsonata_query;
			exclusionDescription = decrypted.description;
			exclusionType = (existingExclusion.exclusion_type as 'hard' | 'soft') || 'hard';
			exclusionEncrypted = existingExclusion.encrypted || false;
			selectedGroupId = excludedBy.group.id;
			editingExclusion = existingExclusion;
		} else {
			editingExclusion = null;
			exclusionName = `Exclude ${ruleName || 'alert'}`;
			exclusionQuery = suggestedQuery;
			exclusionDescription = `Created from alert on ${new Date(selectedLog.time).toLocaleString()}`;
			if (userGroups.length > 0) {
				selectedGroupId = userGroups[0].id;
			} else {
				selectedGroupId = null;
			}
		}

		showExclusionModal = true;
	}

	async function saveExclusionFromAlert(): Promise<void> {
		if (!selectedGroupId || !exclusionName.trim() || !exclusionQuery.trim()) {
			showError('Group, name, and JSONata query are required');
			return;
		}

		try {
			const groupDetail = await api.getGroup(selectedGroupId);
			const { name: finalName, jsonata_query: finalQuery, description: finalDesc } = await encryptExclusion(
				exclusionName.trim(),
				exclusionQuery.trim(),
				exclusionDescription.trim() || null,
				exclusionEncrypted,
				groupDetail.public_key
			);

			const data: ExclusionCreate = {
				name: finalName,
				jsonata_query: finalQuery,
				description: finalDesc,
				alert_id: selectedLog ? selectedLog.id : null,
				exclusion_type: exclusionType,
				encrypted: exclusionEncrypted
			};

			if (editingExclusion) {
				await api.deleteExclusion(editingExclusion.id);
			}
			const newExclusion = await api.createExclusion(selectedGroupId, data);
			showExclusionModal = false;
			showFlash(editingExclusion ? 'Exclusion updated' : 'Exclusion created from alert');

			if (selectedLog) {
				const groupObj = userGroups.find((g) => g.id === selectedGroupId);
				selectedLog.excluded_by = {
					id: newExclusion.id,
					group: {
						id: selectedGroupId,
						name: groupObj ? groupObj.name : 'Group'
					}
				};
			}

			exclusionName = '';
			exclusionQuery = '';
			exclusionDescription = '';
			exclusionType = 'hard';
			selectedGroupId = null;
			exclusionEncrypted = false;
			editingExclusion = null;
		} catch (e) {
			showError('Failed to save exclusion: ' + (e as Error).message);
		}
	}

	let showTriggeredRuleModal = $state(false);

	function openTriggeredRule() {
		if (!selectedLog?.triggered_rule) return;
		showTriggeredRuleModal = true;
	}

	let showAiConsentModal = $state(false);

	function getAiToolDetails(tool: string) {
		const map: Record<string, { name: string; domain: string }> = {
			'lumo-guest': { name: 'Proton Lumo (Guest mode)', domain: 'lumo.proton.me' },
			'lumo-member': { name: 'Proton Lumo (Logged-in mode)', domain: 'lumo.proton.me' },
			'mistral': { name: 'Mistral AI', domain: 'chat.mistral.ai' },
			'claude': { name: 'Anthropic Claude', domain: 'claude.ai' },
			'chatgpt': { name: 'OpenAI ChatGPT', domain: 'chatgpt.com' },
			'duckduckgo': { name: 'DuckDuckGo AI Chat', domain: 'duck.ai/chat' },
			'kagi': { name: 'Kagi Assistant', domain: 'kagi.com/assistant' }
		};
		return map[tool] ?? map['lumo-guest'];
	}

	function getAiAnalysisUrl(tool: string, promptText: string): string {
		switch (tool) {
			case 'lumo-guest':
				return `https://lumo.proton.me/guest?q=${encodeURIComponent(promptText)}`;
			case 'lumo-member':
				return `https://lumo.proton.me/?q=${encodeURIComponent(promptText)}`;
			case 'mistral':
				return `https://chat.mistral.ai/chat?q=${encodeURIComponent(promptText)}`;
			case 'claude':
				return `https://claude.ai/new?q=${encodeURIComponent(promptText)}`;
			case 'chatgpt':
				return `https://chatgpt.com/?q=${encodeURIComponent(promptText)}`;
			case 'duckduckgo':
				return `https://duck.ai/chat?q=${encodeURIComponent(promptText)}`;
			case 'kagi':
				return `https://kagi.com/assistant?q=${encodeURIComponent(promptText)}`;
			default:
				return `https://lumo.proton.me/guest?q=${encodeURIComponent(promptText)}`;
		}
	}

	function runAiAnalysis() {
		if (!selectedLog || !logManager) return;
		
		const tool = $user?.ai_analysis_tool || 'lumo-guest';
		const consentKey = `radegast_ai_consent_${tool}`;
		const hasConsent = typeof window !== 'undefined' && 
			(localStorage.getItem(consentKey) === 'true' || 
			 (tool.startsWith('lumo') && localStorage.getItem('radegast_proton_lumo_consent') === 'true'));
			 
		if (hasConsent) {
			openAiAnalysisLink();
		} else {
			showAiConsentModal = true;
		}
	}

	function openAiAnalysisLink() {
		if (!selectedLog || !logManager) return;
		const alertObj = logManager.getAlertObject(selectedLog);
		const telemetry = JSON.stringify(alertObj.alert);
		let ruleContext = '';
		if (selectedLog.triggered_rule) {
			ruleContext = `\n\nTriggered Rule:\nType: ${selectedLog.triggered_rule.rule_type}\nID: ${selectedLog.triggered_rule.rule_id}\nContent:\n${selectedLog.triggered_rule.rule_content}`;
		}
		const promptText = `Analyze if this alert is a true or false positive in plain non-technical language.
							If you deem this alert to be a false positive, propose a JSONata query that could be used to exclude this alert in the future, and explain your reasoning for the proposed query. The query should depend on rule ID or rule name if available and should be a flat expression (e.g. \`rule.name\` = 'Disable Or Stop Services' and $contains(\`process.parent.command_line\`, "/usr/lib/snapd/snapd"). DO NOT FORGET THE BACKTICKS AROUND FIELD NAMES. If unsure, check the JSONata syntax at https://docs.jsonata.org/)
							The exclusion should match the alert (exclusions are always matching) and should be generic enough to cover similar use cases but not too generic to avoid over-permissive detections. If you cannot determine a good exclusion query, say "No good exclusion query can be determined".
							\n\n${telemetry}${ruleContext}`;
		
		const tool = $user?.ai_analysis_tool || 'lumo-guest';
		
		if (typeof navigator !== 'undefined' && navigator.clipboard) {
			navigator.clipboard.writeText(promptText).catch(() => {});
		}
		
		const url = getAiAnalysisUrl(tool, promptText);
		window.open(url, '_blank');
	}

	function handleConsentYes() {
		const tool = $user?.ai_analysis_tool || 'lumo-guest';
		const consentKey = `radegast_ai_consent_${tool}`;
		if (typeof window !== 'undefined') {
			localStorage.setItem(consentKey, 'true');
			if (tool.startsWith('lumo')) {
				localStorage.setItem('radegast_proton_lumo_consent', 'true');
			}
		}
		showAiConsentModal = false;
		openAiAnalysisLink();
	}

	function exportToJsonl() {
		const lm = logManager;
		if (!lm) return;
		const lines = lm.filteredLogs.map(log => {
			const alertObj = lm.getAlertObject(log);
			return JSON.stringify(alertObj);
		});
		const blob = new Blob([lines.join('\n')], { type: 'application/x-jsonlines' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `alerts_export_${new Date().toISOString().slice(0, 10)}.jsonl`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	}

</script>

<svelte:head>
	<title>Threat Triage - Radegast</title>
</svelte:head>

<div class="alerts-page-wrapper">
	<div class="d-flex justify-content-between align-items-center mb-3 border-bottom pb-3">
		<h2 class="mb-0 fw-bold">Threat Triage</h2>
		{#if $user}
			{#if $user.extended_edr_enabled}
				<div class="d-flex gap-2">
					{#if logManager && logManager.filteredLogs.length > 0}
						<button 
							class="btn btn-outline-secondary btn-sm fw-bold" 
							onclick={exportToJsonl}
						>
							Export JSONL
						</button>
					{/if}
					<button 
						class="btn btn-outline-primary btn-sm fw-bold" 
						onclick={markAllSeen}
						disabled={!logManager || logManager.loading || logManager.filteredLogs.length === 0}
					>
						Resolve All as Read
					</button>
				</div>
			{:else}
				<button 
					class="btn btn-outline-primary btn-sm fw-bold" 
					onclick={markAllSeen}
					disabled={!logManager || logManager.loading || logManager.logs.length === 0}
				>
					Mark All as Seen
				</button>
			{/if}
		{/if}
	</div>

	{#if !logManager || logManager.loading && logManager.logs.length === 0}
		<Spinner centered size="sm" color="primary" text="Loading alerts..." py={5} />
	{:else}
		<div class="alerts-container">
			<!-- Left Pane: Alert List -->
			<div class="left-pane">
			<div class="mb-3">
				<input 
					type="text" 
					class="form-control mb-2" 
					placeholder="Filter alerts (JSONata)..." 
					bind:value={searchQuery}
				/>
				<div class="row g-2">
					<div class="col-6">
						<label for="alerts-from-time" class="form-label small fw-bold mb-1">From</label>
						<input 
							id="alerts-from-time"
							type="datetime-local" 
							class="form-control form-control-sm" 
							bind:value={fromTime}
							onchange={() => logManager?.performSearch(fromTime, toTime, null, 1)}
						/>
					</div>
					<div class="col-6">
						<label for="alerts-to-time" class="form-label small fw-bold mb-1">To</label>
						<input 
							id="alerts-to-time"
							type="datetime-local" 
							class="form-control form-control-sm" 
							bind:value={toTime}
							onchange={() => logManager?.performSearch(fromTime, toTime, null, 1)}
						/>
					</div>
				</div>
			</div>
			
			<div class="alerts-list flex-grow-1 overflow-auto">
				{#each logManager.filteredLogs as log}
					{@const alertObj = logManager.getAlertObject(log)}
					{@const ruleName = alertObj.alert?.['rule.name'] || alertObj.alert?.rule?.name || `An alert on ${alertObj.meta.device || 'Unknown Device'}`}
					{@const isRead = ($user?.extended_edr_enabled ? (!!log.alert_resolution && log.alert_resolution !== 'none') : !!log.seen) || (log.severity && mapSeverityToNumber(log.severity) < mapSeverityToNumber($user?.notification_level))}
					
					<div 
						class="card mb-2 border-0 shadow-sm {selectedLog?.id === log.id ? 'bg-primary text-white' : 'bg-body-tertiary'} {isRead ? 'opacity-75' : 'border-start border-3 border-danger'}" 
						style="cursor: pointer; border-radius: 8px;"
						onclick={() => selectLog(log)}
						onkeydown={(e) => { if (e.key === 'Enter') selectLog(log); }}
						role="button"
						tabindex="0"
					>
						<div class="card-body p-3">
							<div class="d-flex justify-content-between mb-1">
								<span class="fw-bold text-truncate" style="max-width: 70%;">{ruleName}</span>
								<span class="small opacity-75">{formatFullDateTime(log.time)}</span>
							</div>
							<div class="d-flex justify-content-between align-items-center small">
								<span class="opacity-75">{alertObj.meta.device}</span>
								<div class="d-flex gap-1 align-items-center">
									{#if alertObj.meta.excluded_by}
										<a
											href="{base}/groups/{alertObj.meta.excluded_by.group.id}"
											class="badge bg-info text-white text-decoration-none"
											onclick={(e) => e.stopPropagation()}
										>
											Excluded
										</a>
									{/if}
									{#if log.alert_resolution && log.alert_resolution !== 'none'}
										{@const res = log.alert_resolution}
										<span class="badge {res === 'true_positive' ? 'bg-danger' : (res === 'false_positive' ? 'bg-success' : 'bg-secondary')}">
											{res === 'true_positive' ? 'tp' : (res === 'false_positive' ? 'fp' : 'read')}
										</span>
									{:else if !$user?.extended_edr_enabled && log.seen}
										<span class="badge bg-secondary">read</span>
									{/if}
									{#if log.severity}
										<span class="badge {log.severity === 'high' || log.severity === 'critical' ? 'bg-danger' : 'bg-warning text-dark'} text-uppercase">{log.severity}</span>
									{/if}
								</div>
							</div>
						</div>
					</div>
				{/each}
				{#if logManager.filteredLogs.length === 0}
					<div class="text-muted text-center p-4">No alerts found.</div>
				{/if}
			</div>

			<div class="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
				<button 
					class="btn btn-outline-secondary btn-sm fw-bold" 
					disabled={logManager.currentPage <= 1 || logManager.loading}
					onclick={() => logManager?.performSearch(fromTime, toTime, null, logManager.currentPage - 1)}
				>
					&laquo; Prev
				</button>
				<span class="small fw-semibold text-muted">
					Page {logManager.currentPage} of {logManager.totalPages} ({logManager.totalLogs} total)
				</span>
				<button 
					class="btn btn-outline-secondary btn-sm fw-bold" 
					disabled={logManager.currentPage >= logManager.totalPages || logManager.loading}
					onclick={() => logManager?.performSearch(fromTime, toTime, null, logManager.currentPage + 1)}
				>
					Next &raquo;
				</button>
			</div>
		</div>

		<!-- Right Pane: Alert Details -->
		<div class="right-pane">
			{#if selectedLog}
				{@const alertObj = logManager.getAlertObject(selectedLog)}
				{@const alertData = typeof alertObj.alert === 'object' && alertObj.alert !== null ? alertObj.alert : null}

				{#if alertData}
					<AlertDetail
						alert={alertData}
						meta={alertObj.meta}
						triggeredRule={selectedLog.triggered_rule}
						deviceGroups={selectedDeviceDetails?.groups || []}
						{userGroups}
						hasPackWritePermission={hasAnyPackWritePermission}
						extendedEdrEnabled={$user?.extended_edr_enabled ?? false}
						{resolution}
						{triageNote}
						{savingResolution}
						onViewRule={openTriggeredRule}
						onAiAnalysis={runAiAnalysis}
						onCreateExclusion={openCreateExclusionFromAlert}
						onSaveResolution={saveResolution}
						onResolutionChange={(v) => { resolution = v; }}
						onTriageNoteChange={(v) => { triageNote = v; }}
					/>
				{:else}
					<!-- Fallback for non-object alert (encrypted/decryption failed) -->
					<div class="card border-0 shadow-sm mb-3" style="background: var(--bs-body-bg);">
						<div class="card-header bg-transparent border-bottom-0 pt-4 pb-0">
							<h4 class="fw-bold mb-1">Alert #{selectedLog.id}</h4>
							<div class="d-flex gap-3 text-muted small">
								<span><strong>Device:</strong> {alertObj.meta.device}</span>
								<span><strong>Time:</strong> {new Date(selectedLog.time).toLocaleString()}</span>
								<span><strong>Severity:</strong> {selectedLog.severity ? selectedLog.severity.toUpperCase() : 'N/A'}</span>
							</div>
						</div>
						<div class="card-body">
							<pre class="p-3 rounded mb-0 font-monospace" style="background-color: #282a36 !important; color: #f8f8f2 !important; white-space: pre-wrap; word-break: break-all; font-size: 0.85rem; border: 1px solid #44475a;">{typeof alertObj.alert === 'string' ? alertObj.alert : JSON.stringify(alertObj.alert, null, 2)}</pre>
						</div>
					</div>
				{/if}
			{:else}
				<div class="d-flex align-items-center justify-content-center h-100 text-muted">
					Select an alert from the list to view details and triage.
				</div>
			{/if}
		</div>
	</div>
	
	<!-- Create Exclusion Modal -->
	{#if $user}
		<ExclusionModal
			bind:show={showExclusionModal}
			bind:name={exclusionName}
			bind:query={exclusionQuery}
			bind:description={exclusionDescription}
			bind:exclusionType={exclusionType}
			bind:selectedGroupId={selectedGroupId}
			bind:encrypted={exclusionEncrypted}
			title={editingExclusion ? 'Edit Exclusion' : 'Create Exclusion from Alert'}
			isEditMode={!!editingExclusion}
			groups={userGroups}
			alertObj={currentAlertObj}
			onClose={() => { showExclusionModal = false; editingExclusion = null; }}
			onSave={saveExclusionFromAlert}
		/>
	{/if}

	<!-- Triggered Rule Modal -->
	{#if selectedLog?.triggered_rule}
		<Modal
			show={showTriggeredRuleModal}
			title="Triggered Rule"
			onClose={() => { showTriggeredRuleModal = false; }}
		>
			<div class="mb-2 d-flex gap-2 align-items-center">
				<span class="badge bg-warning text-dark text-uppercase">{selectedLog.triggered_rule.rule_type}</span>
				<span class="fw-bold text-body font-monospace small">{selectedLog.triggered_rule.rule_id}</span>
			</div>
			<pre class="p-3 rounded font-monospace mb-0" style="background-color: #282a36; color: #f8f8f2; white-space: pre-wrap; word-break: break-all; font-size: 0.82rem; border: 1px solid #44475a; max-height: 60vh; overflow-y: auto;">{selectedLog.triggered_rule.rule_content}</pre>
		</Modal>
	{/if}

	<!-- AI Consent Modal -->
	<Modal
		show={showAiConsentModal}
		title="Confirm AI Analysis"
		onClose={() => { showAiConsentModal = false; }}
	>
		{@const tool = $user?.ai_analysis_tool || 'lumo-guest'}
		{@const details = getAiToolDetails(tool)}
		<p class="text-body mb-3">
			You are about to send this alert's decrypted raw telemetry to <strong>{details.name}</strong> ({details.domain}) for AI analysis.
		</p>
		<p class="text-body mb-3">
			Please note that the AI's output should be taken only as advice, as the AI model does not have full context of your specific infrastructure.
		</p>
		<p class="text-body mb-4">
			Are you OK with sending your alert data to {details.name}?
		</p>
		<div class="d-flex justify-content-end gap-2">
			<button class="btn btn-outline-secondary" onclick={() => { showAiConsentModal = false; }}>
				No, Cancel
			</button>
			<button class="btn btn-primary" onclick={handleConsentYes}>
				Yes, Proceed
			</button>
		</div>
	</Modal>
{/if}
</div>

<style>
	.alerts-list {
		height: auto;
	}
	.alerts-container {
		height: auto;
	}
	.left-pane {
		border-right: none;
		padding-right: 0 !important;
		margin-bottom: 1.5rem;
	}
	.right-pane {
		padding-left: 0 !important;
	}
	@media (min-width: 768px) {
		.alerts-list {
			height: 0;
		}
		.alerts-page-wrapper {
			display: grid;
			grid-template-rows: auto 1fr;
			height: calc(100vh - 48px);
			overflow: hidden;
		}
		.alerts-container {
			display: grid;
			grid-template-columns: 5fr 7fr;
			grid-template-rows: 100%;
			height: 100%;
			overflow: hidden;
		}
		.left-pane {
			border-right: 1px solid var(--bs-border-color);
			padding-right: 1rem !important;
			margin-bottom: 0;
			height: 100%;
			display: flex;
			flex-direction: column;
			overflow: hidden;
		}
		.right-pane {
			padding-left: 1rem !important;
			height: 100%;
			display: flex;
			flex-direction: column;
			overflow-y: auto;
		}
	}
</style>
