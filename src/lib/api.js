import { base } from '$app/paths';
import {PUBLIC_BACKEND_URL as BACKEND_URL_RAW} from '$env/static/public';
import { goto } from '$app/navigation';

let BACKEND_URL = BACKEND_URL_RAW;
if (typeof window !== 'undefined') {
	if (BACKEND_URL_RAW.startsWith('http')) {
		try {
			const url = new URL(BACKEND_URL_RAW);
			if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
				url.hostname = window.location.hostname;
				BACKEND_URL = url.origin + url.pathname;
			}
		} catch (e) {
			console.error("Failed to parse PUBLIC_BACKEND_URL:", e);
		}
	} else if (BACKEND_URL_RAW.startsWith('/')) {
		BACKEND_URL = window.location.origin + BACKEND_URL_RAW;
	}
}

async function request(method, path, body = null, isFormData = false) {
	const options = {
		method,
		credentials: 'include',
		headers: {}
	};

	if (body && !isFormData) {
		options.headers['Content-Type'] = 'application/json';
		options.body = JSON.stringify(body);
	} else if (body && isFormData) {
		options.body = body;
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
		const detail = Array.isArray(error.detail)
			? error.detail.map((e) => e.msg || JSON.stringify(e)).join('; ')
			: error.detail;
		throw new Error(detail || 'Request failed');
	}

	if (resp.headers.get('content-type')?.includes('application/json')) {
		return resp.json();
	}
	return resp;
}

export const api = {
	// Auth
	register: (email, password) => request('POST', '/auth/register', { email, password }),
	login: (email, password, public_key = null) => request('POST', '/auth/login', { email, password, public_key }),
	logout: () => request('POST', '/auth/logout'),
	me: () => request('GET', '/auth/me'),
	verify: (token) => request('GET', `/auth/verify?token=${token}`),
	setupKeys: (data) => request('POST', '/auth/keys/setup', data),
	setupSecondaryKey: (data) => request('POST', '/auth/keys/secondary', data),
	deleteKeys: () => request('DELETE', '/auth/keys'),
	recoverKeys: () => request('GET', '/auth/keys/recover'),
	listKeys: () => request('GET', '/auth/keys'),
	addKey: (data) => request('POST', '/auth/keys', data),
	deleteKey: (id) => request('DELETE', `/auth/keys/${id}`),
	deviceLogin: (token) => request('POST', '/auth/device/login', { token }),
	changePassword: (old_password, new_password) =>
		request('POST', '/auth/change-password', { old_password, new_password }),
	getNotifications: () => request('GET', '/auth/notifications'),
	updateNotifications: (data) => request('PUT', '/auth/notifications', data),

	// Teams
	listTeams: () => request('GET', '/teams/'),
	createTeam: (data) => request('POST', '/teams/', data),
	getTeam: (id) => request('GET', `/teams/${id}`),
	updateTeam: (id, data) => request('PUT', `/teams/${id}`, data),
	inviteToTeam: (teamId, email) => request('POST', `/teams/${teamId}/invite`, { email }),
	listMembers: (teamId) => request('GET', `/teams/${teamId}/members`),
	removeMember: (teamId, userId) => request('DELETE', `/teams/${teamId}/members/${userId}`),
	listTeamGroups: (teamId) => request('GET', `/teams/${teamId}/groups`),
	createTeamGroup: (teamId, name) => request('POST', `/teams/${teamId}/groups`, { name }),
	linkGroupToTeam: (teamId, groupId) => request('POST', `/teams/${teamId}/groups/${groupId}/link`),
	listTeamDevices: (teamId) => request('GET', `/teams/${teamId}/devices`),

	// Devices
	createDevice: (name, group_id) => request('POST', '/devices/', { name, group_id }),
	listDevices: () => request('GET', '/devices/'),
	getDevice: (id) => request('GET', `/devices/${id}`),
	renameDevice: (id, name) => request('PATCH', `/devices/${id}`, { name }),
	addDeviceToGroup: (deviceId, groupId) =>
		request('POST', `/devices/${deviceId}/groups/${groupId}`),
	removeDeviceFromGroup: (deviceId, groupId) =>
		request('DELETE', `/devices/${deviceId}/groups/${groupId}`),
	deleteDevice: (deviceId) => request('DELETE', `/devices/${deviceId}`),

	// Device Groups
	listGroups: () => request('GET', '/groups/'),
	getGroup: (id) => request('GET', `/groups/${id}`),
	renameGroup: (id, name) => request('PATCH', `/groups/${id}`, { name }),
	unlinkGroupFromTeam: (groupId, teamId) => request('DELETE', `/groups/${groupId}/teams/${teamId}`),
	addDeviceToGroupViaGroup: (groupId, deviceId) => request('POST', `/groups/${groupId}/devices/${deviceId}`),
	removeDeviceFromGroupViaGroup: (groupId, deviceId) => request('DELETE', `/groups/${groupId}/devices/${deviceId}`),

	// Packs
	listPacks: () => request('GET', '/packs/'),
	createPack: (name, description) => request('POST', '/packs/', { name, description }),
	updatePack: (id, name, description) => request('PATCH', `/packs/${id}`, { name, description }),
	deletePack: (id) => request('DELETE', `/packs/${id}`),
	getPack: (id) => request('GET', `/packs/${id}`),
	listVersions: (packId) => request('GET', `/packs/${packId}/versions`),
	downloadVersion: (versionId) => request('GET', `/packs/download/${versionId}`),
	uploadVersion: (packId, version, file, releaseNotes = '') => {
		const formData = new FormData();
		formData.append('file', file);
		if (releaseNotes) {
			formData.append('release_notes', releaseNotes);
		}
		return request('POST', `/packs/${packId}/versions?version=${version}`, formData, true);
	},
	enablePack: (groupId, packVersionId, autoupdate = true) =>
		request('POST', `/packs/groups/${groupId}/enable`, {
			pack_version_id: packVersionId,
			autoupdate
		}),
	listEnabledPacks: (groupId) => request('GET', `/packs/groups/${groupId}/enabled`),
	disablePack: (groupId, enabledId) =>
		request('DELETE', `/packs/groups/${groupId}/enabled/${enabledId}`),

	// Key transfer
	transferInitiate: (receiver_age_public_key) =>
		request('POST', '/auth/keys/transfer/initiate', { receiver_age_public_key }),
	transferGet: (id) => request('GET', `/auth/keys/transfer/${id}`),
	transferComplete: (id, encrypted_private_key) =>
		request('POST', `/auth/keys/transfer/${id}/complete`, { encrypted_private_key }),

	// Logs
	listLogs: (page = 1, limit = 100, deviceId = null) => {
		let url = `/logs/?page=${page}&limit=${limit}`;
		if (deviceId) url += `&device_id=${deviceId}`;
		return request('GET', url);
	},
	getUnreadLogsCount: () => request('GET', '/logs/unread-count'),
	markLogSeen: (id) => request('POST', `/logs/${id}/seen`),
	markAllLogsSeen: () => request('POST', '/logs/seen/all'),

	// Releases
	listReleases: () => request('GET', '/releases/'),
	uploadRelease: (version, os, arch, file) => {
		const fd = new FormData();
		fd.append('version', version);
		fd.append('os', os);
		fd.append('arch', arch);
		fd.append('file', file);
		return request('POST', '/releases/', fd, true);
	},
	deleteRelease: (version, os, arch) =>
		request('DELETE', `/releases/${encodeURIComponent(version)}/${encodeURIComponent(os)}/${encodeURIComponent(arch)}`),
	downloadReleaseUrl: (version, os, arch) =>
		`${BACKEND_URL}/releases/${encodeURIComponent(version)}/${encodeURIComponent(os)}/${encodeURIComponent(arch)}/download`,

	// Auth — email verification
	verifyEmail: (token) => request('GET', `/auth/verify?token=${encodeURIComponent(token)}`),

	// Admin
	adminListUsers: () => request('GET', '/admin/users'),
	adminDeleteUser: (id) => request('DELETE', `/admin/users/${id}`),
	adminListDevices: () => request('GET', '/admin/devices'),
	adminDeleteDevice: (id) => request('DELETE', `/admin/devices/${id}`),
	adminListPacks: () => request('GET', '/admin/packs'),
	adminDeletePack: (id) => request('DELETE', `/admin/packs/${id}`),
	getBackendUrl: () => BACKEND_URL
};
