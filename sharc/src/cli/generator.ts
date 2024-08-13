import { expandToNode, toString } from 'langium/generate';
import beautify from 'js-beautify';
import { Architecture, Relations } from '@larc/larc/model';
import { debug, fixedPass } from './layout.js';
import { SharcModel, LayoutPass } from './typing.js';
import { baseCss, kindToGroup, kindToId } from './css.js';
import { awsGroupImages } from './aws-group-images.js';
import { awsGroupCss } from './aws-groups.js';
import { awsSingleImages } from './aws-services-images.js';
import { jsBundle } from './js-bundle.js';

export function generateHtml(model: SharcModel) {

    const tree = fixedPass(model);
    // return JSON.stringify(, null, 2);
    const root = tree.nodes[0][0]!; // TODO

    debug(JSON.stringify(root, null, 2));

    const arc = model.architecture.node as Architecture;
    const rels = model.architecture.node as Relations;

    const walkContainerStyles: (node: LayoutPass) => string = (node: LayoutPass) => `
        .container-${node.name}-grid {
            display: grid;
            grid-template-columns: repeat(${node.width}, 1fr);
            grid-template-rows: repeat(${node.height}, 1fr);
            gap: 1em;
        }
    ${node.nodes.flat()
            .filter(n => !!n)
            .filter(n => n?.width !== 0 || n?.height !== 0)
            .map(n => walkContainerStyles(n!)).join('\n')}`;

    const walkSingleStyles: (node: LayoutPass) => string = (node: LayoutPass) =>
        node.width === 0 || node.height === 0 ?
            `.single-${node.name} {
                  grid-row: ${1 + (node.locationAttrs?.x ?? 0)};
                  grid-column: ${1 + (node.locationAttrs?.y ?? 0)};
            }` : node.nodes
                .flat()
                .filter(n => !!n)
                .map(n => walkSingleStyles(n!)).join('\n');

    const renderSingle = (node: LayoutPass) => `<div  id='${node.name}' class='single single-${node.name} kind-${node.kind}' >
        <svg class="image">
            <use href='#${kindToId(node.kind)}'/>
        </svg>
        <span class='title'> ${node.title ? `${node.name} - ${node.title}` : node.name} <span>
    </div>`;

    const containerCss = `
        .single {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;

            width: 100%;
            aspect-ratio: 1 / 1;
            background: var(--color-shadow)
        }

        .image {
        }

        .container {
            display: flex;
            flex-direction: column;

            // height: 100%;
        }

        .container-grid {
            padding: 32pt;

            align-items: center;
            align-contents: center;
            justify-items: center;
            justify-content: center;

        }

        .container .header {
            display: flex;
            align-items: center;
        }

        .container .header .title {
            margin-left: 8pt;
        }

        .container .header svg {
            width: 32pt;
            height: 32pt;
        }

        .single > .title {
            text-align: center
        }
    `;

    const renderContainer: (node: LayoutPass) => string = (node: LayoutPass) => `
    <div id='${node.name}' class='container container-${kindToId(node.kind)} arch-${node.name} kind-${kindToGroup(node.kind)}'>
        <div class='header'>
            <svg>
                <use href='#${kindToId(node.kind)}'/>
            </svg>
            <span class='title'>${node.title ?? node.name}<span>
        </div>
        <div class='container-grid container-${node.name}-grid'>
            ${node
            .nodes
            .flat()
            .filter(n => !!n)
            .map(n => (n?.width ?? 0) > 1 || (n?.height ?? 0) > 1 ? renderContainer(n!) : renderSingle(n!))
            .join('\n')
        }
        </div>
        
    </div>`;


    const fileNode = expandToNode`
        <html>
        <head>
            <title>
                ${arc.title}
            </title>
            <style>

                ${baseCss}
                ${awsGroupCss}

                ${containerCss}

                ${walkContainerStyles(root)}
                ${walkSingleStyles(root)}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="title"><h1>${arc.title}</h1></div>

                ${renderContainer(root)}
            </div>

<svg style="display: none" version="2.0" width="40px" height="40px" viewBox="0 0 40 40" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <defs>
    ${awsGroupImages}
    ${awsSingleImages}
    </defs>
</svg>

        </body>

        <script>
            /* beautify ignore:start */
            ${jsBundle()}                
            /* beautify ignore:end */

            const leader = (from, to, label) => new LeaderLine(document.getElementById(from), document.getElementById(to), {
                color: 'black', 
                size: 1, 
                path: 'grid',
                endPlugSize: 2,
                endPlug: 'arrow3',
                middleLabel: LeaderLine.pathLabel(label)
            });

            ${rels.rels.map(rel => `
                leader('${rel.from.ref?.name}', '${rel.to.ref?.name}', '${rel.attrs?.attrs.find(a => a.name === 'description')?.value ?? ''}');
            `).join('\n')}

        </script>

        </html>
    `;

    return beautify.html(toString(fileNode));
}
