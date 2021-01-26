import { Component, ElementRef, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';

import { Subscription } from 'rxjs';

import { MotionChangeRecommendationRepositoryService } from 'app/core/repositories/motions/motion-change-recommendation-repository.service';
import { MotionLineNumberingService } from 'app/core/repositories/motions/motion-line-numbering.service';
import { MotionRepositoryService } from 'app/core/repositories/motions/motion-repository.service';
import { ComponentServiceCollector } from 'app/core/ui-services/component-service-collector';
import { MeetingSettingsService } from 'app/core/ui-services/meeting-settings.service';
import { PromptService } from 'app/core/ui-services/prompt.service';
import { ViewUnifiedChange } from 'app/shared/models/motions/view-unified-change';
import { BaseComponent } from 'app/site/base/components/base.component';
import { ViewMotion } from 'app/site/motions/models/view-motion';
import { ViewMotionChangeRecommendation } from 'app/site/motions/models/view-motion-change-recommendation';
import { ChangeRecoMode, LineNumberingMode, verboseChangeRecoMode } from 'app/site/motions/motions.constants';

@Component({
    selector: 'os-motion-highlight-form',
    templateUrl: './motion-highlight-form.component.html',
    styleUrls: ['./motion-highlight-form.component.scss']
})
export class MotionHighlightFormComponent extends BaseComponent implements OnInit {
    @Input()
    public motion: ViewMotion;

    @Output()
    public changeLineNumberingMode = new EventEmitter<LineNumberingMode>();

    @Output()
    public changeChangeRecoMode = new EventEmitter<ChangeRecoMode>();

    public readonly LineNumberingMode = LineNumberingMode;
    public readonly ChangeRecoMode = ChangeRecoMode;

    /**
     * Indicates the currently highlighted line, if any.
     */
    public highlightedLine: number;

    /**
     * Validator for checking the go to line number input field
     */
    public highlightedLineMatcher: ErrorStateMatcher;

    /**
     * Indicates if the highlight line form was opened
     */
    public highlightedLineOpened: boolean;

    /**
     * Holds the model for the typed line number
     */
    public highlightedLineTyping: number;

    /**
     * All amendments to this motion
     */
    public amendments: ViewMotion[] = [];

    /**
     * The change recommendations to amendments to this motion
     */
    public amendmentChangeRecos: { [amendmentId: string]: ViewMotionChangeRecommendation[] } = {};

    /**
     * All change recommendations to this motion
     */
    public changeRecommendations: ViewMotionChangeRecommendation[] = [];

    /**
     * Indicates the Change reco Mode.
     */
    public crMode: ChangeRecoMode;

    public lnMode: LineNumberingMode;

    public verboseChangeRecoMode = verboseChangeRecoMode;

    private finalEditMode = false;

    /**
     * check if the 'final version edit mode' is active
     *
     * @returns true if active
     */
    public get isFinalEdit(): boolean {
        return this.finalEditMode;
    }

    /**
     * Helper to check the current state of the final version edit
     *
     * @returns true if the local edit of the modified_final_version differs
     * from the submitted version
     */
    public get finalVersionEdited(): boolean {
        return (
            this.crMode === ChangeRecoMode.ModifiedFinal
            // && this.contentForm.get('modified_final_version').value !== this.motion.modified_final_version
        );
    }

    public get showCreateFinalVersionButton(): boolean {
        const isModifiedFinalVersion = this.isExisting && this.motion.modified_final_version;
        const isFinalState = this.isExisting && this.motion.state && this.motion.state.isFinalState;
        if (this.isParagraphBasedAmendment || !isFinalState || isModifiedFinalVersion) {
            return false;
        }
        return true;
    }

    public get isStatuteAmendment(): boolean {
        return !!this.isExisting && this.motion.isStatuteAmendment();
    }

    public get isParagraphBasedAmendment(): boolean {
        return this.isExisting && this.motion.isParagraphBasedAmendment();
    }

    public get isExisting(): boolean {
        return !!Object.keys(this.motion).length;
    }

    /**
     * All change recommendations AND amendments, sorted by line number.
     */
    private sortedChangingObjects: ViewUnifiedChange[] = null;

    private lineLength = 0;

    public constructor(
        componentServiceCollector: ComponentServiceCollector,
        private repo: MotionRepositoryService,
        private promptService: PromptService,
        private el: ElementRef,
        private motionLineNumbering: MotionLineNumberingService,
        private changeRecoRepo: MotionChangeRecommendationRepositoryService
    ) {
        super(componentServiceCollector);
    }

    public ngOnInit(): void {
        this.subscriptions.push(...this.subscribeToObservers(), ...this.subscribeToSettings());
        // this.highlightedLineMatcher = new (class implements ErrorStateMatcher {
        //     public isErrorState(control: FormControl): boolean {
        //         const value: string = control && control.value ? control.value + '' : '';
        //         const maxLineNumber = component.repo.getLastLineNumber(component.motion, component.lineLength);
        //         return value.match(/[^\d]/) !== null || parseInt(value, 10) >= maxLineNumber;
        //     }
        // })();
    }

    /**
     * Highlights the line and scrolls to it
     * @param {number} line
     */
    public gotoHighlightedLine(line: number): void {
        const maxLineNumber = this.motionLineNumbering.getLastLineNumber(this.motion, this.lineLength);
        if (line >= maxLineNumber) {
            return;
        }

        this.highlightedLine = line;
        // setTimeout necessary for DOM-operations to work
        window.setTimeout(() => {
            const element = <HTMLElement>this.el.nativeElement;

            // We only scroll if it's not in the screen already
            const bounding = element
                .querySelector('.os-line-number.line-number-' + line.toString(10))
                .getBoundingClientRect();
            if (bounding.top >= 0 && bounding.bottom <= (window.innerHeight || document.documentElement.clientHeight)) {
                return;
            }

            let target: Element;
            // to make the selected line not stick at the very top of the screen, and to prevent it from being
            // conceiled from the header, we actually scroll to a element a little bit above.
            if (line > 4) {
                target = element.querySelector('.os-line-number.line-number-' + (line - 4).toString(10));
            } else {
                target = element.querySelector('.title-line');
            }
            target.scrollIntoView({ behavior: 'smooth' });
        }, 1);
    }

    public hasChangingObjects(): boolean {
        if (this.sortedChangingObjects !== null) {
            return this.sortedChangingObjects.length > 0;
        }

        return (
            (this.changeRecommendations && this.changeRecommendations.length > 0) ||
            (this.amendments && this.amendments.filter(amendment => amendment.isParagraphBasedAmendment()).length > 0)
        );
    }

    /**
     * Activates the 'edit final version' mode
     */
    public editModifiedFinal(): void {
        this.finalEditMode = true;
    }

    /**
     * Sets the modified final version to the final version.
     */
    public async createModifiedFinalVersion(): Promise<void> {
        if (this.motion.isParagraphBasedAmendment()) {
            throw new Error('Cannot create a final version of an amendment.');
        }
        // Get the final version and remove line numbers
        const changes: ViewUnifiedChange[] = Object.assign([], this.getChangesForFinalMode());
        // let finalVersion = this.repo.formatMotion(
        //     this.motion.id,
        //     ChangeRecoMode.Final,
        //     changes,
        //     this.lineLength,
        //     this.highlightedLine
        // );
        throw new Error('Todo');
        // finalVersion = this.linenumberingService.stripLineNumbers(finalVersion);

        // Update the motion
        try {
            // Just confirm this, if there is one modified final version the user would override.
            // await this.updateMotion({ modified_final_version: finalVersion }, this.motion);
        } catch (e) {
            this.raiseError(e);
        }
    }

    /**
     * Deletes the modified final version
     */
    public async deleteModifiedFinalVersion(): Promise<void> {
        const title = this.translate.instant('Are you sure you want to delete the print template?');
        if (await this.promptService.open(title)) {
            // this.finalEditMode = false;
            // this.updateMotion({ modified_final_version: '' }, this.motion).then(
            //     () => this.setChangeRecoMode(ChangeRecoMode.Final),
            //     this.raiseError
            // );
        }
    }

    public getChangesForFinalMode(): ViewUnifiedChange[] {
        // return this.getAllChangingObjectsSorted().filter(change => {
        //     return change.showInFinalView();
        // });
        throw new Error('Todo');
    }

    public getAllTextChangingObjects(): ViewUnifiedChange[] {
        // return this.getAllChangingObjectsSorted().filter((obj: ViewUnifiedChange) => !obj.isTitleChange());
        throw new Error('Todo');
    }

    /**
     * Submits the modified final version of the motion
     */
    public onSubmitFinalVersion(): void {
        throw new Error('Todo');
        // const val = this.contentForm.get('modified_final_version').value;
        // this.updateMotion({ modified_final_version: val }, this.motion).then(() => {
        //     this.finalEditMode = false;
        //     this.contentForm.get('modified_final_version').markAsPristine();
        // }, this.raiseError);
    }

    /**
     * Cancels the final version edit and resets the form value
     *
     * TODO: the tinyMCE editor content should reset, too
     */
    public cancelFinalVersionEdit(): void {
        // this.finalEditMode = false;
        throw new Error('Todo');
        // this.contentForm.patchValue({ modified_final_version: this.motion.modified_final_version });
    }

    public setChangeRecoMode(mode: ChangeRecoMode): void {
        this.crMode = mode;
        this.changeChangeRecoMode.emit(mode);
    }

    public isRecoMode(mode: ChangeRecoMode): boolean {
        return this.crMode === mode;
    }

    /**
     * Sets the motions line numbering mode
     *
     * @param mode Needs to got the enum defined in ViewMotion
     */
    public setLineNumberingMode(mode: LineNumberingMode): void {
        this.lnMode = mode;
        this.changeLineNumberingMode.emit(mode);
    }

    /**
     * Tries to determine the realistic CR-Mode from a given CR mode
     */
    private determineCrMode(mode: ChangeRecoMode): ChangeRecoMode {
        if (mode === ChangeRecoMode.Final) {
            if (this.motion?.modified_final_version) {
                return ChangeRecoMode.ModifiedFinal;
                /**
                 * Because without change recos you cannot escape the final version anymore
                 */
            } else if (!this.hasChangingObjects()) {
                return ChangeRecoMode.Original;
            }
        } else if (mode === ChangeRecoMode.Changed && !this.hasChangingObjects()) {
            /**
             * Because without change recos you cannot escape the changed version view
             * You will not be able to automatically change to the Changed view after creating
             * a change reco. The autoupdate has to come "after" this routine
             */
            return ChangeRecoMode.Original;
        } else if (
            mode === ChangeRecoMode.Diff &&
            !this.changeRecommendations?.length &&
            this.motion?.isParagraphBasedAmendment()
        ) {
            /**
             * The Diff view for paragraph-based amendments is only relevant for change recommendations;
             * the regular amendment changes are shown in the "original" view.
             */
            return ChangeRecoMode.Original;
        }
        return mode;
    }

    private subscribeToObservers(): Subscription[] {
        return [
            this.repo.amendmentsTo(this.motion.id).subscribe((amendments: ViewMotion[]): void => {
                console.log('amendments:', amendments);
                this.amendments = amendments;
                // this.resetAmendmentChangeRecoListener();
                // this.recalcUnifiedChanges();
            }),
            this.changeRecoRepo
                .getChangeRecosOfMotionObservable(this.motion.id)
                .subscribe((recos: ViewMotionChangeRecommendation[]) => {
                    console.log('changeRecommendations', recos);
                    this.changeRecommendations = recos;
                    // this.recalcUnifiedChanges();
                })
        ];
    }

    private subscribeToSettings(): Subscription[] {
        return [
            this.meetingSettingService.get('motions_line_length').subscribe(lineLength => {
                this.lineLength = lineLength;
                this.sortedChangingObjects = null;
            }),
            this.meetingSettingService
                .get('motions_default_line_numbering')
                .subscribe(mode => this.setLineNumberingMode(mode)),
            this.meetingSettingService.get('motions_recommendation_text_mode').subscribe(mode => {
                if (mode) {
                    this.crMode = this.determineCrMode(mode as ChangeRecoMode);
                }
            })
        ];
    }
}
