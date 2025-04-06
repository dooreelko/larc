import beautify from 'js-beautify';
import _ from 'lodash';
import { Architecture, Relations } from '@larc/larc/model';
import { debug, initLayoutTree, relativePass } from '../common/layout.js';
import { LayoutNode } from '../typing.js';
import { baseCss, containerCss, kindToGroup, kindToId } from './css.js';
import { awsGroupImages } from './aws-group-images.js';
import { awsGroupCss } from './aws-groups.js';
import { awsSingleImages } from './aws-services-images.js';
import { jsBundle } from './js-bundle.js';
import { Model as Larc } from '@larc/larc/model';
import { Sharc } from '../../language/generated/ast.js';

export function generateHtml(layout: Sharc, larc: Larc) {

    const tree = relativePass(layout, initLayoutTree(layout, larc));

    const root = tree.nodes[0]!; // TODO

    debug(JSON.stringify(root, null, 2));

    const arc = larc as Architecture;
    const rels = larc as Relations;

    // const transpose = <T>(nodes: T[][]) => nodes[0].map((_, idx) => nodes.map(r => r[idx]));
    // const maxWidths = (node: LayoutNode) => transpose(node.nodes).map(col => col.map(n => n?.width ?? 0)).map(col => _.max(col) || 0);
    // const maxHeights = (node: LayoutNode) => node.nodes.map(col => col.map(n => n?.width ?? 0)).map(col => _.max(col) || 0);

    const walkContainerStyles: (node: LayoutNode) => string = (node: LayoutNode) => `
        .container-${kindToId(node.kind)} {
                  grid-row: ${1 + (node.y ?? 0)};
                  grid-column: ${1 + (node.x ?? 0)};
        }
        .container-${node.name}-grid {
            display: grid;
            grid-template-columns: ${node.width}fr;
            grid-template-rows: ${node.height}fr;
            // grid-template-columns: repeat(${node.width}, 1fr);
            // grid-template-rows: repeat(${node.height}, 1fr);
            gap: 4em;
        }
    ${node.nodes.flat()
            .filter(n => !!n && !!n.kind)
            .filter(n => n?.width !== 0 || n?.height !== 0)
            .map(n => walkContainerStyles(n!)).join('\n')}`;

    const walkSingleStyles: (node: LayoutNode) => string = (node: LayoutNode) =>
        node.width === 0 || node.height === 0 ?
            `.single-${node.name} {
                  grid-row: ${1 + (node.y ?? 0)};
                  grid-column: ${1 + (node.x ?? 0)};
            }` : node.nodes
                .flat()
                .filter(n => !!n && !!n.kind)
                .map(n => walkSingleStyles(n!)).join('\n');

    const renderSingle = (node: LayoutNode) => `<div  id='${node.name}' class='single single-${node.name} kind-${node.kind}' >
        <svg class="image">
            <use href='#${kindToId(node.kind)}'/>
        </svg>
        <span class='title'> ${node.title ? `${node.name} - ${node.title}` : node.name} <span>
    </div>`;

    const renderContainer: (node: LayoutNode) => string = (node: LayoutNode) => `
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

