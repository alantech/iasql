const PREFIX = '📏 Image size:';
module.exports = async ({ github, context, core }) => {
  const imageSize = '222 MB';
  const prComments = await github.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
  });
  const sizeComment = prComments.data.findLast(c => c.body.startsWith(PREFIX));
  if (sizeComment) {
    // update the existing comment
    await github.rest.issues.updateComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: sizeComment.id,
      body: `${PREFIX} ${imageSize}`,
    });
  } else {
    // submit a new comment
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
      body: `${PREFIX} ${imageSize}`,
    });
  }
};
