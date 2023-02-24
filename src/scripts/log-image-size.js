const PREFIX = '📏 Image size:';
module.exports = async ({ github, context, core }) => {
  const { COMPRESSED_IMAGE_SIZE, UNCOMPRESSED_IMAGE_SIZE } = process.env;
  const prComments = await github.rest.issues.listComments({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
  });
  const sizeComment = prComments.data?.find(c => c.body.startsWith(PREFIX));
  if (!!sizeComment) {
    // update the existing comment
    await github.rest.issues.updateComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      comment_id: sizeComment.id,
      body: `${PREFIX} ${COMPRESSED_IMAGE_SIZE} (compressed) - ${UNCOMPRESSED_IMAGE_SIZE} (uncompressed)`,
    });
  } else {
    // submit a new comment
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
      body: `${PREFIX} ${COMPRESSED_IMAGE_SIZE} (compressed) - ${UNCOMPRESSED_IMAGE_SIZE} (uncompressed)`,
    });
  }
};
