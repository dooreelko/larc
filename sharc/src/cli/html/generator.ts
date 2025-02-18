import beautify from 'js-beautify';
import _ from 'lodash';
import { Architecture, Relations } from '@larc/larc/model';
import { debug, fixedPass, relativePass } from '../common/layout.js';
import { SharcModel, LayoutPass } from '../typing.js';
import { baseCss, containerCss, kindToGroup, kindToId } from './css.js';
import { awsGroupImages } from './aws-group-images.js';
import { awsGroupCss } from './aws-groups.js';
import { awsSingleImages } from './aws-services-images.js';
import { jsBundle } from './js-bundle.js';

export function generateHtml(model: SharcModel) {

    const tree = relativePass(fixedPass(model));

    const root = tree.nodes[0][0]!; // TODO

    debug(JSON.stringify(root, null, 2));

    const arc = model.architecture.node as Architecture;
    const rels = model.architecture.node as Relations;

    const transpose = <T>(nodes: T[][]) => nodes[0].map((_, idx) => nodes.map(r => r[idx]));
    const maxWidths = (node: LayoutPass) => transpose(node.nodes).map(col => col.map(n => n?.width ?? 0)).map(col => _.max(col) || 0);
    const maxHeights = (node: LayoutPass) => node.nodes.map(col => col.map(n => n?.width ?? 0)).map(col => _.max(col) || 0);

    const walkContainerStyles: (node: LayoutPass) => string = (node: LayoutPass) => `
        .container-${kindToId(node.kind)} {
                  grid-row: ${1 + (node.locationAttrs?.y ?? 0)};
                  grid-column: ${1 + (node.locationAttrs?.x ?? 0)};
        }
        .container-${node.name}-grid {
            display: grid;
            grid-template-columns: ${maxWidths(node).map(n => 1 + n).map(w => `${w}fr`).join(' ')};
            grid-template-rows: ${maxHeights(node).map(n => 1 + n).map(h => `${h}fr`).join(' ')};
            // grid-template-columns: repeat(${node.width}, 1fr);
            // grid-template-rows: repeat(${node.height}, 1fr);
            gap: 4em;
        }
    ${node.nodes.flat()
            .filter(n => !!n && !!n.kind)
            .filter(n => n?.width !== 0 || n?.height !== 0)
            .map(n => walkContainerStyles(n!)).join('\n')}`;

    const walkSingleStyles: (node: LayoutPass) => string = (node: LayoutPass) =>
        node.width === 0 || node.height === 0 ?
            `.single-${node.name} {
                  grid-row: ${1 + (node.locationAttrs?.y ?? 0)};
                  grid-column: ${1 + (node.locationAttrs?.x ?? 0)};
            }` : node.nodes
                .flat()
                .filter(n => !!n && !!n.kind)
                .map(n => walkSingleStyles(n!)).join('\n');

    const renderSingle = (node: LayoutPass) => `<div  id='${node.name}' class='single single-${node.name} kind-${node.kind}' >
        <svg class="image">
            <use href='#${kindToId(node.kind)}'/>
        </svg>
        <span class='title'> ${node.title ? `${node.name} - ${node.title}` : node.name} <span>
    </div>`;

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
            .filter(n => !!n && !!n.kind)
            .map(n => (n?.width ?? 0) > 1 || (n?.height ?? 0) > 1 ? renderContainer(n!) : renderSingle(n!))
            .join('\n')
        }
        </div>
        
    </div>`;


    const html = `
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
            `).join('')}

        </script>

        </html>
    `;

    return beautify.html(html);
}

