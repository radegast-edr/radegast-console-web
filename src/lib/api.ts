import { base } from '$app/paths';
import { PUBLIC_BACKEND_URL as BACKEND_URL_RAW } from '$env/static/public';
import { goto } from '$app/navigation';
import createClient, { type Middleware, type FetchOptions, type FetchResponse } from 'openapi-fetch';
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

async function call<Res extends { data?: any }>(p: Promise<Res>): Promise<Exclude<Res["data"], undefined>> {
	const { data } = await p;
	return data as Exclude<Res["data"], undefined>;
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

type OpResponse<OpId extends keyof operations, Options = Record<string, never>> = FetchResponse<
	operations[OpId],
	Options,
	"application/json"
>;

async function callOp<OpId extends keyof operations, Options extends FetchOptions<operations[OpId]> = FetchOptions<operations[OpId]>>(
	operationId: OpId,
	options?: Options
): Promise<OpResponse<OpId, Options>> {
	const { path, method } = getRoute(operationId);
	return (client as any)[method](path, options);
}

// ---------------------------------------------------------------------------
// Exported type aliases (derived from the generated schema)
// ---------------------------------------------------------------------------

export type UserInfo = components['schemas']['UserResponse'];
export type Team = components['schemas']['TeamResponse'];
export type TeamMember = components['schemas']['TeamMemberResponse'];
export type Group = components['schemas']['DeviceGroupResponse'];
export type GroupDetail = components['schemas']['DeviceGroupDetail'];
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
export type MfaOtpSetupResponse = components['schemas']['MfaOtpSetupResponse'];
export type APIKeyScopes = components['schemas']['APIKeyScopes'];
export type APIKeyResponse = components['schemas']['APIKeyResponse'];
export type APIKeyCreatedResponse = components['schemas']['APIKeyCreatedResponse'];
export type Exclusion = components['schemas']['ExclusionResponse'];
export type ExclusionCreate = components['schemas']['ExclusionCreate'];
export type LogSeverity = components["schemas"]["LogSeverity"];


// ---------------------------------------------------------------------------
// API surface
// ---------------------------------------------------------------------------

export const api = {
	client,
	// Auth
	register: (email: string, password: string, turnstile_token: string | null = null) =>
		call(callOp('register_api_v1_auth_register_post', { body: { email, password, turnstile_token } })),

	requestPasswordReset: (email: string, turnstile_token: string | null = null) =>
		call(callOp('request_password_reset_api_v1_auth_password_reset_request_post', { body: { email, turnstile_token } })),

	confirmPasswordReset: (token: string) =>
		call(callOp('confirm_password_reset_api_v1_auth_password_reset_confirm_post', { body: { token } })),

	login: (email: string, password: string, public_key: string | null = null) =>
		call(callOp('login_api_v1_auth_login_post', { body: { email, password, public_key } })),

	logout: () =>
		call(callOp('logout_api_v1_auth_logout_post', {})),

	me: () =>
		call(callOp('me_api_v1_user_me_get', {})),

	verify: (token: string) =>
		call(callOp('verify_email_api_v1_auth_verify_get', { params: { query: { token } } })),

	setupKeys: (body: components['schemas']['KeySetupRequest']) =>
		call(callOp('setup_keys_api_v1_user_keys_setup_post', { body })),

	setupSecondaryKey: (body: components['schemas']['KeySecondarySetupRequest']) =>
		call(callOp('setup_secondary_key_api_v1_user_keys_secondary_post', { body })),

	deleteKeys: () =>
		call(callOp('delete_all_keys_api_v1_user_keys_delete', {})),

	recoverKeys: () =>
		call(callOp('recover_keys_api_v1_user_keys_recover_get', {})),

	listKeys: () =>
		call(callOp('list_user_keys_api_v1_user_keys_get', {})),

	addKey: (body: components['schemas']['PublicKeyAddRequest']) =>
		call(callOp('add_user_key_api_v1_user_keys_post', { body })),

	deleteKey: (key_id: number) =>
		call(callOp('delete_user_key_api_v1_user_keys__key_id__delete', { params: { path: { key_id } } })),

	deviceLogin: (token: string) =>
		call(callOp('device_login_api_v1_auth_device_login_post', { body: { token } })),

	changePassword: (old_password: string, new_password: string) =>
		call(callOp('change_password_api_v1_user_change_password_post', { body: { old_password, new_password } })),

	getNotifications: () =>
		call(callOp('get_notifications_api_v1_user_notifications_get', {})),

	updateNotifications: (body: NotificationSettings) =>
		call(callOp('update_notifications_api_v1_user_notifications_put', { body })),

	// Teams
	listTeams: () =>
		call(callOp('list_teams_api_v1_teams__get', {})),

	createTeam: (body: components['schemas']['TeamCreate']) =>
		call(callOp('create_team_api_v1_teams__post', { body })),

	getTeam: (team_id: number) =>
		call(callOp('get_team_api_v1_teams__team_id__get', { params: { path: { team_id } } })),

	updateTeam: (team_id: number, body: components['schemas']['TeamUpdate']) =>
		call(callOp('update_team_api_v1_teams__team_id__put', { params: { path: { team_id } }, body })),

	inviteToTeam: (team_id: number, email: string, group_keys: Record<number, string> | null = null) =>
		call(callOp('invite_to_team_api_v1_teams__team_id__invite_post', { params: { path: { team_id } }, body: { email, group_keys } })),

	cancelInvitation: (team_id: number, user_id: number, group_keys: Record<number, string>) =>
		call(callOp('cancel_invitation_api_v1_teams__team_id__invitations__user_id__cancel_post', { params: { path: { team_id, user_id } }, body: { group_keys } })),

	getTeamRecipientPublicKeys: (team_id: number) =>
		call(callOp('get_team_recipient_public_keys_api_v1_teams__team_id__recipient_public_keys_get', { params: { path: { team_id } } })),

	listMembers: (team_id: number) =>
		call(callOp('list_members_api_v1_teams__team_id__members_get', { params: { path: { team_id } } })),

	removeMember: (team_id: number, user_id: number, group_keys: Record<number, string>) =>
		call(callOp('remove_member_api_v1_teams__team_id__members__user_id__delete_post', { params: { path: { team_id, user_id } }, body: { group_keys } })),

	listTeamGroups: (team_id: number) =>
		call(callOp('list_team_groups_api_v1_teams__team_id__groups_get', { params: { path: { team_id } } })),

	createTeamGroup: (team_id: number, name: string) =>
		call(callOp('create_team_group_api_v1_teams__team_id__groups_post', { params: { path: { team_id } }, body: { name } })),

	linkGroupToTeam: (team_id: number, group_id: number, encrypted_private_key: string) =>
		call(callOp('link_group_to_team_api_v1_teams__team_id__groups__group_id__link_post', { params: { path: { team_id, group_id } }, body: { encrypted_private_key } })),

	listTeamDevices: (team_id: number) =>
		call(callOp('list_team_devices_api_v1_teams__team_id__devices_get', { params: { path: { team_id } } })),

	// Devices
	createDevice: (name: string, group_id: number) =>
		call(callOp('create_device_api_v1_devices__post', { body: { name, group_id } })),

	listDevices: () =>
		call(callOp('list_devices_api_v1_devices__get', {})),

	getDevice: (device_id: number) =>
		call(callOp('get_device_api_v1_devices__device_id__get', { params: { path: { device_id } } })),

	renameDevice: (device_id: number, name: string) =>
		call(callOp('rename_device_api_v1_devices__device_id__patch', { params: { path: { device_id } }, body: { name } })),

	addDeviceToGroup: (device_id: number, group_id: number) =>
		call(callOp('add_device_to_group_api_v1_devices__device_id__groups__group_id__post', { params: { path: { device_id, group_id } } })),

	removeDeviceFromGroup: (device_id: number, group_id: number) =>
		call(callOp('remove_device_from_group_api_v1_devices__device_id__groups__group_id__delete', { params: { path: { device_id, group_id } } })),

	deleteDevice: (device_id: number) =>
		call(callOp('delete_device_api_v1_devices__device_id__delete', { params: { path: { device_id } } })),

	reinstallDevice: (device_id: number) =>
		call(callOp('reinstall_device_api_v1_devices__device_id__reinstall_post', { params: { path: { device_id } } })),

	// Device Groups
	listGroups: () =>
		call(callOp('list_groups_api_v1_groups__get', {})),

	getGroup: (group_id: number) =>
		call(callOp('get_group_api_v1_groups__group_id__get', { params: { path: { group_id } } })),

	renameGroup: (group_id: number, name: string) =>
		call(callOp('rename_group_api_v1_groups__group_id__patch', { params: { path: { group_id } }, body: { name } })),

	unlinkGroupFromTeam: (group_id: number, team_id: number, encrypted_private_key: string) =>
		call(callOp('unlink_group_from_team_api_v1_groups__group_id__teams__team_id__unlink_post', { params: { path: { group_id, team_id } }, body: { encrypted_private_key } })),

	addDeviceToGroupViaGroup: (group_id: number, device_id: number, encrypted_private_key: string) =>
		call(callOp('add_device_to_group_api_v1_groups__group_id__devices__device_id__post', { params: { path: { group_id, device_id } }, body: { encrypted_private_key } })),

	removeDeviceFromGroupViaGroup: (group_id: number, device_id: number, encrypted_private_key: string) =>
		call(callOp('remove_device_from_group_api_v1_groups__group_id__devices__device_id__remove_post', { params: { path: { group_id, device_id } }, body: { encrypted_private_key } })),

	getGroupRecipientPublicKeys: (group_id: number, exclude_user_id: number | null = null) =>
		call(callOp('get_recipient_public_keys_api_v1_groups__group_id__recipient_public_keys_get', {
			params: {
				path: { group_id },
				query: { ...(exclude_user_id ? { exclude_user_id } : {}) }
			}
		})),

	setupGroupKeys: (group_id: number, keys: { public_key: string; private_key: string }) =>
		call(callOp('setup_group_keys_api_v1_groups__group_id__keys_post', { params: { path: { group_id } }, body: keys })),

	deleteGroup: (group_id: number) =>
		call(callOp('delete_group_api_v1_groups__group_id__delete', { params: { path: { group_id } } })),

	// Exclusions
	listExclusionsForGroup: (group_id: number) =>
		call(callOp('list_group_exclusions_api_v1_exclusions_groups__group_id__get', { params: { path: { group_id } } })),

	createExclusion: (group_id: number, data: ExclusionCreate) =>
		call(callOp('create_exclusion_api_v1_exclusions_groups__group_id__post', { params: { path: { group_id } }, body: data })),

	deleteExclusion: (exclusion_id: number) =>
		call(callOp('delete_exclusion_api_v1_exclusions__exclusion_id__delete', { params: { path: { exclusion_id } } })),

	getExclusion: (exclusion_id: number) =>
		call(callOp('get_exclusion_api_v1_exclusions__exclusion_id__get', { params: { path: { exclusion_id } } })),

	// Packs
	listPacks: () =>
		call(callOp('list_packs_api_v1_packs__get', {})),

	createPack: (name: string, description: string, team_ids: number[] | null = null) =>
		call(callOp('create_pack_api_v1_packs__post', { body: { name, description, team_ids } })),

	updatePack: (pack_id: number, name: string, description: string, team_ids: number[] | null = null) =>
		call(callOp('update_pack_api_v1_packs__pack_id__patch', { params: { path: { pack_id } }, body: { name, description, team_ids } })),

	deletePack: (pack_id: number) =>
		call(callOp('delete_pack_api_v1_packs__pack_id__delete', { params: { path: { pack_id } } })),

	getPack: (pack_id: number) =>
		call(callOp('get_pack_api_v1_packs__pack_id__get', { params: { path: { pack_id } } })),

	listVersions: (pack_id: number) =>
		call(callOp('list_versions_api_v1_packs__pack_id__versions_get', { params: { path: { pack_id } } })),

	downloadVersion: (version_id: number) =>
		callOp('download_pack_for_user_api_v1_packs_download__version_id__get', { params: { path: { version_id } }, parseAs: 'stream' }).then(({ response }) => response),

	uploadVersion: (pack_id: number, version: string, file: File, release_notes = '') => {
		const body = new FormData();
		body.append('file', file);
		if (release_notes) body.append('release_notes', release_notes);
		return call(
			callOp('upload_version_api_v1_packs__pack_id__versions_post', {
				params: { path: { pack_id }, query: { version } },
				body: body as any,
				bodySerializer: (b: unknown) => b as FormData
			})
		);
	},

	enablePack: (group_id: number, pack_version_id: number, autoupdate = true) =>
		call(callOp('enable_pack_for_group_api_v1_packs_groups__group_id__enable_post', {
			params: { path: { group_id } },
			body: { pack_version_id, autoupdate }
		})),

	listEnabledPacks: (group_id: number) =>
		call(callOp('list_enabled_packs_api_v1_packs_groups__group_id__enabled_get', { params: { path: { group_id } } })),

	disablePack: (group_id: number, enabled_id: number) =>
		call(callOp('disable_pack_api_v1_packs_groups__group_id__enabled__enabled_id__delete', { params: { path: { group_id, enabled_id } } })),

	// Key transfer
	transferInitiate: (receiver_age_public_key: string) =>
		call(callOp('initiate_key_transfer_api_v1_user_keys_transfer_initiate_post', { body: { receiver_age_public_key } })),

	transferGet: (transfer_id: string) =>
		call(callOp('get_key_transfer_api_v1_user_keys_transfer__transfer_id__get', { params: { path: { transfer_id } } })),

	transferComplete: (transfer_id: string, encrypted_private_key: string) =>
		call(callOp('complete_key_transfer_api_v1_user_keys_transfer__transfer_id__complete_post', {
			params: { path: { transfer_id } },
			body: { encrypted_private_key }
		})),

	// Logs
	getLog: (log_id: number) =>
		call(callOp('get_log_api_v1_logs__log_id__get', { params: { path: { log_id } } })),

	listLogs: (
		page = 1,
		limit = 100,
		device_id: number | null = null,
		from_time: string | null = null,
		to_time: string | null = null,
		min_level: LogSeverity | null = null,
	) =>
		call(
			callOp('list_logs_api_v1_logs__get', {
				params: {
					query: {
						page,
						limit,
						...(device_id ? { device_id } : {}),
						...(from_time ? { from_time } : {}),
						...(to_time ? { to_time } : {}),
						...(min_level ? { min_level } : {})
					}
				}
			})
		),

	getLogsCount: (
		device_id: number | null = null,
		from_time: string | null = null,
		to_time: string | null = null,
		min_level: LogSeverity | null = null,
	) =>
		call(
			callOp('get_logs_count_api_v1_logs_count_get', {
				params: {
					query: {
						...(device_id ? { device_id } : {}),
						...(from_time ? { from_time } : {}),
						...(to_time ? { to_time } : {}),
						...(min_level ? {min_level}: {})
					}
				}
			})
		),

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
				body: body as any,
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

	// Auth — email verification / unsubscribe / accept invite
	verifyEmail: (token: string) =>
		call(callOp('verify_email_api_v1_auth_verify_get', { params: { query: { token } } })),

	acceptInvite: (token: string) =>
		call(callOp('accept_invite_api_v1_auth_invite_accept_get', { params: { query: { token } } })),

	getPublicKeysByEmail: (email: string) =>
		call(callOp('get_public_keys_by_email_api_v1_user_public_keys_by_email_get', { params: { query: { email } } })),

	unsubscribe: (token: string) =>
		call(callOp('unsubscribe_api_v1_user_unsubscribe_post', { body: { token } } as any)),

	// MFA
	getMfaSettings: () =>
		call(callOp('get_mfa_settings_api_v1_user_mfa_settings_get', {})),

	setupMfaOtp: () =>
		call(callOp('mfa_otp_setup_api_v1_user_mfa_otp_setup_post', {})),

	verifyMfaOtp: (code: string) =>
		call(callOp('mfa_otp_verify_api_v1_user_mfa_otp_verify_post', { body: { code } })),

	disableMfaOtp: () =>
		call(callOp('mfa_otp_disable_api_v1_user_mfa_otp_disable_post', {})),

	setupMfaHardwareToken: () =>
		call(callOp('mfa_hardware_token_setup_api_v1_user_mfa_hardware_token_setup_post', {})),

	verifyMfaHardwareToken: (registration_token: string, credential_response: Record<string, unknown>, name: string | null = null) =>
		call(callOp('mfa_hardware_token_verify_api_v1_user_mfa_hardware_token_verify_post', { body: { registration_token, credential_response, name } })),

	deleteMfaHardwareToken: (hardware_token_id: number) =>
		call(callOp('delete_hardware_token_api_v1_user_mfa_hardware_token__token_id__delete', { params: { path: { token_id: hardware_token_id } } })),

	getMfaHardwareTokenAssertionOptions: (mfa_token: string) =>
		call(callOp('mfa_hardware_token_assertion_options_api_v1_auth_mfa_hardware_token_assertion_options_post', { body: { mfa_token } })),

	verifyMfa: (mfa_token: string, method: string, otp_code: string | null = null, assertion_token: string | null = null, webauthn_response: Record<string, unknown> | null = null) =>
		call(callOp('mfa_verify_api_v1_auth_mfa_verify_post', { body: { mfa_token, method, otp_code, assertion_token, webauthn_response } })),

	// Admin
	adminListUsers: () =>
		call(callOp('list_all_users_api_v1_admin_users_get', {})),

	adminDeleteUser: (user_id: number) =>
		call(callOp('delete_user_api_v1_admin_users__user_id__delete', { params: { path: { user_id } } })),

	adminResetUserPassword: (user_id: number) =>
		call(callOp('reset_user_password_api_v1_admin_users__user_id__reset_password_post', { params: { path: { user_id } } })),

	adminListDevices: () =>
		call(callOp('list_all_devices_api_v1_admin_devices_get', {})),

	adminDeleteDevice: (device_id: number) =>
		call(callOp('admin_delete_device_api_v1_admin_devices__device_id__delete', { params: { path: { device_id } } })),

	adminListPacks: () =>
		call(callOp('list_all_packs_api_v1_admin_packs_get', {})),

	adminDeletePack: (pack_id: number) =>
		call(callOp('admin_delete_pack_api_v1_admin_packs__pack_id__delete', { params: { path: { pack_id } } })),

	adminSendBroadcast: (body: components['schemas']['AdminBroadcastRequest']) =>
		call(callOp('send_admin_broadcast_api_v1_admin_broadcast_post', { body })),

	getDashboardData: () =>
		call(callOp('get_dashboard_data_api_v1_dashboard__get', {})),

	adminGetAlertStats: (from_time?: string | null, to_time?: string | null) =>
		call(
			callOp('get_admin_alert_stats_api_v1_admin_stats_alerts_get', {
				params: {
					query: {
						...(from_time ? { from_time } : {}),
						...(to_time ? { to_time } : {})
					}
				}
			})
		),

	adminGetDeviceStats: (exclude_offline = false, exclude_no_version = false) =>
		call(
			callOp('get_admin_device_stats_api_v1_admin_stats_devices_get', {
				params: {
					query: {
						exclude_offline,
						exclude_no_version
					}
				}
			})
		),

	getAuthConfig: () =>
		call(callOp('get_auth_config_api_v1_auth_config_get', {})),

	// API Keys Support
	updateApiKeysEnabled: (api_keys_enabled: boolean) =>
		call(callOp('update_api_keys_enabled_api_v1_user_api_keys_enabled_put', { body: { api_keys_enabled } })),

	listApiKeys: () =>
		call(callOp('list_api_keys_api_v1_apikeys__get', {})),

	createApiKey: (name: string, scopes: APIKeyScopes, expires_at: string | null = null) =>
		call(callOp('create_api_key_api_v1_apikeys__post', { body: { name, scopes, expires_at } })),

	deleteApiKey: (key_id: number) =>
		call(callOp('delete_api_key_api_v1_apikeys__key_id__delete', { params: { path: { key_id } } })),

	getBackendUrl: (): string => BACKEND_URL
};
