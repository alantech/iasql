const PREFIX = '📏 Image size:';
module.exports = async ({ github, context, core }) => {
  const { IMAGE_SIZE } = process.env;
  const prComments = await github.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
  });
  const sizeComment = prComments.data.find(c => c.body.startsWith(PREFIX));
  if (!!sizeComment.length) {
    // update the existing comment
    await github.rest.issues.updateComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: sizeComment.id,
      body: `${PREFIX} ${IMAGE_SIZE}`,
    });
  } else {
    // submit a new comment
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
      body: `${PREFIX} ${IMAGE_SIZE}`,
    });
  }
};
