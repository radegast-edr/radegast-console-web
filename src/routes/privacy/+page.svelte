<script lang="ts">
	import { base } from '$app/paths';
</script>

<svelte:head>
	<title>Privacy Policy - Radegast</title>
</svelte:head>

<div class="row justify-content-center my-5">
	<div class="col-lg-8 card shadow-sm border-0 p-4" style="border-radius: 12px;">
		<h1 class="fw-bold mb-4 text-primary">Privacy Policy</h1>
		<p class="text-muted small">Last updated: May 30, 2026</p>
		
		<hr class="my-4" />

		<section class="mb-4">
			<h4 class="fw-bold">1. Information We Collect</h4>
			<p>
				We collect only the minimum amount of personal and technical information necessary to provide EDR host management and alerting:
			</p>
			<ul>
				<li>
					<strong>Account Credentials:</strong> Email address and cryptographically hashed passwords.
				</li>
				<li>
					<strong>Device Identifiers:</strong> Device names, group assignments, verification tokens, and signature public keys.
				</li>
				<li>
					<strong>Connection Metadata:</strong> We record the <code>last_seen</code> timestamp and IP address of host devices whenever they request configuration packs or submit log entries.
				</li>
				<li>
					<strong>EDR Alert & Log Payloads:</strong> Host devices submit security alerts/log payloads. 
					<strong>Important:</strong> These payloads are encrypted client-side by the host using your team's public key prior to upload. The platform stores this data in encrypted format and lacks the keys required to read, decode, or inspect the contents of your logs.
				</li>
			</ul>
		</section>

		<section class="mb-4">
			<h4 class="fw-bold">2. How We Use the Information</h4>
			<p>
				The collected information is used solely to:
			</p>
			<ul>
				<li>Authenticate your account session and manage your EDR consoles.</li>
				<li>Monitor device online/offline status in the console view.</li>
				<li>Verify integrity signatures on host alerts.</li>
				<li>Send email communications (such as user login alerts, recovery key activations, key transfer updates, device log summaries, and platform downtime and maintenance alerts) based on the preferences you select in your notification settings.</li>
			</ul>
		</section>

		<section class="mb-4">
			<h4 class="fw-bold">3. Data Retention and Deletion</h4>
			<p>
				Hashed user credentials and public keys are stored indefinitely as long as your account remains active.
			</p>
			<p>
				Alert logs and telemetry uploaded by host devices are persisted in the database. When you delete a device or group, its associated log history is removed.
			</p>
		</section>

		<section class="mb-4">
			<h4 class="fw-bold">4. Data Sharing and Third Parties</h4>
			<p>
				We do not share, sell, distribute, or expose any collected data or host logs to third-party services, trackers, or marketing platforms.
			</p>
		</section>

		<section class="mb-4">
			<h4 class="fw-bold">5. Contact Information</h4>
			<p>
				For questions regarding this Privacy Policy or data security, please contact your platform maintainer or administrator.
			</p>
		</section>

		<div class="mt-4 text-center">
			<a href="{base}/register" class="btn btn-outline-primary px-4">Back to Registration</a>
		</div>
	</div>
</div>
