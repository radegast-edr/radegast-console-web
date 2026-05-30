<script>
	import { base } from '$app/paths';
</script>

<svelte:head>
	<title>Terms of Service - Radegast</title>
</svelte:head>

<div class="row justify-content-center my-5">
	<div class="col-lg-8 card shadow-sm border-0 p-4" style="border-radius: 12px;">
		<h1 class="fw-bold mb-4 text-primary">Terms of Service</h1>
		<p class="text-muted small">Last updated: May 30, 2026</p>
		
		<hr class="my-4" />

		<section class="mb-4">
			<h4 class="fw-bold">1. Acceptance of Terms</h4>
			<p>
				By creating an account and registering a host device on Radegast EDR (the "Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not register for or use the Service.
			</p>
		</section>

		<section class="mb-4">
			<h4 class="fw-bold">2. Description of Service</h4>
			<p>
				Radegast EDR is a host monitoring and Endpoint Detection and Response (EDR) management console. The Service enables authorized administrators to manage teams, link device groups, distribute configuration and rule packs, and collect security log/alert payloads from host devices.
			</p>
		</section>

		<section class="mb-4">
			<h4 class="fw-bold">3. Account Registration and Security</h4>
			<p>
				To use the Service, you must register a valid email address and password. You are responsible for maintaining the confidentiality of your account credentials. 
			</p>
			<p>
				<strong>Cryptographic Key Management:</strong> The Service uses client-side end-to-end encryption (the <code>age</code> protocol) to protect EDR log payloads. During registration, your browser generates a public/private key pair automatically. You are provided with a recovery key. You are solely responsible for saving and maintaining your private keys. The Service does not store your plaintext private keys and cannot recover your encrypted data if your keys are lost.
			</p>
		</section>

		<section class="mb-4">
			<h4 class="fw-bold">4. Acceptable Use and Authorization</h4>
			<p>
				You represent and warrant that you own or have explicit authorization to install the EDR monitoring client and collect security logs from any devices/hosts you connect to the Service. Unauthorized monitoring, interception of data, or attempting to bypass the cryptographic protections of other users is strictly prohibited and constitutes a breach of these Terms.
			</p>
		</section>

		<section class="mb-4">
			<h4 class="fw-bold">5. Limitations of Liability</h4>
			<p>
				THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTY OF ANY KIND. In no event shall Radegast EDR, its developers, or contributors be liable for any direct, indirect, incidental, special, or consequential damages (including, but not limited to, host compromises, data loss, or unauthorized access to endpoint systems).
			</p>
		</section>

		<section class="mb-4">
			<h4 class="fw-bold">6. Modifications to Service and Terms</h4>
			<p>
				We reserve the right to modify or terminate the Service or change these Terms at any time. Your continued use of the Service after changes are posted constitutes your acceptance of the revised Terms.
			</p>
		</section>

		<div class="mt-4 text-center">
			<a href="{base}/register" class="btn btn-outline-primary px-4">Back to Registration</a>
		</div>
	</div>
</div>
