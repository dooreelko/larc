import { knownAwsGroups } from './aws-groups.js';
import { knownAwsServices } from './aws-services.js';

export const knownItems =
{
    ...knownAwsGroups,
    ...knownAwsServices
};

export const kindToGroup = (kind: string) => {
    const lower = kind.toLocaleLowerCase();

    return Object.hasOwn(knownItems, lower) ? lower : 'generic';
}

export const kindToId = (kind: string) => {
    const lower = kind.toLocaleLowerCase();

    return knownItems[lower] ?? 'generic';
}

export const containerCss = `
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

export const baseCss = `
                :root {
                    --active-brightness: 0.85;
                    --border-radius: 5px;
                    --box-shadow: 2px 2px 10px;
                    --color-accent: #118bee15;
                    --color-bg: #fff;
                    --color-bg-secondary: #e9e9e9;
                    --color-link: #118bee;
                    --color-secondary: #920de9;
                    --color-secondary-accent: #920de90b;
                    --color-shadow: #fafafa;
                    --color-table: #118bee;
                    --color-text: #000;
                    --color-text-secondary: #999;
                    --color-scrollbar: #cacae8;
                    --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
                    --hover-brightness: 1.2;
                    --justify-important: center;
                    --justify-normal: left;
                    --line-height: 1.5;
                    --width-card: 285px;
                    --width-card-medium: 460px;
                    --width-card-wide: 800px;
                    --width-content: 1080px;
                }
                
                @media (prefers-color-scheme: dark) {
                    :root[color-mode="user"] {
                        --color-accent: #0097fc4f;
                        --color-bg: #333;
                        --color-bg-secondary: #555;
                        --color-link: #0097fc;
                        --color-secondary: #e20de9;
                        --color-secondary-accent: #e20de94f;
                        --color-shadow: #bbbbbb20;
                        --color-table: #0097fc;
                        --color-text: #f7f7f7;
                        --color-text-secondary: #aaa;
                    }
                }
                
                html {
                    scroll-behavior: smooth;
                }

                body {
                    background: var(--color-bg);
                    color: var(--color-text);
                    font-family: var(--font-family);
                    font-weight: 300;
                    line-height: var(--line-height);
                    margin: 0;
                    overflow-x: hidden;
                    padding: 8pt;
                }

                * {
                    font-weight: inherit;
                    margin: inherit;
                }`;