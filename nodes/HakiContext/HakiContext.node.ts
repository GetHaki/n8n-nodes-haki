import type {
	Icon,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';
import {
	apiError,
	formatPacket,
	requireSubject,
	type ContextApiResponse,
	type HakiCredentials,
} from '../utils';

export class HakiContext implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Haki Context',
		name: 'hakiContext',
		icon: 'file:../../icons/haki.svg' as Icon,
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["subject_id"]}}',
		description:
			"Fetches the subject's long-term memory (ContextPacket) BEFORE the LLM call. Always place before the AI Agent.",
		defaults: { name: 'Haki Context' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'hakiApi', required: true }],
		properties: [
			{
				displayName: 'Project ID',
				name: 'project_id',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'prj_support',
				description: 'Haki project (memory scope). Never chosen by the model.',
			},
			{
				displayName: 'Subject ID',
				name: 'subject_id',
				type: 'string',
				default: '',
				required: true,
				placeholder: '{{ $json.body.subject_id }}',
				description:
					"Stable identifier for the person (sessionId, email, webhook ID...). Empty or \"default\" is an error.",
			},
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				default: '',
				required: true,
				placeholder: '{{ $json.body.message }}',
				description: 'The current message — used to rerank relevant facts',
			},
			{
				displayName: 'Budget Tokens',
				name: 'budget_tokens',
				type: 'number',
				default: 2000,
				description: 'Token budget for the ContextPacket',
			},
			{
				displayName: 'Purpose',
				name: 'purpose',
				type: 'string',
				default: '',
				description: 'Optional: task type (support, onboarding...), recorded in the trace',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const credentials = (await this.getCredentials('hakiApi')) as unknown as HakiCredentials;
		const url = `${credentials.base_url.replace(/\/+$/, '')}/v1/context`;

		for (let i = 0; i < items.length; i++) {
			const projectId = this.getNodeParameter('project_id', i) as string;
			const subjectId = requireSubject(
				this.getNode(),
				this.getNodeParameter('subject_id', i) as string,
				i,
			);
			const query = this.getNodeParameter('query', i) as string;
			const budgetTokens = this.getNodeParameter('budget_tokens', i) as number;
			const purpose = (this.getNodeParameter('purpose', i) as string) || null;

			let response: ContextApiResponse;
			try {
				response = (await this.helpers.httpRequestWithAuthentication.call(this, 'hakiApi', {
					method: 'POST',
					url,
					body: {
						project_id: projectId,
						subject_id: subjectId,
						query,
						purpose,
						budget_tokens: budgetTokens,
					},
					json: true,
				})) as ContextApiResponse;
			} catch (error) {
				throw apiError(this.getNode(), error, i);
			}

			returnData.push({
				json: {
					// Text ready to inject into the agent's system prompt.
					context_text: formatPacket(response.packet),
					packet: response.packet,
					warnings: response.packet.warnings ?? [],
					token_count: response.token_count,
					trace_id: response.trace_id,
					subject_id: subjectId,
					project_id: projectId,
				},
				pairedItem: { item: i },
			});
		}
		return [returnData];
	}
}
