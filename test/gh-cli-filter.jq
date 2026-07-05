{
  number,
  title,
  body,
  draft: .isDraft,
  state: .state | ascii_downcase,
  html_url: .url,
  head: { ref: .headRefName, sha: .headRefOid },
  base: { ref: .baseRefName }
}
