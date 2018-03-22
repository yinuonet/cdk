import chalk from 'chalk';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import nodeFetch, { Response } from 'node-fetch';
import * as path from 'path';
import { extract } from 'tar';

import { UnexpectedHttpError } from './errors';
import { awaitChildProcess, exists, mkdir, readFile, writeFile } from './util';

const templateAliases: { [key: string]: string } = {
  preact: 'interactive-launchpad_1.0.tar.gz',
  html: 'interactive-html-starter_1.0.tar.gz',
};

/**
 * Options for the
 */
export interface IQuickstartOptions {
  dir: string;
  projectName: string;
  template: string;
  license: string;
  keywords: string;
  author: string;
  description?: string;
}

/**
 * Quickstarter helps with creating and install projects.
 */
export class Quickstarter extends EventEmitter {
  constructor(private readonly options: Readonly<IQuickstartOptions>) {
    super();
  }

  /**
   * Starts the extraction. Emits `data` events, with console info, as
   * the process runs.
   */
  public async start() {
    const res = await this.getTarball();
    await this.extractProject(res);
    await this.installDependences();
    await this.updateProjectJson();
    this.emit('data', chalk.green('\nInstallation completed successfully.'));
  }

  /**
   * Installs npm dependencies.
   */
  private async installDependences() {
    this.emitPrompt('npm install');
    const proc = spawn('npm', ['install', '-d', '--color=always'], { cwd: this.targetPath() });
    proc.stdout.on('data', data => this.emit('data', data.toString()));
    proc.stderr.on('data', data => this.emit('data', data.toString()));
    await awaitChildProcess(proc);
  }

  /**
   * Updates the project JSON to match the options given in the quickstart.
   */
  private async updateProjectJson() {
    this.emitPrompt('patch project.json');

    const partial = {
      name: this.options.projectName,
      description: this.options.description ? this.options.description : undefined,
      version: '0.1.0',
      author: this.options.author,
      keywords: this.options.keywords
        ? this.options.keywords.split(',').map(kw => kw.toLowerCase().trim())
        : [],
      license: this.options.license,
    };

    const packageJsonPath = path.join(this.targetPath(), 'package.json');
    const source = await readFile(packageJsonPath);
    const updated = JSON.stringify({ ...JSON.parse(source), ...partial }, null, 2);
    await writeFile(packageJsonPath, updated);
  }

  /**
   * Extracts the tarball in the response to the target directory.
   */
  private async extractProject(res: Response) {
    this.emitPrompt('mkdir', this.targetPath());
    if (!await exists(this.targetPath())) {
      await mkdir(this.targetPath());
    }

    this.emitPrompt('extract tarball');
    await new Promise((resolve, reject) => {
      res.body
        .pipe(extract({ cwd: this.targetPath() }))
        .on('error', reject)
        .on('end', resolve);
    });
  }

  /**
   * Retrieves a stream of the tarball to download.
   */
  private async getTarball(): Promise<Response> {
    const url = this.getTemplateUrl();
    this.emitPrompt('fetch', url);
    const res = await nodeFetch(url);
    if (res.status !== 200) {
      throw new UnexpectedHttpError(res, await res.text());
    }

    return res;
  }

  /**
   * Emits a prompt-style
   */
  private emitPrompt(...contents: string[]) {
    this.emit('data', `> ${contents.join(' ')}\n`);
  }

  /**
   * Returns the URL of the template tarball to download.
   */
  private getTemplateUrl(): string {
    let { template } = this.options;
    if (templateAliases.hasOwnProperty(template)) {
      template = templateAliases[template];
    }
    if (!/https?:/.test(template)) {
      template = `https://mixercc.azureedge.net/launchpad/${template}`;
    }

    return template;
  }

  /**
   * Gets the path to install into.
   */
  private targetPath(): string {
    return path.join(this.options.dir, this.options.projectName);
  }
}
