const visit = require('unist-util-visit');
const path = require('path');
const fs = require('fs');
const acorn = require('acorn-loose');
const walk = require('acorn-walk');

// applies logic for parsing an expression
function parseExpression(expression) {
  let fragmentName;
  const titems = [];

  if (expression.type == 'CallExpression' && expression.callee.name == 'it') {
    fragmentName = expression.arguments[0].type == 'Literal' ? expression.arguments[0].value : '';

    // walk the node to find the desired elements
    walk.full(expression, node => {
      if (node.type == 'CallExpression' && node.callee.name == 'query') {
        // retrieve the template literal and convert to string
        const template = node.arguments[0];
        const variables = [];
        const contents = [];
        // read vars
        for (const expression of template.expressions) {
          if (expression.type == 'Identifier') variables.push(expression.name);
          else if (expression.type == 'MemberExpression') variables.push(expression.property.name);
        }
        for (const ti of template.quasis) {
          if (ti.type == 'TemplateElement' && ti.value.cooked && ti.value.cooked.trim().length > 0)
            contents.push(ti.value.cooked.trim());
        }

        // now we go mixiing expressions and templates
        let finalString = '';
        for (let i = 0; i < contents.length; i++) {
          // split and trim lines ending with \n
          let items = contents[i].trim().split('\n');
          items = items.map(s => s.trim());
          finalString += items.join('\n');
          if (variables[i]) finalString += '<' + variables[i].trim() + '>';
        }
        if (!finalString.endsWith(';')) finalString += ';';
        titems.push(finalString);
      } else if (node.type == 'CallExpression' && node.callee.name == 'begin')
        titems.push('SELECT * FROM iasql_begin();');
      else if (node.type == 'CallExpression' && node.callee.name == 'commit')
        titems.push('SELECT * FROM iasql_commit();');
      else if (node.type == 'CallExpression' && node.callee.name == 'rollback')
        titems.push('SELECT * FROM iasql_rollback();');
    });
  }
  return { name: fragmentName, content: titems };
}
// given a text file with jest, parse the contents
function parseTest(testContent, testName) {
  const content = acorn.parse(testContent, { ecmaVersion: 2020 });
  const items = [];

  walk.full(content, function (node) {
    if (node.type == 'CallExpression' && node.callee.name == 'describe') {
      // check if we are on the right node
      if ((node.arguments ?? []).length == 2) {
        if (node.arguments[0].type == 'Literal' && node.arguments[0].value == testName) {
          // we need to parse the content
          const body = node.arguments[1].body;
          for (const item of body.body) {
            if (item.type == 'ExpressionStatement') {
              const subexp = item.expression;
              if (subexp.type == 'SequenceExpression') {
                for (const expression of subexp.expressions) {
                  let { name, content } = parseExpression(expression);
                  if (name && content && content.length > 0) {
                    items.push({
                      name: name,
                      content: content.join('\n'),
                    });
                  }
                }
              } else {
                let { name, content } = parseExpression(subexp);

                if (name && content && content.length > 0) {
                  items.push({
                    name: name,
                    content: content.join('\n'),
                  });
                }
              }
            }
          }
        }
      }
    }
  });
  return items;
}

const plugin = options => {
  return async ast => {
    visit(ast, 'code', async (node, index, parent) => {
      if (node.lang == 'testdoc') {
        const result = [];
        // we need to process that in an special way. Each line will be a reference to a test module
        // and a test name (referencing the describe name)
        const tests = node.value.split('\n');
        for (const test of tests) {
          // test is composed by module name and test name
          const items = test.split('#');
          if (items.length >= 2) {
            const filePath = path.join(__dirname, '..', '..', '..', 'test', items[0]);
            let fileContent;
            try {
              fileContent = fs.readFileSync(filePath, 'utf8');
            } catch (e) {
              continue;
            }
            if (fileContent) {
              // need to retrieve the tests contents
              const results = parseTest(fileContent, items[1]);

              if (results.length > 0) {
                let code = '';
                for (const result of results) {
                  code = code + `--- ${result.name}\n`;
                  code = code + `${result.content}\n`;
                }

                // we replace the code with the composed html
                let title;
                if (items.length == 3) title = items[2];
                else title = items[1];
                result.push({
                  type: 'html',
                  value: `<h3>${title}</h3>`,
                });
                result.push({
                  type: 'code',
                  lang: 'sql',
                  value: code,
                });
              }
            }
          }
        }
        parent.children[index] = {
          type: 'paragraph',
          children: result,
        };
      }
    });
  };
};

module.exports = plugin;
