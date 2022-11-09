const visit = require('unist-util-visit');

function fixedEncodeURIComponent(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, escape);
}

const plugin = (options) => {
  return async (ast) => {
    visit(ast, 'code', (node, index, parent) => {
      const regex = /TheButton((\[(?<title>[^\]]+)\])?=("?(?<text>[^"]+)"?))?/;
      let m;
      if ((m = regex.exec((node.meta || ''))) !== null) {
        const buttonTitle = m.groups.title;
        const buttonText = m.groups.text ?? 'Run SQL';
        let buttonUrl;
        if (buttonTitle)
          buttonUrl = `https://app.iasql.com/#/button/${fixedEncodeURIComponent(buttonTitle)}/${fixedEncodeURIComponent(node.value)}`;
        else
          buttonUrl = `https://app.iasql.com/#/button/${fixedEncodeURIComponent(node.value)}`;

        parent.children.splice(index + 1, 0, {
          type: 'paragraph',
          children: [
            {
              type: 'jsx',
              value: `<button className={"button button--primary button--lg margin-bottom--lg"} onClick={() => window.open('${buttonUrl}', '_blank')}>${buttonText}</button>`,
            },
          ],
        });
      }
    });
  };
};

module.exports = plugin;

