import chalk from 'chalk';
import { Command } from 'commander';
import { SharcLanguageMetaData } from '../language/generated/module.js';
import { createSharcServices } from '../language/sharc-module.js';
import { extractAstNode } from './cli-util.js';
import { generateHtml } from './html/generator.js';
import { NodeFileSystem } from 'langium/node';
import * as url from 'node:url';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createLarcServices } from '@larc/larc';
import { Model as LarcModel } from '@larc/larc/model';
import { Layout } from '../language/generated/ast.js';
import { generateAwsDac } from './awsdac/generate.js';
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

const packagePath = path.resolve(__dirname, '..', '..', 'package.json');
const packageContent = await fs.readFile(packagePath, 'utf-8');

export const compileLarc = async (fileName: string): Promise<LarcModel> => {
    const services = createLarcServices(NodeFileSystem).Larc;
    return extractAstNode<LarcModel>(fileName, services);
};


export const generateUsing = (func: typeof generateHtml) => async (fileName: string, opts: GenerateOptions): Promise<void> => {
    const services = createSharcServices(NodeFileSystem).Sharc;

    console.error(chalk.gray(`Processing sharc...`));
    const sharc = await extractAstNode<Layout>(fileName, services);

    console.error(chalk.gray(`Linking larc...`));

    let larcLocation = sharc.architecture.location;
    try {
        await fs.access(larcLocation, fs.constants.R_OK)
        console.error(chalk.gray(`${larcLocation} is an absolute path`));
    } catch {
        larcLocation = path.normalize(path.join(path.dirname(fileName), larcLocation));
        console.error(chalk.gray(`${larcLocation} is relative to the sharc doc`));

        try {
            await fs.access(larcLocation, fs.constants.R_OK)
        } catch {
            console.error(chalk.red(`Neither ${sharc.architecture.location} nor ${larcLocation} appear to be a file. Aborting.`));

            return;
        }
    }

    path.dirname(fileName)
    const larc = await compileLarc(larcLocation);

    const arcRef = sharc.architecture;
    const generated = func({
        ...sharc,
        architecture: {
            ...arcRef,
            node: larc
        }
    });
    console.error(chalk.green(`Html generated successfully`));
    console.log(generated);
};

export type GenerateOptions = {
}

export default function (): void {
    const program = new Command();

    program.version(JSON.parse(packageContent).version);

    const fileExtensions = SharcLanguageMetaData.fileExtensions.join(', ');
    program
        .command('html')
        .argument('<file>', `sharc source file (possible file extensions: ${fileExtensions})`)
        .description('generates html representation of the sharc document')
        .action(generateUsing(generateHtml));
    program
        .command('dac')
        .argument('<file>', `sharc source file (possible file extensions: ${fileExtensions})`)
        .description('generates image representation of the sharc document using awsdac utility')
        .action(generateUsing(generateAwsDac));

    program.parse(process.argv);
}
