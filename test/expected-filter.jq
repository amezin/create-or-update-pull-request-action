{
  number: $ENV.PR_NUMBER | fromjson,
  title: $ENV.PR_TITLE,
  body: $ENV.PR_BODY,
  draft: $ENV.PR_DRAFT | fromjson,
  state: "open",
  html_url: $ENV.PR_HTML_URL,
  head: { ref: $ENV.PR_HEAD_BRANCH, sha: $ENV.PR_HEAD_SHA },
  base: { ref: $ENV.PR_BASE_BRANCH }
}
