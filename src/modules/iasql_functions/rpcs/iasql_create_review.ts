import { IasqlFunctions } from '..';
import { RpcInput } from '../..';
import {
  Context,
  PostTransactionCheck,
  PreTransactionCheck,
  RpcBase,
  RpcResponseObject,
} from '../../interfaces';

/**
 * Method that generates creates the markdown to be shared or used in any version control system
 */
export class IasqlCreateReview extends RpcBase {
  /** @internal */
  module: IasqlFunctions;
  /** @internal */
  preTransactionCheck = PreTransactionCheck.NO_CHECK;
  /** @internal */
  postTransactionCheck = PostTransactionCheck.NO_CHECK;
  /** @internal */
  inputTable: RpcInput = {
    title: { argType: 'varchar', default: 'New Review' },
    description: { argType: 'varchar', default: 'Review description' },
  };
  /** @internal */
  outputTable = {
    markdown: 'text',
  } as const;

  documentation = {
    description: 'Generate review markdown for latest transaction',
    sampleUsage: "SELECT * FROM iasql_create_review('My review title', 'Meaningful description')",
  };

  /** @internal */
  call = async (
    _dbId: string,
    _dbUser: string,
    ctx: Context,
    title: string,
    description: string,
  ): Promise<RpcResponseObject<typeof this.outputTable>[]> => {
    let preview: any[];
    let transactionSql: { sql: string }[];
    try {
      preview = (await ctx.orm.query('SELECT * FROM iasql_preview();')) ?? [];
      // TODO: update once `iasql_get_sql_for_transaction` with no arguments works
      transactionSql =
        (await ctx.orm.query(`
        SELECT *
        FROM iasql_get_sql_for_transaction(
          (
            SELECT transaction_id
            FROM iasql_audit_log
            WHERE change_type = 'OPEN_TRANSACTION'
            ORDER BY ts DESC
            LIMIT 1
          )
        );
      `)) ?? [];
    } catch (e) {
      throw e;
    }
    return [
      {
        markdown: generateMarkdown(title, description, preview, transactionSql?.[0]?.sql),
      },
    ];
  };

  constructor(module: IasqlFunctions) {
    super();
    this.module = module;
    super.init();
  }
}

function generateMarkdown(title: string, description: string, preview: any[], transactionSql?: string) {
  const titleMarkdown = `# ${title}`;
  const descriptionMarkdown = description;
  if (!preview.length) return;
  const previewTitleMarkdown = '## IaSQL Preview\n';
  const previewKeys = Object.keys(preview[0]);
  const previewHeaderDelimiters = previewKeys.map(() => '---');
  const previewHeaderMarkdown = `| ${previewKeys.join(' | ')} |`;
  const previewHeaderDelimitersMarkdown = `| ${previewHeaderDelimiters.join(' | ')} |`;
  const previewRowsMarkdown = preview.map(row => {
    const rowValues = previewKeys.map(key => row[key]);
    return `| ${rowValues.join(' | ')} |`;
  });
  const previewMarkdown = [
    previewTitleMarkdown,
    previewHeaderMarkdown,
    previewHeaderDelimitersMarkdown,
    ...previewRowsMarkdown,
  ].join('\n');
  const sqlTitleMarkdown = '## SQL changes';
  const sqlMarkdown = `\`\`\`sql
${transactionSql}
\`\`\``;
  return [titleMarkdown, descriptionMarkdown, previewMarkdown, sqlTitleMarkdown, sqlMarkdown].join('\n\n');
}
