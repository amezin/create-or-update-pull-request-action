# Create or Update Pull Request

Create or update a pull request through GitHub API.
Or, in other words, ensure an open pull request with the specified `head` and `base` branches exists.

If the pull request does not exist, it will be created.

If it already exists, it will be updated to have the specified title and description.

This action is intended to be used together with https://github.com/amezin/create-commit-action
and https://github.com/amezin/create-or-update-git-ref-action to automatically create/update pull
requests for modified files, but can be used standalone for other purposes too.

## Usage example

A workflow that generates a file and adds it to the main branch through a pull request:

https://github.com/amezin/pull-request-generator/blob/main/.github/workflows/make-pull-request.yml

## Inputs

### `repository`

The owner and repository name, in `owner/name` format.

**Default**: `${{ github.repository }}` - the repository where the workflow was triggered.

### `title`

Pull request title. No default value. Required input.

### `body`

The description of the pull request.

### `update`

`true`: update pull request's `title` and `body` if the pull request already exists.

`false`: don't update existing pull requests.

**Default**: `true`

### `draft`

`true`: the pull request will be created as a draft.

> [!NOTE]
> This input will be ignored if the pull request already exists, regardless of `update` flag.

**Default**: `false`

### `head`

Source branch name, **without** `refs/heads/`.

**Default**: `${{ github.ref_name }}` - the name of the branch that triggered the workflow run.

### `base`

Target branch name, **without** `refs/heads/`.

**Default**: `${{ github.event.repository.default_branch }}` - the default branch of the repository.

### `github-token`

GitHub API token to use.

Must have `pull-requests: write` permission.

**Default**: `${{ github.token }}`

> [!NOTE]
> If you want other GitHub Actions workflows to be triggered from `pull_request` event,
> you should use a custom token (app installation or personal access token):
> https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/triggering-a-workflow#triggering-a-workflow-from-a-workflow

## Outputs

### `number`

The number of the created/updated pull request.

### `url`

REST API URL of the created/updated pull request.

### `html_url`

Browser URL of the created/updated pull request.
