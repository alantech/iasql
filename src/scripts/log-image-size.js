const PREFIX = '📏 Image size:';

function getMessage(compressedImageSize, uncompressedImageSize, installTime, uninstallTime) {
  return `${PREFIX} ${compressedImageSize} (compressed) - ${uncompressedImageSize} (uncompressed)
⏳ All modules installed in: ${installTime} seconds ⌛️
⏳ All modules uninstalled in: ${uninstallTime} seconds ⌛️`;
}

module.exports = async ({ github, context, core }) => {
  const { COMPRESSED_IMAGE_SIZE, UNCOMPRESSED_IMAGE_SIZE, INSTALL_TIME, UNINSTALL_TIME } = process.env;
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
      body: getMessage(COMPRESSED_IMAGE_SIZE, UNCOMPRESSED_IMAGE_SIZE, INSTALL_TIME, UNINSTALL_TIME),
    });
  } else {
    // submit a new comment
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
      body: getMessage(COMPRESSED_IMAGE_SIZE, UNCOMPRESSED_IMAGE_SIZE, INSTALL_TIME, UNINSTALL_TIME),
    });
  }
};
