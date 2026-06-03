import { base } from '$app/paths';
import { PUBLIC_BACKEND_URL as BACKEND_URL_RAW } from '$env/static/public';
import { goto } from '$app/navigation';
import createClient, { type Middleware } from 'openapi-fetch';
import type { components, paths, operations } from './openapi.d.ts';
import openapi from './openapi.json';

// ---------------------------------------------------------------------------
// Resolve backend base URL (handles localhost → actual hostname in dev)
// ---------------------------------------------------------------------------

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
			console.error('Failed to parse PUBLIC_BACKEND_URL:', e);
		}
	} else if (BACKEND_URL_RAW.startsWith('/')) {
		BACKEND_URL = window.location.origin + BACKEND_URL_RAW;
	}
}

// ---------------------------------------------------------------------------
// openapi-fetch client
// ---------------------------------------------------------------------------

export const client = createClient<paths>({ baseUrl: BACKEND_URL, credentials: 'include' });

// Middleware: redirect to /login on 401, throw readable errors on all failures
// noinspection JSUnusedGlobalSymbols
const errorMiddleware: Middleware = {
	async onResponse({ response, request }) {
		if (response.status === 401 && !request.url.endsWith('/auth/login')) {
			await goto(`${base}/login`);
			throw new Error('Not authenticated');
		}
		if (!response.ok) {
			const error = await response.json().catch(() => ({ detail: response.statusText }));
			interface PydanticErrorDetail { msg?: string; }
			const detail = Array.isArray(error.detail)
				? (error.detail as PydanticErrorDetail[]).map((e) => e.msg || JSON.stringify(e)).join('; ')
				: error.detail;
			throw new Error(detail || 'Request failed');
		}
		return response;
	}
};
client.use(errorMiddleware);

// ---------------------------------------------------------------------------
// Helper: unwrap the openapi-fetch response (data is always present after the
// middleware above throws on errors).
// ---------------------------------------------------------------------------

async function call<T>(p: Promise<{ data?: T; error?: unknown }>): Promise<T> {
	const { data } = await p;
	return data as T;
}

// ---------------------------------------------------------------------------
// Resolve paths and methods dynamically using operationId from openapi.json
// ---------------------------------------------------------------------------

const operationMap: Record<string, { path: string; method: string }> = {};

for (const [path, pathObj] of Object.entries(openapi.paths || {})) {
	for (const [method, operationObj] of Object.entries(pathObj || {})) {
		if (operationObj && typeof operationObj === 'object' && 'operationId' in operationObj) {
			const opId = operationObj.operationId as string;
			operationMap[opId] = { path, method: method.toUpperCase() };
		}
	}
}

export function getRoute<OpId extends keyof operations>(operationId: OpId): { path: string; method: string } {
	const route = operationMap[operationId as string];
	if (!route) {
		throw new Error(`Route not found for operation ID: ${operationId as string}`);
	}
	return route;
}

export function getInterpolatedRoute<OpId extends keyof operations>(
	operationId: OpId,
	pathParams?: Record<string, string | number>
): { path: string; method: string } {
	const { path, method } = getRoute(operationId);
	let interpolatedPath = path;
	if (pathParams) {
		for (const [key, value] of Object.entries(pathParams)) {
			interpolatedPath = interpolatedPath.replace(`{${key}}`, encodeURIComponent(String(value)));
		}
	}
	return { path: interpolatedPath, method };
}

async function callOp<OpId extends keyof operations>(
	operationId: OpId,
	options?: any
): Promise<any> {
	const { path, method } = getRoute(operationId);
	return (client as any)[method](path, options);
}

// ---------------------------------------------------------------------------
// Exported type aliases (derived from the generated schema)
// ---------------------------------------------------------------------------

export type UserInfo = components['schemas']['UserResponse'];
export type Team = components['schemas']['TeamResponse'];
export type Group = components['schemas']['DeviceGroupResponse'];
export type Device = components['schemas']['DeviceResponse'];
export type DeviceDetail = components['schemas']['DeviceDetailResponse'];
export type DeviceCreateResponse = components['schemas']['DeviceCreateResponse'];
export type Pack = components['schemas']['PackResponse'];
export type PackVersion = components['schemas']['PackVersionResponse'];
export type Log = components['schemas']['LogResponse'];
export type UserKey = components['schemas']['PublicKeyResponse'];
export type KeyRecoverResponse = components['schemas']['KeyRecoverResponse'];
export type KeyTransferInitiateResponse = components['schemas']['KeyTransferInitiateResponse'];
export type KeyTransferStatusResponse = components['schemas']['KeyTransferStatusResponse'];
export type EnabledPack = components['schemas']['PackEnabledResponse'];
export type MfaSettings = components['schemas']['MfaSettingsResponse'];
export type NotificationSettings = components['schemas']['NotificationSettings'];

// ---------------------------------------------------------------------------
// API surface
// ---------------------------------------------------------------------------

export const api = {
	// Auth
	register: (email: string, password: string, turnstile_token: string | null = null) =>
		call(callOp('register_api_v1_auth_register_post', { body: { email, password, turnstile_token } })),

	login: (email: string, password: string, public_key: string | null = null) =>
		call(callOp('login_api_v1_auth_login_post', { body: { email, password, public_key } })),

	logout: () =>
		call(callOp('logout_api_v1_auth_logout_post', {})),

	me: (): Promise<UserInfo> =>
		call(callOp('me_api_v1_auth_me_get', {})),

	verify: (token: string) =>
		call(callOp('verify_email_api_v1_auth_verify_get', { params: { query: { token } } })),

	setupKeys: (body: components['schemas']['KeySetupRequest']) =>
		call(callOp('setup_keys_api_v1_auth_keys_setup_post', { body })),

	setupSecondaryKey: (body: components['schemas']['KeySecondarySetupRequest']) =>
		call(callOp('setup_secondary_key_api_v1_auth_keys_secondary_post', { body })),

	deleteKeys: () =>
		call(callOp('delete_all_keys_api_v1_auth_keys_delete', {})),

	recoverKeys: (): Promise<KeyRecoverResponse[]> =>
		call(callOp('recover_keys_api_v1_auth_keys_recover_get', {})),

	listKeys: (): Promise<UserKey[]> =>
		call(callOp('list_user_keys_api_v1_auth_keys_get', {})),

	addKey: (body: components['schemas']['PublicKeyAddRequest']) =>
		call(callOp('add_user_key_api_v1_auth_keys_post', { body })),

	deleteKey: (key_id: number) =>
		call(callOp('delete_user_key_api_v1_auth_keys__key_id__delete', { params: { path: { key_id } } })),

	deviceLogin: (token: string) =>
		call(callOp('device_login_api_v1_auth_device_login_post', { body: { token } })),

	changePassword: (old_password: string, new_password: string) =>
		call(callOp('change_password_api_v1_auth_change_password_post', { body: { old_password, new_password } })),

	getNotifications: (): Promise<NotificationSettings> =>
		call(callOp('get_notifications_api_v1_auth_notifications_get', {})),

	updateNotifications: (body: NotificationSettings) =>
		call(callOp('update_notifications_api_v1_auth_notifications_put', { body })),

	// Teams
	listTeams: (): Promise<Team[]> =>
		call(callOp('list_teams_api_v1_teams__get', {})),

	createTeam: (body: components['schemas']['TeamCreate']): Promise<Team> =>
		call(callOp('create_team_api_v1_teams__post', { body })),

	getTeam: (team_id: number): Promise<Team> =>
		call(callOp('get_team_api_v1_teams__team_id__get', { params: { path: { team_id } } })),

	updateTeam: (team_id: number, body: components['schemas']['TeamUpdate']): Promise<Team> =>
		call(callOp('update_team_api_v1_teams__team_id__put', { params: { path: { team_id } }, body })),

	inviteToTeam: (team_id: number, email: string) =>
		call(callOp('invite_to_team_api_v1_teams__team_id__invite_post', { params: { path: { team_id } }, body: { email } })),

	listMembers: (team_id: number): Promise<UserInfo[]> =>
		call(callOp('list_members_api_v1_teams__team_id__members_get', { params: { path: { team_id } } })),

	removeMember: (team_id: number, user_id: number) =>
		call(callOp('remove_member_api_v1_teams__team_id__members__user_id__delete', { params: { path: { team_id, user_id } } })),

	listTeamGroups: (team_id: number): Promise<Group[]> =>
		call(callOp('list_team_groups_api_v1_teams__team_id__groups_get', { params: { path: { team_id } } })),

	createTeamGroup: (team_id: number, name: string): Promise<Group> =>
		call(callOp('create_team_group_api_v1_teams__team_id__groups_post', { params: { path: { team_id } }, body: { name } })),

	linkGroupToTeam: (team_id: number, group_id: number) =>
		call(callOp('link_group_to_team_api_v1_teams__team_id__groups__group_id__link_post', { params: { path: { team_id, group_id } } })),

	listTeamDevices: (team_id: number): Promise<Device[]> =>
		call(callOp('list_team_devices_api_v1_teams__team_id__devices_get', { params: { path: { team_id } } })),

	// Devices
	createDevice: (name: string, group_id: number): Promise<DeviceCreateResponse> =>
		call(callOp('create_device_api_v1_devices__post', { body: { name, group_id } })),

	listDevices: (): Promise<Device[]> =>
		call(callOp('list_devices_api_v1_devices__get', {})),

	getDevice: (device_id: number): Promise<DeviceDetail> =>
		call(callOp('get_device_api_v1_devices__device_id__get', { params: { path: { device_id } } })),

	renameDevice: (device_id: number, name: string): Promise<Device> =>
		call(callOp('rename_device_api_v1_devices__device_id__patch', { params: { path: { device_id } }, body: { name } })),

	addDeviceToGroup: (device_id: number, group_id: number) =>
		call(callOp('add_device_to_group_api_v1_devices__device_id__groups__group_id__post', { params: { path: { device_id, group_id } } })),

	removeDeviceFromGroup: (device_id: number, group_id: number) =>
		call(callOp('remove_device_from_group_api_v1_devices__device_id__groups__group_id__delete', { params: { path: { device_id, group_id } } })),

	deleteDevice: (device_id: number) =>
		call(callOp('delete_device_api_v1_devices__device_id__delete', { params: { path: { device_id } } })),

	reinstallDevice: (device_id: number): Promise<DeviceCreateResponse> =>
		call(callOp('reinstall_device_api_v1_devices__device_id__reinstall_post', { params: { path: { device_id } } })),

	// Device Groups
	listGroups: (): Promise<Group[]> =>
		call(callOp('list_groups_api_v1_groups__get', {})),

	getGroup: (group_id: number): Promise<Group> =>
		call(callOp('get_group_api_v1_groups__group_id__get', { params: { path: { group_id } } })),

	renameGroup: (group_id: number, name: string): Promise<Group> =>
		call(callOp('rename_group_api_v1_groups__group_id__patch', { params: { path: { group_id } }, body: { name } })),

	unlinkGroupFromTeam: (group_id: number, team_id: number) =>
		call(callOp('unlink_group_from_team_api_v1_groups__group_id__teams__team_id__delete', { params: { path: { group_id, team_id } } })),

	addDeviceToGroupViaGroup: (group_id: number, device_id: number) =>
		call(callOp('add_device_to_group_api_v1_groups__group_id__devices__device_id__post', { params: { path: { group_id, device_id } } })),

	removeDeviceFromGroupViaGroup: (group_id: number, device_id: number) =>
		call(callOp('remove_device_from_group_api_v1_groups__group_id__devices__device_id__delete', { params: { path: { group_id, device_id } } })),

	// Packs
	listPacks: (): Promise<Pack[]> =>
		call(callOp('list_packs_api_v1_packs__get', {})),

	createPack: (name: string, description: string, team_ids: number[] | null = null): Promise<Pack> =>
		call(callOp('create_pack_api_v1_packs__post', { body: { name, description, team_ids } })),

	updatePack: (pack_id: number, name: string, description: string, team_ids: number[] | null = null): Promise<Pack> =>
		call(callOp('update_pack_api_v1_packs__pack_id__patch', { params: { path: { pack_id } }, body: { name, description, team_ids } })),

	deletePack: (pack_id: number) =>
		call(callOp('delete_pack_api_v1_packs__pack_id__delete', { params: { path: { pack_id } } })),

	getPack: (pack_id: number): Promise<Pack> =>
		call(callOp('get_pack_api_v1_packs__pack_id__get', { params: { path: { pack_id } } })),

	listVersions: (pack_id: number): Promise<PackVersion[]> =>
		call(callOp('list_versions_api_v1_packs__pack_id__versions_get', { params: { path: { pack_id } } })),

	downloadVersion: (version_id: number): Promise<Response> =>
		call(callOp('download_pack_for_user_api_v1_packs_download__version_id__get', { params: { path: { version_id } }, parseAs: 'stream' })),

	uploadVersion: (pack_id: number, version: string, file: File, release_notes = ''): Promise<PackVersion> => {
		const body = new FormData();
		body.append('file', file);
		if (release_notes) body.append('release_notes', release_notes);
		return call(
			callOp('upload_version_api_v1_packs__pack_id__versions_post', {
				params: { path: { pack_id }, query: { version } },
				body: body as unknown as components['schemas']['Body_upload_version_api_v1_packs__pack_id__versions_post'],
				bodySerializer: (b: unknown) => b as FormData
			})
		);
	},

	enablePack: (group_id: number, pack_version_id: number, autoupdate = true) =>
		call(callOp('enable_pack_for_group_api_v1_packs_groups__group_id__enable_post', {
			params: { path: { group_id } },
			body: { pack_version_id, autoupdate }
		})),

	listEnabledPacks: (group_id: number): Promise<EnabledPack[]> =>
		call(callOp('list_enabled_packs_api_v1_packs_groups__group_id__enabled_get', { params: { path: { group_id } } })),

	disablePack: (group_id: number, enabled_id: number) =>
		call(callOp('disable_pack_api_v1_packs_groups__group_id__enabled__enabled_id__delete', { params: { path: { group_id, enabled_id } } })),

	// Key transfer
	transferInitiate: (receiver_age_public_key: string): Promise<KeyTransferInitiateResponse> =>
		call(callOp('initiate_key_transfer_api_v1_auth_keys_transfer_initiate_post', { body: { receiver_age_public_key } })),

	transferGet: (transfer_id: string): Promise<KeyTransferStatusResponse> =>
		call(callOp('get_key_transfer_api_v1_auth_keys_transfer__transfer_id__get', { params: { path: { transfer_id } } })),

	transferComplete: (transfer_id: string, encrypted_private_key: string) =>
		call(callOp('complete_key_transfer_api_v1_auth_keys_transfer__transfer_id__complete_post', {
			params: { path: { transfer_id } },
			body: { encrypted_private_key }
		})),

	// Logs
	listLogs: (page = 1, limit = 100, device_id: number | null = null): Promise<Log[]> =>
		call(callOp('list_logs_api_v1_logs__get', { params: { query: { page, limit, ...(device_id ? { device_id } : {}) } } })),

	getUnreadLogsCount: (): Promise<{ unread_count: number }> =>
		call(callOp('get_unread_logs_count_api_v1_logs_unread_count_get', {})),

	markLogSeen: (log_id: number) =>
		call(callOp('mark_log_seen_api_v1_logs__log_id__seen_post', { params: { path: { log_id } } })),

	markAllLogsSeen: () =>
		call(callOp('mark_all_logs_seen_api_v1_logs_seen_all_post', {})),

	// Releases
	listReleases: () =>
		call(callOp('list_releases_api_v1_releases__get', {})),

	uploadRelease: (version: string, os: string, arch: string, file: File) => {
		const body = new FormData();
		body.append('version', version);
		body.append('os', os);
		body.append('arch', arch);
		body.append('file', file);
		return call(
			callOp('upload_release_api_v1_releases__post', {
				body: body as unknown as components['schemas']['Body_upload_release_api_v1_releases__post'],
				bodySerializer: (b: unknown) => b as FormData
			})
		);
	},

	deleteRelease: (version: string, os_name: string, arch: string) =>
		call(callOp('delete_release_api_v1_releases__version___os_name___arch__delete', { params: { path: { version, os_name, arch } } })),

	// Returns a direct URL for browser navigation / download link (no HTTP call)
	downloadReleaseUrl: (version: string, os_name: string, arch: string): string => {
		const { path } = getInterpolatedRoute('download_release_api_v1_releases__version___os_name___arch__download_get', { version, os_name, arch });
		return `${BACKEND_URL}${path}`;
	},

	// Auth — email verification / unsubscribe
	verifyEmail: (token: string) =>
		call(callOp('verify_email_api_v1_auth_verify_get', { params: { query: { token } } })),

	unsubscribe: (token: string) =>
		call(callOp('unsubscribe_api_v1_auth_unsubscribe_post', { body: { token } })),

	// MFA
	getMfaSettings: (): Promise<MfaSettings> =>
		call(callOp('get_mfa_settings_api_v1_auth_mfa_settings_get', {})),

	setupMfaOtp: () =>
		call(callOp('mfa_otp_setup_api_v1_auth_mfa_otp_setup_post', {})),

	verifyMfaOtp: (code: string) =>
		call(callOp('mfa_otp_verify_api_v1_auth_mfa_otp_verify_post', { body: { code } })),

	disableMfaOtp: () =>
		call(callOp('mfa_otp_disable_api_v1_auth_mfa_otp_disable_post', {})),

	setupMfaHardwareToken: (): Promise<components['schemas']['MfaHardwareTokenSetupResponse']> =>
		call(callOp('mfa_hardware_token_setup_api_v1_auth_mfa_hardware_token_setup_post', {})),

	verifyMfaHardwareToken: (registration_token: string, credential_response: Record<string, unknown>, name: string | null = null) =>
		call(callOp('mfa_hardware_token_verify_api_v1_auth_mfa_hardware_token_verify_post', { body: { registration_token, credential_response, name } })),

	deleteMfaHardwareToken: (hardware_token_id: number) =>
		call(callOp('delete_hardware_token_api_v1_auth_mfa_hardware_token__token_id__delete', { params: { path: { token_id: hardware_token_id } } })),

	getMfaHardwareTokenAssertionOptions: (mfa_token: string): Promise<components['schemas']['MfaHardwareTokenAssertionOptionsResponse']> =>
		call(callOp('mfa_hardware_token_assertion_options_api_v1_auth_mfa_hardware_token_assertion_options_post', { body: { mfa_token } })),

	verifyMfa: (mfa_token: string, method: string, otp_code: string | null = null, assertion_token: string | null = null, webauthn_response: Record<string, unknown> | null = null) =>
		call(callOp('mfa_verify_api_v1_auth_mfa_verify_post', { body: { mfa_token, method, otp_code, assertion_token, webauthn_response } })),

	// Admin
	adminListUsers: (): Promise<UserInfo[]> =>
		call(callOp('list_all_users_api_v1_admin_users_get', {})),

	adminDeleteUser: (user_id: number) =>
		call(callOp('delete_user_api_v1_admin_users__user_id__delete', { params: { path: { user_id } } })),

	adminResetUserPassword: (user_id: number) =>
		call(callOp('reset_user_password_api_v1_admin_users__user_id__reset_password_post', { params: { path: { user_id } } })),

	adminListDevices: (): Promise<Device[]> =>
		call(callOp('list_all_devices_api_v1_admin_devices_get', {})),

	adminDeleteDevice: (device_id: number) =>
		call(callOp('admin_delete_device_api_v1_admin_devices__device_id__delete', { params: { path: { device_id } } })),

	adminListPacks: (): Promise<Pack[]> =>
		call(callOp('list_all_packs_api_v1_admin_packs_get', {})),

	adminDeletePack: (pack_id: number) =>
		call(callOp('admin_delete_pack_api_v1_admin_packs__pack_id__delete', { params: { path: { pack_id } } })),

	getAuthConfig: () =>
		call(callOp('get_auth_config_api_v1_auth_config_get', {})),

	getBackendUrl: (): string => BACKEND_URL
};
