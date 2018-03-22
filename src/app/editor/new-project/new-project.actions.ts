import { Action } from '@ngrx/store';
import { IQuickstartOptions } from '../../../server/quickstart';

export interface IPackageDetails {
  projectName: string;
  author: string;
  description: string;
  keywords: string;
  license: string;
}

export enum NewProjectScreen {
  Welcome,
  Layout,
  Template,
  PackageDetails,
  Creating,
  Complete,
}

export const enum NewProjectActionTypes {
  CHANGE_SCREEN = '[NewProject] Set Displayed Screen',
  SET_TARGET_DIRECTORY = '[NewProject] Set Target Directory',
  SET_LAYOUT = '[NewProject] Set Starter Layout',
  SET_TEMPLATE = '[NewProject] Set Quickstart File Template',
  SET_PACKAGE_DETAILS = '[NewProject] Set Package Details',
  CREATE_START = '[NewProject] Start Project Creation',
  CREATE_UPDATE = '[NewProject] Update Creation Status',
  CREATE_COMPLETE = '[NewProject] Set Project Creation Completed',
  CANCEL = '[NewProject] Cancel Project Creation',
}

export const enum NewProjectMethods {
  StartCreate = '[NewProject] Start Project Creation',
}

/**
 * Fired to change the screen currently displayed in the modal.
 */
export class ChangeScreen implements Action {
  public readonly type = NewProjectActionTypes.CHANGE_SCREEN;

  constructor(public readonly screen: NewProjectScreen) {}
}

/**
 * Fired to cancel the installation.
 */
export class Cancel implements Action {
  public readonly type = NewProjectActionTypes.CANCEL;
}

/**
 * Fired to change the directory where the project will be installed.
 */
export class SetTargetDirectory implements Action {
  public readonly type = NewProjectActionTypes.SET_TARGET_DIRECTORY;

  constructor(public readonly directory: string) {}
}

/**
 * Fired to update the project's starting layout.
 */
export class SetLayout implements Action {
  public readonly type = NewProjectActionTypes.SET_LAYOUT;

  constructor(public readonly layout: string) {}
}

/**
 * Fired to update project details.
 */
export class SetDetails implements Action {
  public readonly type = NewProjectActionTypes.SET_PACKAGE_DETAILS;

  constructor(public readonly details: Readonly<IPackageDetails>) {}
}

/**
 * Fired to update the project template to download.
 */
export class SetTemplate implements Action {
  public readonly type = NewProjectActionTypes.SET_TEMPLATE;

  constructor(public readonly template: string) {}
}

/**
 * Called by the server when new console data is received to be displayed
 * on the quickstart screen.
 */
export class AppendCreateUpdate implements Action {
  public readonly type = NewProjectActionTypes.CREATE_UPDATE;

  constructor(public readonly data: string) {}
}

/**
 * Called and acted upon by the effect to spawn a quickstart.
 */
export class StartCreating implements Action {
  public readonly type = NewProjectActionTypes.CREATE_START;

  constructor(public readonly options: IQuickstartOptions) {}
}

/**
 * Fired by the module effects when a previous creation command has finished.
 * Contains an optional error string.
 */
export class FinishCreating implements Action {
  public readonly type = NewProjectActionTypes.CREATE_COMPLETE;

  constructor(public readonly error?: string) {}
}

export type NewProjectActions =
  | ChangeScreen
  | Cancel
  | SetTargetDirectory
  | SetLayout
  | SetDetails
  | SetTemplate
  | AppendCreateUpdate
  | StartCreating
  | FinishCreating;
