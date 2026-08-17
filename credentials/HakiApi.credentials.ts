import type {
	Icon,
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class HakiApi implements ICredentialType {
	name = 'hakiApi';

	displayName = 'Haki API';

	icon: Icon = 'file:../icons/haki.svg' as Icon;

	documentationUrl = 'https://github.com/GetHaki/Haki';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'base_url',
			type: 'string',
			default: 'http://localhost:8100',
			required: true,
			placeholder: 'http://localhost:8100',
			description:
				"The Haki API URL, no trailing slash. From an n8n Docker container to a Haki API on the host machine: http://host.docker.internal:8100",
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				"Haki bearer key. Optional in local development (the API runs in open mode), required as soon as HAKI_ADMIN_KEY or an API key is configured server-side.",
		},
	];

	// Both nodes call this via httpRequestWithAuthentication('hakiApi', ...),
	// so n8n injects this header itself -- an empty apiKey correctly surfaces
	// as a 401 against a server that does enforce auth, which is the right
	// signal for the documented, supported no-key local-dev setup.
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	// GET /health: always 200 when the Base URL is reachable, auth or not --
	// deliberate, since the API Key field above is optional in local/open-mode
	// dev. An endpoint that 401s on a blank key (e.g. /v1/keys) would fail
	// this test by default for the documented, supported no-key setup.
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.base_url}}',
			url: '/health',
			method: 'GET',
		},
	};
}
