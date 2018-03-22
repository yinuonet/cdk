import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Actions } from '@ngrx/effects';
import { Store } from '@ngrx/store';

import { map } from 'rxjs/operators';
import * as fromRoot from '../../bedrock.reducers';
import { AppendCreateUpdate, NewProjectActionTypes } from '../new-project.actions';
import * as fromNewProject from '../new-project.reducer';

/**
 * The CompleteComponent is the screen shown after the installation completes.
 */
@Component({
  selector: 'new-project-creating',
  templateUrl: './creating.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreatingComponent {
  /**
   * Observable of data to print into the console.
   */
  public consoleData = this.actions
    .ofType(NewProjectActionTypes.CREATE_UPDATE)
    .pipe(map(update => (<AppendCreateUpdate>update).data));

  /**
   * Observable of the creation error, if any.
   */
  public creationError = this.store.select(fromNewProject.creationError);

  constructor(private readonly store: Store<fromRoot.IState>, private readonly actions: Actions) {}
}
