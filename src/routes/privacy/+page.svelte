<script lang="ts">
	import { base } from '$app/paths';
</script>

<svelte:head>
	<title>Privacy Policy - Radegast</title>
</svelte:head>

<div class="row justify-content-center my-5">
	<div class="col-lg-8 card shadow-sm border-0 p-4">
		<h1 class="fw-bold mb-4 text-primary">Privacy Policy</h1>
		<p class="text-muted small">Effective Date: June 14, 2026</p>
		
		<hr class="my-4" />

		<p class="lead text-body">
			This Privacy Policy describes how we collect, use, and process your personal data when you use the Radegast console and agent software (collectively, the "Service").
		</p>
		<p class="text-body">
			Radegast is committed to protecting your privacy and ensuring compliance with the General Data Protection Regulation (GDPR) and other applicable data protection laws.
		</p>

		<section class="my-4">
			<h4 class="fw-bold text-body">1. Data Controller</h4>
			<p class="text-body">
				The "Data Controller" for the processing of your personal data is the maintainer, organization, or administrator of the Radegast console instance you register with. If you have any questions about how your data is handled, please contact your instance administrator directly.
			</p>
		</section>

		<section class="my-4">
			<h4 class="fw-bold text-body">2. Information We Collect and Process</h4>
			<p class="text-body">
				We collect and process only the minimum necessary information required to deliver secure Endpoint Detection and Response (EDR) host management, alerting, and console services.
			</p>
			
			<h5 class="fw-bold fs-6 mt-3 text-body">A. User Account Information</h5>
			<p class="text-body">To register and maintain your console account, we collect:</p>
			<ul>
				<li class="text-body"><strong>Account Credentials:</strong> Your email address and a cryptographically hashed representation of your password.</li>
			</ul>

			<h5 class="fw-bold fs-6 mt-3 text-body">B. Device and Telemetry Metadata</h5>
			<p class="text-body">To manage agent connections and monitor endpoint health, we collect:</p>
			<ul>
				<li class="text-body"><strong>Device Identifiers:</strong> Assigned device names, group allocations, host verification tokens, and public cryptographic keys used to verify host signatures.</li>
				<li class="text-body"><strong>Connection Metadata:</strong> The IP address and <code>last_seen</code> timestamp of host devices when they communicate with the console (e.g., requesting configuration packs or submitting telemetry).</li>
				<li class="text-body"><strong>Device Information Displayed in Console:</strong> On the devices page, we display <strong>OS type and version</strong>, <strong>agent version</strong>, and <strong>rustinel version</strong> for each device to help you manage your fleet.</li>
				<li class="text-body"><strong>Alert Metadata (Unencrypted):</strong> To support console dashboard metrics, log search filtering, and real-time alerts, host devices transmit the <strong>alert severity</strong> and the <strong>triggered rule ID</strong> in an unencrypted format. <em>Note: You can opt out of transmitting this metadata through the agent's local configuration settings.</em></li>
			</ul>

			<h5 class="fw-bold fs-6 mt-3 text-body">C. EDR Log and Alert Payloads (Encrypted)</h5>
			<ul>
				<li class="text-body"><strong>Encrypted Payloads:</strong> Host devices submit security alerts and detailed log payloads to the console. These payloads are encrypted client-side by the agent using your team's public key prior to transmission. The console stores these payloads in their encrypted format. Because we do not hold the corresponding private keys, we cannot read, decode, or inspect the contents of these logs.</li>
			</ul>
		</section>

		<section class="my-4">
			<h4 class="fw-bold text-body">3. Purposes and Legal Bases for Processing</h4>
			<p class="text-body">
				Under the GDPR, we process your personal data under the following legal bases:
			</p>
			<div class="table-responsive mt-3">
				<table class="table table-bordered table-sm">
					<thead>
						<tr class="table-light">
							<th class="text-body">Category of Data</th>
							<th class="text-body">Purpose of Processing</th>
							<th class="text-body">GDPR Legal Basis</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td class="text-body">Account Credentials</td>
							<td class="text-body">Authenticate console sessions, manage settings, and secure account access.</td>
							<td class="text-body"><strong>Performance of a Contract</strong> (Article 6(1)(b) GDPR)</td>
						</tr>
						<tr>
							<td class="text-body">Device Identifiers & Connection Metadata</td>
							<td class="text-body">Maintain secure device pairing, authenticate hosts, and display online/offline status.</td>
							<td class="text-body"><strong>Performance of a Contract</strong> (Article 6(1)(b) GDPR)</td>
						</tr>
						<tr>
							<td class="text-body">Alert Metadata & Payloads</td>
							<td class="text-body">Display dashboard metrics, route security alerts, and store event logs.</td>
							<td class="text-body"><strong>Legitimate Interests</strong> (Article 6(1)(f) GDPR) — specifically, our interest in securing infrastructure and analyzing safety events.</td>
						</tr>
						<tr>
							<td class="text-body">Notification Settings (Email)</td>
							<td class="text-body">Deliver automated system notifications and high-priority security alerts.</td>
							<td class="text-body"><strong>Consent</strong> (Article 6(1)(a) GDPR) — you can opt in/out or modify these alert channels in your settings at any time.</td>
						</tr>
					</tbody>
				</table>
			</div>
		</section>

		<section class="my-4">
			<h4 class="fw-bold text-body">4. Data Sharing and Third-Party Disclosures</h4>
			<p class="text-body">
				We do not sell, rent, trade, or share your personal data or agent telemetry with third-party companies, trackers, or marketing platforms. Data is processed locally within your self-hosted or managed console instance.
			</p>
		</section>

		<section class="my-4">
			<h4 class="fw-bold text-body">5. Data Retention</h4>
			<p class="text-body">
				We retain your personal data only as long as necessary to fulfill the purposes for which it was collected:
			</p>
			<ul>
				<li class="text-body"><strong>User Accounts:</strong> Credentials and user profile details are retained for the duration of your active registration and are deleted upon account closure.</li>
				<li class="text-body"><strong>Agent Logs & Metadata:</strong> Host telemetry, alerts, and metadata are stored in the console database. Deleting a device or a device group immediately and permanently purges all associated historical records and logs.</li>
			</ul>
		</section>

		<section class="my-4">
			<h4 class="fw-bold text-body">6. Security of Your Data</h4>
			<p class="text-body">
				We implement appropriate technical and organizational measures to safeguard your personal data. This includes host-side cryptographic encryption of all sensitive EDR log content prior to transmission, secure password hashing, and token-based API authentication.
			</p>
		</section>

		<section class="my-4">
			<h4 class="fw-bold text-body">7. Your Rights Under GDPR</h4>
			<p class="text-body">
				If you reside in the European Economic Area (EEA), you have the following rights regarding your personal data:
			</p>
			<ul>
				<li class="text-body"><strong>Right of Access:</strong> The right to request copies of the personal data we hold about you.</li>
				<li class="text-body"><strong>Right to Rectification:</strong> The right to request that we correct any inaccurate or incomplete information.</li>
				<li class="text-body"><strong>Right to Erasure:</strong> The right to request the deletion of your personal data under certain legal conditions.</li>
				<li class="text-body"><strong>Right to Restrict Processing:</strong> The right to request that we restrict how we process your data.</li>
				<li class="text-body"><strong>Right to Data Portability:</strong> The right to request that we transfer your collected data to another organization or directly to you.</li>
				<li class="text-body"><strong>Right to Object:</strong> The right to object to our processing of your data based on legitimate interests.</li>
				<li class="text-body"><strong>Right to Withdraw Consent:</strong> The right to withdraw consent for optional communications at any time.</li>
				<li class="text-body"><strong>Right to Lodge a Complaint:</strong> The right to lodge a formal complaint with a competent data protection authority.</li>
			</ul>
			<p class="text-body">
				To exercise any of these rights, please contact your console administrator.
			</p>
		</section>

		<section class="my-4">
			<h4 class="fw-bold text-body">8. Changes to This Policy</h4>
			<p class="text-body">
				We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated "Effective Date."
			</p>
		</section>

		<div class="mt-4 text-center">
			<a href="{base}/register" class="btn btn-outline-primary px-4">Back to Registration</a>
		</div>
	</div>
</div>
