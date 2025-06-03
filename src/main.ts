import { inspect } from 'node:util';

import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import { requestLog } from '@octokit/plugin-request-log';

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

    async createPullRequest(
        base: string,
        head: string,
        title: string,
        body: string
    ) {
        const { octokit, owner, repo } = this;

        const { data } = await octokit.rest.pulls.create({
            owner,
            repo,
            head,
            base,
            title,
            body,
        });

        return data;
    }

    async updatePullRequest(pull_number: number, title: string, body: string) {
        const { octokit, owner, repo } = this;

        const { data } = await octokit.rest.pulls.update({
            repo,
            owner,
            pull_number,
            title,
            body,
        });

        return data;
    }
}

async function run() {
    const log = {
        debug: core.isDebug()
            ? console.debug.bind(console)
            : (..._args: unknown[]) => {},
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
    };

    const token = core.getInput('github-token', { required: true });
    const repository = core.getInput('repository', { required: true });
    const base = core.getInput('base', { required: true });
    const head = core.getInput('head', { required: true });
    const title = core.getInput('title', { required: true });
    const body = core.getInput('body', { required: true });

    const github = getOctokit(token, { log }, requestLog);
    const repo = new Repository(github, repository);

    const existing = await repo.findOpenPullRequest(base, head);
    const updated = existing
        ? await repo.updatePullRequest(existing.number, title, body)
        : await repo.createPullRequest(base, head, title, body);

    core.setOutput('number', updated.number);
    core.setOutput('url', updated.url);
    core.setOutput('html_url', updated.html_url);
}

run().catch((error: unknown) => {
    core.setFailed(String(error));
    core.debug(inspect(error));
});
