import { base } from '$app/paths';
import { PUBLIC_BACKEND_URL as BACKEND_URL_RAW } from '$env/static/public';
import { goto } from '$app/navigation';

let BACKEND_URL = BACKEND_URL_RAW;
if (typeof window !== 'undefined') {
	if (BACKEND_URL_RAW.startsWith('http')) {
		try {
			const url = new URL(BACKEND_URL_RAW);
			if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
				url.hostname = window.location.hostname;
			}
			url.protocol = window.location.protocol;
			BACKEND_URL = url.origin + url.pathname;
		} catch (e) {
			console.error("Failed to parse PUBLIC_BACKEND_URL:", e);
		}
	} else if (BACKEND_URL_RAW.startsWith('/')) {
		BACKEND_URL = window.location.origin + BACKEND_URL_RAW;
	}
}

async function request<T = unknown>(method: string, path: string, body: unknown = null, isFormData = false): Promise<T> {
	const options: RequestInit & { headers: Record<string, string> } = {
		method,
		credentials: 'include',
		headers: {}
	};

	if (body && !isFormData) {
		options.headers['Content-Type'] = 'application/json';
		options.body = JSON.stringify(body);
	} else if (body && isFormData) {
		options.body = body as XMLHttpRequestBodyInit;
	}

	const resp = await fetch(`${BACKEND_URL}${path}`, options);

	if (resp.status === 401 && path !== '/auth/login') {
		// Session expired or not logged in — send to login page
		goto(`${base}/login`);
		throw new Error('Not authenticated');
	}

	if (!resp.ok) {
		const error = await resp.json().catch(() => ({ detail: resp.statusText }));
		// Pydantic validation errors return detail as an array of objects
		interface PydanticErrorDetail {
			msg?: string;
		}
		const detail = Array.isArray(error.detail)
			? (error.detail as PydanticErrorDetail[]).map((e) => e.msg || JSON.stringify(e)).join('; ')
			: error.detail;
		throw new Error(detail || 'Request failed');
	}

	if (resp.headers.get('content-type')?.includes('application/json')) {
		return resp.json() as Promise<T>;
	}
	return resp as unknown as T;
}

export interface UserInfo {
	id: number;
	email: string;
	role: string;
	verified: boolean;
	has_keys: boolean;
	mfa_required_level: string;
	mfa_setup_missing: boolean;
	mfa_configured_level: string;
}

export interface Team {
	id: number;
	name: string;
	permission_pack?: string | null;
	permission_invite?: string | null;
	permission_admin?: string | null;
	permission_logs?: string | null;
	managing_team_id?: number | null;
}

export interface Group {
	id: number;
	name: string;
	teams?: Team[];
	devices?: Device[];
}

export interface Device {
	id: number;
	name: string;
	last_seen?: string;
	groups?: Group[];
	token?: string;
	signature_public_key?: string | null;
}

export interface DeviceCreateResponse {
	id: number;
	name: string;
	token: string;
}

export interface Pack {
	id: number;
	name: string;
	description: string;
	creator_id: number;
	team_ids?: number[];
	teams?: Team[];
}

export interface PackVersion {
	id: number;
	pack_id: number;
	version: string;
	release_notes: string;
	released: string;
}

export interface Log {
	id: number;
	device_id: number;
	content: string;
	seen: boolean;
	time: string;
	signature?: string | null;
}

export interface UserKey {
	id: number;
	public_key: string;
	created_at?: string;
}

export interface KeyRecoverResponse {
	public_key: string;
	encrypted_private_key: string;
}

export interface KeyTransferInitiateResponse {
	transfer_id: string;
}

export interface KeyTransferStatusResponse {
	transfer_id: string;
	status: string;
	receiver_age_public_key: string;
	encrypted_private_key?: string;
}

export interface EnabledPack {
	id: number;
	group_id: number;
	pack_version_id: number;
	pack_name: string;
	autoupdate: boolean;
	version?: string | null;
}

export interface WebAuthnCreationOptionsJSON {
	challenge: string | ArrayBuffer;
	user: {
		id: string | ArrayBuffer;
		name: string;
		displayName: string;
	};
	rp: {
		id?: string;
		name: string;
	};
	pubKeyCredParams: Array<{
		type: string;
		alg: number;
	}>;
	timeout?: number;
	excludeCredentials?: Array<{
		id: string | ArrayBuffer;
		type: string;
		transports?: string[];
	}>;
	authenticatorSelection?: {
		authenticatorAttachment?: string;
		requireResidentKey?: boolean;
		userVerification?: string;
	};
	attestation?: string;
}

export interface WebAuthnRequestOptionsJSON {
	challenge: string | ArrayBuffer;
	timeout?: number;
	rpId?: string;
	allowCredentials?: Array<{
		id: string | ArrayBuffer;
		type: string;
		transports?: string[];
	}>;
	userVerification?: string;
}

export const api = {
	// Auth
	register: (email: string, password: string, turnstile_token: string | null = null): Promise<unknown> =>
		request<unknown>('POST', '/auth/register', { email, password, turnstile_token }),
	login: (email: string, password: string, public_key: string | null = null): Promise<{ token?: string; status?: string; mfa_token?: string; methods?: string[]; mfa_required?: boolean; mfa_required_level?: string; mfa_setup_missing?: boolean }> =>
		request<{ token?: string; status?: string; mfa_token?: string; methods?: string[]; mfa_required?: boolean; mfa_required_level?: string; mfa_setup_missing?: boolean }>('POST', '/auth/login', { email, password, public_key }),
	logout: (): Promise<void> => request<void>('POST', '/auth/logout'),
	me: (): Promise<UserInfo> => request<UserInfo>('GET', '/auth/me'),
	verify: (token: string): Promise<unknown> => request<unknown>('GET', `/auth/verify?token=${token}`),
	setupKeys: (data: unknown): Promise<unknown> => request<unknown>('POST', '/auth/keys/setup', data),
	setupSecondaryKey: (data: unknown): Promise<unknown> => request<unknown>('POST', '/auth/keys/secondary', data),
	deleteKeys: (): Promise<unknown> => request<unknown>('DELETE', '/auth/keys'),
	recoverKeys: (): Promise<KeyRecoverResponse[]> => request<KeyRecoverResponse[]>('GET', '/auth/keys/recover'),
	listKeys: (): Promise<UserKey[]> => request<UserKey[]>('GET', '/auth/keys'),
	addKey: (data: unknown): Promise<unknown> => request<unknown>('POST', '/auth/keys', data),
	deleteKey: (id: string | number): Promise<unknown> => request<unknown>('DELETE', `/auth/keys/${id}`),
	deviceLogin: (token: string): Promise<unknown> => request<unknown>('POST', '/auth/device/login', { token }),
	changePassword: (old_password: string, new_password: string): Promise<unknown> =>
		request<unknown>('POST', '/auth/change-password', { old_password, new_password }),
	getNotifications: (): Promise<unknown> => request<unknown>('GET', '/auth/notifications'),
	updateNotifications: (data: unknown): Promise<unknown> => request<unknown>('PUT', '/auth/notifications', data),

	// Teams
	listTeams: (): Promise<Team[]> => request<Team[]>('GET', '/teams/'),
	createTeam: (data: unknown): Promise<Team> => request<Team>('POST', '/teams/', data),
	getTeam: (id: string | number): Promise<Team> => request<Team>('GET', `/teams/${id}`),
	updateTeam: (id: string | number, data: unknown): Promise<Team> => request<Team>('PUT', `/teams/${id}`, data),
	inviteToTeam: (teamId: string | number, email: string): Promise<unknown> =>
		request<unknown>('POST', `/teams/${teamId}/invite`, { email }),
	listMembers: (teamId: string | number): Promise<UserInfo[]> => request<UserInfo[]>('GET', `/teams/${teamId}/members`),
	removeMember: (teamId: string | number, userId: string | number): Promise<unknown> =>
		request<unknown>('DELETE', `/teams/${teamId}/members/${userId}`),
	listTeamGroups: (teamId: string | number): Promise<Group[]> => request<Group[]>('GET', `/teams/${teamId}/groups`),
	createTeamGroup: (teamId: string | number, name: string): Promise<Group> =>
		request<Group>('POST', `/teams/${teamId}/groups`, { name }),
	linkGroupToTeam: (teamId: string | number, groupId: string | number): Promise<unknown> =>
		request<unknown>('POST', `/teams/${teamId}/groups/${groupId}/link`),
	listTeamDevices: (teamId: string | number): Promise<Device[]> => request<Device[]>('GET', `/teams/${teamId}/devices`),

	// Devices
	createDevice: (name: string, group_id: string | number): Promise<DeviceCreateResponse> =>
		request<DeviceCreateResponse>('POST', '/devices/', { name, group_id }),
	listDevices: (): Promise<Device[]> => request<Device[]>('GET', '/devices/'),
	getDevice: (id: string | number): Promise<Device> => request<Device>('GET', `/devices/${id}`),
	renameDevice: (id: string | number, name: string): Promise<Device> =>
		request<Device>('PATCH', `/devices/${id}`, { name }),
	addDeviceToGroup: (deviceId: string | number, groupId: string | number): Promise<unknown> =>
		request<unknown>('POST', `/devices/${deviceId}/groups/${groupId}`),
	removeDeviceFromGroup: (deviceId: string | number, groupId: string | number): Promise<unknown> =>
		request<unknown>('DELETE', `/devices/${deviceId}/groups/${groupId}`),
	deleteDevice: (deviceId: string | number): Promise<unknown> => request<unknown>('DELETE', `/devices/${deviceId}`),
	reinstallDevice: (deviceId: string | number): Promise<DeviceCreateResponse> => request<DeviceCreateResponse>('POST', `/devices/${deviceId}/reinstall`),

	// Device Groups
	listGroups: (): Promise<Group[]> => request<Group[]>('GET', '/groups/'),
	getGroup: (id: string | number): Promise<Group> => request<Group>('GET', `/groups/${id}`),
	renameGroup: (id: string | number, name: string): Promise<Group> =>
		request<Group>('PATCH', `/groups/${id}`, { name }),
	unlinkGroupFromTeam: (groupId: string | number, teamId: string | number): Promise<unknown> =>
		request<unknown>('DELETE', `/groups/${groupId}/teams/${teamId}`),
	addDeviceToGroupViaGroup: (groupId: string | number, deviceId: string | number): Promise<unknown> =>
		request<unknown>('POST', `/groups/${groupId}/devices/${deviceId}`),
	removeDeviceFromGroupViaGroup: (groupId: string | number, deviceId: string | number): Promise<unknown> =>
		request<unknown>('DELETE', `/groups/${groupId}/devices/${deviceId}`),

	// Packs
	listPacks: (): Promise<Pack[]> => request<Pack[]>('GET', '/packs/'),
	createPack: (name: string, description: string, team_ids: (string | number)[] | null = null): Promise<Pack> =>
		request<Pack>('POST', '/packs/', { name, description, team_ids }),
	updatePack: (id: string | number, name: string, description: string, team_ids: (string | number)[] | null = null): Promise<Pack> =>
		request<Pack>('PATCH', `/packs/${id}`, { name, description, team_ids }),
	deletePack: (id: string | number): Promise<unknown> => request<unknown>('DELETE', `/packs/${id}`),
	getPack: (id: string | number): Promise<Pack> => request<Pack>('GET', `/packs/${id}`),
	listVersions: (packId: string | number): Promise<PackVersion[]> => request<PackVersion[]>('GET', `/packs/${packId}/versions`),
	downloadVersion: (versionId: string | number): Promise<Response> => request<Response>('GET', `/packs/download/${versionId}`),
	uploadVersion: (packId: string | number, version: string, file: File, releaseNotes = ''): Promise<PackVersion> => {
		const formData = new FormData();
		formData.append('file', file);
		if (releaseNotes) {
			formData.append('release_notes', releaseNotes);
		}
		return request<PackVersion>('POST', `/packs/${packId}/versions?version=${version}`, formData, true);
	},
	enablePack: (groupId: string | number, packVersionId: string | number, autoupdate = true): Promise<unknown> =>
		request<unknown>('POST', `/packs/groups/${groupId}/enable`, {
			pack_version_id: packVersionId,
			autoupdate
		}),
	listEnabledPacks: (groupId: string | number): Promise<EnabledPack[]> => request<EnabledPack[]>('GET', `/packs/groups/${groupId}/enabled`),
	disablePack: (groupId: string | number, enabledId: string | number): Promise<unknown> =>
		request<unknown>('DELETE', `/packs/groups/${groupId}/enabled/${enabledId}`),

	// Key transfer
	transferInitiate: (receiver_age_public_key: string): Promise<KeyTransferInitiateResponse> =>
		request<KeyTransferInitiateResponse>('POST', '/auth/keys/transfer/initiate', { receiver_age_public_key }),
	transferGet: (id: string | number): Promise<KeyTransferStatusResponse> =>
		request<KeyTransferStatusResponse>('GET', `/auth/keys/transfer/${id}`),
	transferComplete: (id: string | number, encrypted_private_key: string): Promise<unknown> =>
		request<unknown>('POST', `/auth/keys/transfer/${id}/complete`, { encrypted_private_key }),

	// Logs
	listLogs: (page = 1, limit = 100, deviceId: string | number | null = null): Promise<Log[]> => {
		let url = `/logs/?page=${page}&limit=${limit}`;
		if (deviceId) url += `&device_id=${deviceId}`;
		return request<Log[]>('GET', url);
	},
	getUnreadLogsCount: (): Promise<{ unread_count: number }> => request<{ unread_count: number }>('GET', '/logs/unread-count'),
	markLogSeen: (id: string | number): Promise<unknown> => request<unknown>('POST', `/logs/${id}/seen`),
	markAllLogsSeen: (): Promise<unknown> => request<unknown>('POST', '/logs/seen/all'),

	// Releases
	listReleases: (): Promise<unknown[]> => request<unknown[]>('GET', '/releases/'),
	uploadRelease: (version: string, os: string, arch: string, file: File): Promise<unknown> => {
		const fd = new FormData();
		fd.append('version', version);
		fd.append('os', os);
		fd.append('arch', arch);
		fd.append('file', file);
		return request<unknown>('POST', '/releases/', fd, true);
	},
	deleteRelease: (version: string, os: string, arch: string): Promise<unknown> =>
		request<unknown>('DELETE', `/releases/${encodeURIComponent(version)}/${encodeURIComponent(os)}/${encodeURIComponent(arch)}`),
	downloadReleaseUrl: (version: string, os: string, arch: string): string =>
		`${BACKEND_URL}/releases/${encodeURIComponent(version)}/${encodeURIComponent(os)}/${encodeURIComponent(arch)}/download`,

	// Auth — email verification
	verifyEmail: (token: string): Promise<unknown> => request<unknown>('GET', `/auth/verify?token=${encodeURIComponent(token)}`),
	unsubscribe: (token: string): Promise<{ message?: string }> => request<{ message?: string }>('POST', '/auth/unsubscribe', { token }),

	// MFA
	getMfaSettings: (): Promise<unknown> => request<unknown>('GET', '/auth/mfa/settings'),
	setupMfaOtp: (): Promise<{ secret: string; qr_code?: string }> => request<{ secret: string; qr_code?: string }>('POST', '/auth/mfa/otp/setup'),
	verifyMfaOtp: (code: string): Promise<unknown> => request<unknown>('POST', '/auth/mfa/otp/verify', { code }),
	disableMfaOtp: (): Promise<unknown> => request<unknown>('POST', '/auth/mfa/otp/disable'),
	setupMfaHardwareToken: (): Promise<{ options: WebAuthnCreationOptionsJSON; registration_token: string }> => request<{ options: WebAuthnCreationOptionsJSON; registration_token: string }>('POST', '/auth/mfa/hardware-token/setup'),
	verifyMfaHardwareToken: (registration_token: string, credential_response: unknown, name: string | null = null): Promise<unknown> =>
		request<unknown>('POST', '/auth/mfa/hardware-token/verify', { registration_token, credential_response, name }),
	deleteMfaHardwareToken: (id: string | number): Promise<unknown> => request<unknown>('DELETE', `/auth/mfa/hardware-token/${id}`),
	getMfaHardwareTokenAssertionOptions: (mfa_token: string): Promise<{ options: WebAuthnRequestOptionsJSON; assertion_token: string }> =>
		request<{ options: WebAuthnRequestOptionsJSON; assertion_token: string }>('POST', '/auth/mfa/hardware-token/assertion-options', { mfa_token }),
	verifyMfa: (mfa_token: string, method: string, otp_code: string | null = null, assertion_token: string | null = null, webauthn_response: unknown = null): Promise<{ token?: string }> =>
		request<{ token?: string }>('POST', '/auth/mfa/verify', { mfa_token, method, otp_code, assertion_token, webauthn_response }),

	// Admin
	adminListUsers: (): Promise<UserInfo[]> => request<UserInfo[]>('GET', '/admin/users'),
	adminDeleteUser: (id: string | number): Promise<unknown> => request<unknown>('DELETE', `/admin/users/${id}`),
	adminResetUserPassword: (id: string | number): Promise<{ password?: string }> => request<{ password?: string }>('POST', `/admin/users/${id}/reset-password`),
	adminListDevices: (): Promise<Device[]> => request<Device[]>('GET', '/admin/devices'),
	adminDeleteDevice: (id: string | number): Promise<unknown> => request<unknown>('DELETE', `/admin/devices/${id}`),
	adminListPacks: (): Promise<Pack[]> => request<Pack[]>('GET', '/admin/packs'),
	adminDeletePack: (id: string | number): Promise<unknown> => request<unknown>('DELETE', `/admin/packs/${id}`),
	getAuthConfig: (): Promise<{ turnstile_site_key?: string | null }> => request<{ turnstile_site_key?: string | null }>('GET', '/auth/config'),
	getBackendUrl: (): string => BACKEND_URL
};
