import { setTimeout } from 'node:timers/promises';
import { inspect } from 'node:util';

import * as core from '@actions/core';

import { getOctokit } from './octokit.js';
import pkg from '../package.json' with { type: 'json' };

const POLL_INTERVAL_MS = 1000;
const POLL_REPEATS = 10;

type CommonOptions = {
    title: string;
    body: string;
    headSha: string;
};

type CreateOptions = CommonOptions & {
    head: string;
    base: string;
    draft: boolean;
};

type UpdateOptions = CommonOptions & {
    force: boolean;
};

type CreateOrUpdateOptions = CreateOptions &
    UpdateOptions & { update: boolean };

class Repository {
    private readonly octokit: ReturnType<typeof getOctokit>;
    private readonly owner: string;
    private readonly repo: string;

    constructor(octokit: ReturnType<typeof getOctokit>, repository: string) {
        const [owner, repo, ...extra] = repository.split('/');

        if (!owner || !repo || extra.length) {
            throw new Error(
                `Invalid repository '${repository}'. Expected format {owner}/{repo}.`
            );
        }

        this.octokit = octokit;
        this.owner = owner;
        this.repo = repo;
    }

    async findOpenPullRequest(base: string, head: string) {
        const { octokit, owner, repo } = this;

        // Note: there is no need for pagination. We need only one match.
        const { data } = await octokit.rest.pulls.list({
            owner,
            repo,
            head: head.includes(':') ? head : `${owner}:${head}`,
            base,
            state: 'open',
            per_page: 1,
        });

        return data[0];
    }

    async getPullRequest(pull_number: number) {
        const { octokit, owner, repo } = this;

        const { data } = await octokit.rest.pulls.get({
            owner,
            repo,
            pull_number,
        });

        return data;
    }

    async createPullRequest({
        base,
        head,
        headSha,
        title,
        body,
        draft,
    }: CreateOptions) {
        const { octokit, owner, repo } = this;

        if (headSha) {
            await this.createOrUpdateRef(`heads/${head}`, headSha, true);
        }

        const { data } = await octokit.rest.pulls.create({
            owner,
            repo,
            head,
            base,
            title,
            body,
            draft,
        });

        octokit.log.info(
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `Created pull request #${data.number}: ${data.html_url}`
        );

        return data;
    }

    async updatePullRequest(
        pull: NonNullable<
            | Awaited<ReturnType<Repository['getPullRequest']>>
            | Awaited<ReturnType<Repository['findOpenPullRequest']>>
        >,
        options: UpdateOptions
    ) {
        const { octokit, owner, repo } = this;
        const { title, body, headSha, force } = options;
        let updated = pull;

        // Head should be updated first, may fail when force=false
        // Not covered by tests yet
        if (!pull.head.sha.startsWith(headSha)) {
            await this.updateRef(`heads/${pull.head.ref}`, headSha, force);
        }

        if (pull.title !== title || pull.body !== body) {
            const { data } = await octokit.rest.pulls.update({
                repo,
                owner,
                pull_number: pull.number,
                title,
                body,
            });

            updated = data;
        }

        for (
            let i = 0;
            i < POLL_REPEATS && !updated.head.sha.startsWith(headSha);
            i++
        ) {
            await setTimeout(POLL_INTERVAL_MS);

            updated = await this.getPullRequest(pull.number);
        }

        if (!updated.head.sha.startsWith(headSha)) {
            throw new Error(
                'Pull request head did not update to the expected value'
            );
        }

        octokit.log.info(
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `Updated pull request #${updated.number}: ${updated.html_url}`
        );

        return updated;
    }

    async createOrUpdatePullRequest({
        base,
        head,
        headSha,
        title,
        body,
        update,
        draft,
        force,
    }: CreateOrUpdateOptions) {
        const existing = await this.findOpenPullRequest(base, head);

        if (!existing) {
            return await this.createPullRequest({
                base,
                head,
                headSha,
                title,
                body,
                draft,
            });
        }

        if (!update) {
            return existing;
        }

        return await this.updatePullRequest(existing, {
            title,
            body,
            headSha,
            force,
        });
    }

    async listMatchingRefs(ref: string) {
        const { octokit, owner, repo } = this;

        // Note: there is no need for pagination.
        // If there is an exact match - it will be the only returned result.
        const { data } = await octokit.rest.git.listMatchingRefs({
            owner,
            repo,
            ref,
        });

        return data;
    }

    async getRef(ref: string) {
        const matching = await this.listMatchingRefs(ref);

        return matching.filter(result => result.ref === `refs/${ref}`)[0];
    }

    async createRef(ref: string, sha: string) {
        const { octokit, owner, repo } = this;

        await octokit.rest.git.createRef({
            owner,
            repo,
            ref: `refs/${ref}`,
            sha,
        });
    }

    async updateRef(ref: string, sha: string, force: boolean) {
        const { octokit, owner, repo } = this;

        await octokit.rest.git.updateRef({
            owner,
            repo,
            ref,
            sha,
            force,
        });
    }

    async createOrUpdateRef(ref: string, sha: string, force: boolean) {
        const existing = await this.getRef(ref);

        if (existing) {
            if (!existing.object.sha.startsWith(sha)) {
                await this.updateRef(ref, sha, force);
            }
        } else {
            await this.createRef(ref, sha);
        }
    }
}

async function run() {
    const token = core.getInput('github-token', { required: true });
    const repository = core.getInput('repository', { required: true });
    const base = core.getInput('base', { required: true });
    const head = core.getInput('head', { required: true });
    const headSha = core.getInput('head_sha', { required: false });
    const title = core.getInput('title', { required: true });
    const body = core.getInput('body', { required: true });
    const update = core.getBooleanInput('update', { required: true });
    const draft = core.getBooleanInput('draft', { required: true });
    const force = core.getBooleanInput('force', { required: true });

    const github = getOctokit(token, {
        userAgent: `${pkg.name}/v${pkg.version}`,
    });

    const repo = new Repository(github, repository);

    const pr = await repo.createOrUpdatePullRequest({
        base,
        head,
        headSha,
        title,
        body,
        update,
        draft,
        force,
    });

    core.setOutput('number', pr.number);
    core.setOutput('url', pr.url);
    core.setOutput('html_url', pr.html_url);
    core.setOutput('pull_request', JSON.stringify(pr, undefined, ' '));
}

run().catch((error: unknown) => {
    core.setFailed(String(error));
    core.debug(inspect(error));
});
