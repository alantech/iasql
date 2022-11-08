const visit = require('unist-util-visit');

function fixedEncodeURIComponent(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, escape);
}

const plugin = (options) => {
  return async (ast) => {
    visit(ast, 'code', (node, index, parent) => {
      const theButtonMeta = (node.meta || '')
        .split(/\s(?=(?:[^'"`]*(['"`])[^'"`]*\1)*[^'"`]*$)/g)
        .find(m => m?.startsWith('TheButton'));

      if (theButtonMeta) {
        let buttonText = 'Run SQL'; // Default when it's just TheButton
        if (theButtonMeta !== 'TheButton') { // TheButton="Title for the Button"
          buttonText = theButtonMeta.replace(/^(TheButton=)/, '').replace(/^"(.*)"$/, '$1');
        }

        parent.children.splice(index + 1, 0, {
          type: 'paragraph',
          children: [
            {
              type: 'jsx',
              value: `<button className={"button button--primary button--lg margin-bottom--lg"} onClick={() => window.open('https://app.iasql.com/#/button/${fixedEncodeURIComponent(node.value)}', '_blank')}>${buttonText}</button>`,
            },
          ],
        });
      }
    });
  };
};

module.exports = plugin;

