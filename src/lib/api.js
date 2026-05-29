import {PUBLIC_BACKEND_URL as BACKEND_URL} from '$env/static/public';

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
	login: (email, password) => request('POST', '/auth/login', { email, password }),
	logout: () => request('POST', '/auth/logout'),
	me: () => request('GET', '/auth/me'),
	verify: (token) => request('GET', `/auth/verify?token=${token}`),
	setupKeys: (data) => request('POST', '/auth/keys/setup', data),
	setupSecondaryKey: (data) => request('POST', '/auth/keys/secondary', data),
	deleteKeys: () => request('DELETE', '/auth/keys'),
	recoverKeys: () => request('GET', '/auth/keys/recover'),
	deviceLogin: (token) => request('POST', '/auth/device/login', { token }),

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
	getPack: (id) => request('GET', `/packs/${id}`),
	listVersions: (packId) => request('GET', `/packs/${packId}/versions`),
	uploadVersion: (packId, version, file) => {
		const formData = new FormData();
		formData.append('file', file);
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
	listLogs: (deviceId = null) =>
		request('GET', deviceId ? `/logs/?device_id=${deviceId}` : '/logs/'),

	// Admin
	adminListUsers: () => request('GET', '/admin/users'),
	adminDeleteUser: (id) => request('DELETE', `/admin/users/${id}`),
	adminListDevices: () => request('GET', '/admin/devices'),
	adminDeleteDevice: (id) => request('DELETE', `/admin/devices/${id}`),
	adminListPacks: () => request('GET', '/admin/packs'),
	adminDeletePack: (id) => request('DELETE', `/admin/packs/${id}`)
};
