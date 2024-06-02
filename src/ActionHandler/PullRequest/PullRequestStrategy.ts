import ActionHandlerStrategy from "../ActionHandlerStrategy.js";
import { Context } from "probot";
import {EmitterWebhookEventName} from "@octokit/webhooks/dist-types/types";
import { components } from "@octokit/openapi-types";


export type OctokitResponsePullRequest = components["schemas"]["pull-request"];

export default abstract class PullRequestStrategy<T extends EmitterWebhookEventName> extends ActionHandlerStrategy<T> {
    protected async execute(ghContext: Context<T>): Promise<void> {

        const payload = ghContext.payload as Context<'pull_request'>['payload'];
        //@ts-ignore
        const previousPRs: Array<OctokitResponsePullRequest> = (await ghContext.octokit.pulls.list({
            repo: payload.repository.name,
            sort:'updated',
            direction:'desc',
            owner: payload.repository.owner.login,
            state: 'all',
            head: `${payload.repository.owner.login}:${payload.pull_request.head.ref}`
        })).data.filter(x=>x.id!==payload.pull_request.id);
        return this.executePrStrategy(ghContext,previousPRs);
    }

    protected abstract executePrStrategy(ghContext: Context<T>,previousPRs:Array<OctokitResponsePullRequest>): Promise<void>;
}