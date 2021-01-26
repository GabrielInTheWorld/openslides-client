import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ElementRef,
    HostListener,
    OnDestroy,
    OnInit,
    TemplateRef,
    ViewChild,
    ViewEncapsulation
} from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { MatCheckboxChange } from '@angular/material/checkbox';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';

import { BehaviorSubject, Observable, Subscription } from 'rxjs';

import { MotionAction } from 'app/core/actions/motion-action';
import { NotifyService } from 'app/core/core-services/notify.service';
import { OperatorService } from 'app/core/core-services/operator.service';
import { Id } from 'app/core/definitions/key-types';
import { AgendaItemRepositoryService } from 'app/core/repositories/agenda/agenda-item-repository.service';
import { MotionBlockRepositoryService } from 'app/core/repositories/motions/motion-block-repository.service';
import { MotionCategoryRepositoryService } from 'app/core/repositories/motions/motion-category-repository.service';
import { MotionChangeRecommendationRepositoryService } from 'app/core/repositories/motions/motion-change-recommendation-repository.service';
import {
    GET_POSSIBLE_RECOMMENDATIONS,
    MotionRepositoryService
} from 'app/core/repositories/motions/motion-repository.service';
import { MotionStatuteParagraphRepositoryService } from 'app/core/repositories/motions/motion-statute-paragraph-repository.service';
import { MotionWorkflowRepositoryService } from 'app/core/repositories/motions/motion-workflow-repository.service';
import { TagRepositoryService } from 'app/core/repositories/tags/tag-repository.service';
import { NewUser, UserRepositoryService } from 'app/core/repositories/users/user-repository.service';
import { ComponentServiceCollector } from 'app/core/ui-services/component-service-collector';
import { DiffLinesInParagraph, LineRange } from 'app/core/ui-services/diff.service';
import { LinenumberingService } from 'app/core/ui-services/linenumbering.service';
import { MeetingSettingsService } from 'app/core/ui-services/meeting-settings.service';
import { PromptService } from 'app/core/ui-services/prompt.service';
import { ViewportService } from 'app/core/ui-services/viewport.service';
import { SPEAKER_BUTTON_FOLLOW } from 'app/shared/components/speaker-button/speaker-button.component';
import { Settings } from 'app/shared/models/event-management/meeting';
import { Mediafile } from 'app/shared/models/mediafiles/mediafile';
import { ViewUnifiedChange } from 'app/shared/models/motions/view-unified-change';
import { infoDialogSettings, mediumDialogSettings } from 'app/shared/utils/dialog-settings';
import { BaseModelContextComponent } from 'app/site/base/components/base-model-context.component';
import { ViewMeeting } from 'app/site/event-management/models/view-meeting';
import { ViewMotion } from 'app/site/motions/models/view-motion';
import { ViewMotionBlock } from 'app/site/motions/models/view-motion-block';
import { ViewMotionCategory } from 'app/site/motions/models/view-motion-category';
import { ViewMotionChangeRecommendation } from 'app/site/motions/models/view-motion-change-recommendation';
import { ViewMotionPoll } from 'app/site/motions/models/view-motion-poll';
import { ViewMotionState } from 'app/site/motions/models/view-motion-state';
import { ViewMotionStatuteParagraph } from 'app/site/motions/models/view-motion-statute-paragraph';
import { ViewMotionWorkflow } from 'app/site/motions/models/view-motion-workflow';
import { MotionEditNotification } from 'app/site/motions/motion-edit-notification';
import {
    ChangeRecoMode,
    LineNumberingMode,
    MotionEditNotificationType,
    PERSONAL_NOTE_ID,
    verboseChangeRecoMode
} from 'app/site/motions/motions.constants';
import { AmendmentFilterListService } from 'app/site/motions/services/amendment-filter-list.service';
import { AmendmentSortListService } from 'app/site/motions/services/amendment-sort-list.service';
import { MotionFilterListService } from 'app/site/motions/services/motion-filter-list.service';
import { MotionPdfExportService } from 'app/site/motions/services/motion-pdf-export.service';
import { MotionPollDialogService } from 'app/site/motions/services/motion-poll-dialog.service';
import { MotionPollService } from 'app/site/motions/services/motion-poll.service';
import { MotionSortListService } from 'app/site/motions/services/motion-sort-list.service';
import { PermissionsService } from 'app/site/motions/services/permissions.service';
import { ViewTag } from 'app/site/tags/models/view-tag';
import { ViewUser } from 'app/site/users/models/view-user';
import {
    MotionChangeRecommendationDialogComponent,
    MotionChangeRecommendationDialogComponentData
} from '../motion-change-recommendation-dialog/motion-change-recommendation-dialog.component';
import { MotionContentComponent } from '../motion-content/motion-content.component';
import {
    MotionTitleChangeRecommendationDialogComponent,
    MotionTitleChangeRecommendationDialogComponentData
} from '../motion-title-change-recommendation-dialog/motion-title-change-recommendation-dialog.component';

/**
 * Component for the motion detail view
 */
@Component({
    selector: 'os-motion-detail',
    templateUrl: './motion-detail.component.html',
    styleUrls: ['./motion-detail.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None
})
export class MotionDetailComponent extends BaseModelContextComponent implements OnInit, OnDestroy {
    // /**
    //  * Motion content. Can be a new version
    //  */
    // public contentForm: FormGroup;

    @ViewChild('content', { static: true })
    public motionContent: TemplateRef<MotionContentComponent>;

    /**
     * Determine if the motion is edited
     */
    public editMotion = false;

    /**
     * Determine if the motion is a new (unsent) amendment to another motion
     */
    public amendmentEdit = false;

    /**
     * Determine if the motion is new
     */
    public newMotion = false;

    /**
     * Toggle to expand/hide the motion log.
     */
    public motionLogExpanded = false;

    /**
     * Sets the motions, e.g. via an autoupdate. Reload important things here:
     * - Reload the recommendation. Not changed with autoupdates, but if the motion is loaded this needs to run.
     */
    public set motion(value: ViewMotion) {
        this._motion = value;
        // this.setupRecommender();
    }

    /**
     * Returns the target motion. Might be the new one or old.
     */
    public get motion(): ViewMotion {
        return this._motion;
    }

    // /**
    //  * @returns the current recommendation label (with extension)
    //  */
    // public get recommendationLabel(): string {
    //     return this.repo.getExtendedRecommendationLabel(this.motion);
    // }

    // /**
    //  * @returns the current state label (with extension)
    //  */
    // public get stateLabel(): string {
    //     return this.repo.getExtendedStateLabel(this.motion);
    // }

    // private finalEditMode = false;

    // /**
    //  * check if the 'final version edit mode' is active
    //  *
    //  * @returns true if active
    //  */
    // public get isFinalEdit(): boolean {
    //     return this.finalEditMode;
    // }

    // /**
    //  * Helper to check the current state of the final version edit
    //  *
    //  * @returns true if the local edit of the modified_final_version differs
    //  * from the submitted version
    //  */
    // public get finalVersionEdited(): boolean {
    //     return (
    //         this.crMode === ChangeRecoMode.ModifiedFinal &&
    //         this.contentForm.get('modified_final_version').value !== this.motion.modified_final_version
    //     );
    // }

    public get showPreamble(): boolean {
        return this.motion.showPreamble;
    }

    // public get showCreateFinalVersionButton(): boolean {
    //     if (
    //         this.motion.isParagraphBasedAmendment() ||
    //         !this.motion.state.isFinalState ||
    //         this.motion.modified_final_version
    //     ) {
    //         return false;
    //     }
    //     return true;
    // }

    /**
     * Saves the target motion. Accessed via the getter and setter.
     */
    private _motion: ViewMotion;

    /**
     * Value of the config variable `motions_statutes_enabled` - are statutes enabled?
     * @TODO replace by direct access to config variable, once it's available from the templates
     */
    public statutesEnabled: boolean;

    // /**
    //  * Value of the config variable `motions_show_sequential_numbers`
    //  */
    // public showSequential: boolean;

    // /**
    //  * Value of the config variable `motions_reason_required`
    //  */
    // public reasonRequired: boolean;

    // /**
    //  * Value of the config variable `motions_hide_referring_motions`
    //  */
    // public showReferringMotions: boolean;

    // /**
    //  * Value of the config variable `motions_min_supporters`
    //  */
    // // public minSupporters: number;
    // /**
    //  * TODO service does not exist
    //  */
    // public minSupporters = 1;

    /**
     * Value of the config variable `motions_preamble`
     */
    public preamble: string;

    /**
     * Value of the configuration variable `motions_amendments_enabled` - are amendments enabled?
     * @TODO replace by direct access to config variable, once it's available from the templates
     */
    public amendmentsEnabled: boolean;

    /**
     * All change recommendations to this motion
     */
    public changeRecommendations: ViewMotionChangeRecommendation[];

    /**
     * All amendments to this motion
     */
    public amendments: ViewMotion[];

    /**
     * The change recommendations to amendments to this motion
     */
    public amendmentChangeRecos: { [amendmentId: string]: ViewMotionChangeRecommendation[] } = {};

    // /**
    //  * All change recommendations AND amendments, sorted by line number.
    //  */
    // private sortedChangingObjects: ViewUnifiedChange[] = null;

    /**
     * The observables for the `amendmentChangeRecos` field above.
     * Necessary to track which amendments' change recommendations we have already subscribed to.
     */
    public amendmentChangeRecoSubscriptions: { [amendmentId: string]: Subscription } = {};

    /**
     * preload the next motion for direct navigation
     */
    public nextMotion: ViewMotion;

    /**
     * preload the previous motion for direct navigation
     */
    public previousMotion: ViewMotion;

    // /**
    //  * statute paragraphs, necessary for amendments
    //  */
    // public statuteParagraphs: ViewMotionStatuteParagraph[] = [];

    // /**
    //  * Subject for the Categories
    //  */
    // public categoryObserver: BehaviorSubject<ViewMotionCategory[]>;

    // /**
    //  * Subject for the Categories
    //  */
    // public workflowObserver: BehaviorSubject<ViewMotionWorkflow[]>;

    // /**
    //  * Subject for the Submitters
    //  */
    // public submitterObserver: BehaviorSubject<ViewUser[]>;

    // /**
    //  * Subject for the Supporters
    //  */
    // public supporterObserver: BehaviorSubject<ViewUser[]>;

    // // /**
    // //  * Subject for the motion blocks
    // //  */
    // // public blockObserver: BehaviorSubject<ViewMotionBlock[]>;

    // // /**
    // //  * Subject for tags
    // //  */
    // // public tagObserver: BehaviorSubject<ViewTag[]>;

    /**
     * Subject for (other) motions
     */
    public motionObserver: BehaviorSubject<ViewMotion[]>;

    /**
     * List of presorted motions. Filles by sort service
     * and filter service.
     * To navigate back and forth
     */
    private sortedMotions: ViewMotion[];

    /**
     * The observable for the list of motions. Set in OnInit
     */
    private sortedMotionsObservable: Observable<ViewMotion[]>;

    /**
     * Determine if the name of supporters are visible
     */
    public showSupporters = false;

    // /**
    //  * Value for os-motion-detail-diff: when this is set, that component scrolls to the given change
    //  */
    // public scrollToChange: ViewUnifiedChange = null;

    // /**
    //  * Custom recommender as set in the settings
    //  */
    // public recommender: string;

    // /**
    //  * The subscription to the recommender config variable.
    //  */
    // private recommenderSubscription: Subscription;

    /**
     * If this is a paragraph-based amendment, this indicates if the non-affected paragraphs should be shown as well
     */
    public showAmendmentContext = false;

    /**
     * Show all amendments in the text, not only the ones with the apropriate state
     */
    public showAllAmendments = false;

    /**
     * For using the enum constants from the template
     */
    public ChangeRecoMode = ChangeRecoMode;

    // public verboseChangeRecoMode = verboseChangeRecoMode;

    /**
     * For using the enum constants from the template
     */
    public LineNumberingMode = LineNumberingMode;

    /**
     * Indicates the LineNumberingMode Mode.
     */
    public lnMode: LineNumberingMode;

    /**
     * Indicates the Change reco Mode.
     */
    public crMode: ChangeRecoMode = ChangeRecoMode.Original;

    // /**
    //  * Indicates the maximum line length as defined in the configuration.
    //  */
    // public lineLength: number;

    // /**
    //  * Indicates the currently highlighted line, if any.
    //  */
    // public highlightedLine: number;

    // /**
    //  * Validator for checking the go to line number input field
    //  */
    // public highlightedLineMatcher: ErrorStateMatcher;

    // /**
    //  * Indicates if the highlight line form was opened
    //  */
    // public highlightedLineOpened: boolean;

    // /**
    //  * Holds the model for the typed line number
    //  */
    // public highlightedLineTyping: number;

    // /**
    //  * new state extension label to be submitted, if state extensions can be set
    //  */
    // public newStateExtension = '';

    // /**
    //  * State extension label for the recommendation.
    //  */
    // public recommendationStateExtension = '';

    // /**
    //  * Constant to identify the notification-message.
    //  */
    // public NOTIFICATION_EDIT_MOTION = 'notifyEditMotion';

    public commentIds: Id[] = [];

    public temporaryMotion = {};

    // /**
    //  * Array to recognize, if there are other persons working on the same
    //  * motion and see, if those persons leave the editing-view.
    //  */
    // private otherWorkOnMotion: string[] = [];

    // /**
    //  * The variable to hold the subscription for notifications in editing-view.
    //  * Necessary to unsubscribe after leaving the editing-view.
    //  */
    // private editNotificationSubscription: Subscription;

    /**
     * Hold the subscription to the navigation.
     * This cannot go into the subscription-list, since it should
     * only get destroyed using ngOnDestroy routine and not on route changes.
     */
    private navigationSubscription: Subscription;

    // public recommendationReferencingMotions: ViewMotion[] = [];

    public constructor(
        componentServiceCollector: ComponentServiceCollector,
        public vp: ViewportService,
        public operator: OperatorService,
        public perms: PermissionsService,
        private router: Router,
        private route: ActivatedRoute,
        private formBuilder: FormBuilder,
        private dialogService: MatDialog,
        private el: ElementRef,
        public repo: MotionRepositoryService,
        private changeRecoRepo: MotionChangeRecommendationRepositoryService,
        private statuteRepo: MotionStatuteParagraphRepositoryService,
        private promptService: PromptService,
        private pdfExport: MotionPdfExportService,
        private linenumberingService: LinenumberingService,
        private categoryRepo: MotionCategoryRepositoryService,
        private userRepo: UserRepositoryService,
        private notifyService: NotifyService,
        private tagRepo: TagRepositoryService,
        private workflowRepo: MotionWorkflowRepositoryService,
        private blockRepo: MotionBlockRepositoryService,
        private itemRepo: AgendaItemRepositoryService,
        private motionSortService: MotionSortListService,
        private amendmentSortService: AmendmentSortListService,
        private motionFilterService: MotionFilterListService,
        private amendmentFilterService: AmendmentFilterListService,
        private cd: ChangeDetectorRef,
        // private pollDialog: MotionPollDialogService,
        // private motionPollService: MotionPollService,
        private meetingSettingsService: MeetingSettingsService
    ) {
        super(componentServiceCollector);
    }

    /**
     * Init.
     * Sets all required subjects and fills in the required information
     */
    public ngOnInit(): void {
        super.ngOnInit();

        this.requestUpdates();
        this.registerSubjects();
        // this.createForm();
        this.observeRoute();
        this.getMotionByUrl();

        // load config variables
        this.meetingSettingsService
            .get('motions_statutes_enabled')
            .subscribe(enabled => (this.statutesEnabled = enabled));
        // this.meetingSettingsService
        //     .get('motions_reason_required')
        //     .subscribe(required => (this.reasonRequired = required));
        // this.meetingSettingsService
        //     .get('motions_show_referring_motions')
        //     .subscribe(show => (this.showReferringMotions = show));
        // this.meetingSettingsService
        //     .get('motions_supporters_min_amount')
        //     .subscribe(supporters => (this.minSupporters = supporters));
        this.meetingSettingsService.get('motions_preamble').subscribe(preamble => (this.preamble = preamble));
        this.meetingSettingsService
            .get('motions_amendments_enabled')
            .subscribe(enabled => (this.amendmentsEnabled = enabled));
        // this.meetingSettingsService.get('motions_line_length').subscribe(lineLength => {
        //     this.lineLength = lineLength;
        //     this.sortedChangingObjects = null;
        // });
        // this.meetingSettingsService
        //     .get('motions_default_line_numbering')
        //     .subscribe(mode => (this.lnMode = mode as LineNumberingMode));
        // this.meetingSettingsService.get('motions_recommendation_text_mode').subscribe(mode => {
        //     if (mode) {
        //         this.crMode = this.determineCrMode(mode as ChangeRecoMode);
        //     }
        // });
        // this.meetingSettingsService
        //     .get('motions_show_sequential_number')
        //     .subscribe(shown => (this.showSequential = shown));

        // Update statute paragraphs
        // this.statuteRepo.getViewModelListObservable().subscribe(newViewStatuteParagraphs => {
        //     this.statuteParagraphs = newViewStatuteParagraphs;
        // });

        // use the filter and the search service to get the current sorting
        // TODO: the `instant` can fail, if the page reloads.
        if (this.meetingSettingsService.instant('motions_amendments_in_main_list')) {
            this.motionFilterService.initFilters(this.motionObserver);
            this.motionSortService.initSorting(this.motionFilterService.outputObservable);
            this.sortedMotionsObservable = this.motionSortService.outputObservable;
        } else if (this.motion && this.motion.lead_motion_id) {
            // only use the amendments for this motion
            this.amendmentFilterService.initFilters(this.repo.amendmentsTo(this.motion.lead_motion_id));
            this.amendmentSortService.initSorting(this.amendmentFilterService.outputObservable);
            this.sortedMotionsObservable = this.amendmentSortService.outputObservable;
        } else {
            this.sortedMotions = [];
        }

        if (this.sortedMotionsObservable) {
            this.subscriptions.push(
                this.sortedMotionsObservable.subscribe(motions => {
                    if (motions) {
                        this.sortedMotions = motions;
                        this.setSurroundingMotions();
                    }
                })
            );
        }

        /**
         * Check for changes of the viewport subject changes
         */
        this.vp.isMobileSubject.subscribe(() => {
            this.cd.markForCheck();
        });
    }

    /**
     * Called during view destruction.
     * Sends a notification to user editors of the motion was edited
     */
    public ngOnDestroy(): void {
        super.ngOnDestroy();

        // this.unsubscribeEditNotifications(MotionEditNotificationType.TYPE_CLOSING_EDITING_MOTION);
        if (this.navigationSubscription) {
            this.navigationSubscription.unsubscribe();
        }
        this.cd.detach();
    }

    /**
     * Observes the route for events. Calls to clean all subs if the route changes.
     * Calls the motion details from the new route
     */
    public observeRoute(): void {
        this.navigationSubscription = this.router.events.subscribe(navEvent => {
            if (navEvent instanceof NavigationEnd) {
                this.cleanSubjects();
                this.getMotionByUrl();
            }
        });
    }

    private registerSubjects(): void {
        // get required information from the repositories
        // this.tagObserver = this.tagRepo.getViewModelListBehaviorSubject();
        // this.workflowObserver = this.workflowRepo.getViewModelListBehaviorSubject();
        // this.blockObserver = this.blockRepo.getViewModelListBehaviorSubject();
        this.motionObserver = this.repo.getViewModelListBehaviorSubject();
        // this.submitterObserver = this.userRepo.getViewModelListBehaviorSubject();
        // this.supporterObserver = this.userRepo.getViewModelListBehaviorSubject();
        // this.categoryObserver = this.categoryRepo.getViewModelListBehaviorSubject();

        // since updates are usually not commig at the same time, every change to
        // any subject has to mark the view for chekcing
        this.subscriptions.push(
            // this.tagObserver.subscribe(() => this.cd.markForCheck()),
            // this.workflowObserver.subscribe(() => this.cd.markForCheck()),
            // this.blockObserver.subscribe(() => this.cd.markForCheck()),
            this.motionObserver.subscribe(() => this.cd.markForCheck())
            // this.submitterObserver.subscribe(() => this.cd.markForCheck()),
            // this.supporterObserver.subscribe(() => this.cd.markForCheck()),
            // this.categoryObserver.subscribe(() => this.cd.markForCheck())
        );
    }

    private requestUpdates(): void {
        this.requestModels({
            viewModelCtor: ViewMeeting,
            ids: [1], // TODO
            follow: [
                {
                    idField: 'user_ids',
                    fieldset: 'shortName'
                },
                // {
                //     idField: 'motion_category_ids'
                // },
                {
                    idField: 'motion_block_ids',
                    fieldset: 'title'
                },
                {
                    idField: 'motion_workflow_ids'
                },
                {
                    idField: 'mediafile_ids',
                    fieldset: 'fileSelection'
                },
                {
                    idField: 'tag_ids'
                },
                {
                    idField: 'personal_note_ids'
                }
                // {
                //     idField: 'motion_workflow_ids'
                // }
            ]
        });
    }

    /**
     * determine the motion to display using the URL
     */
    public getMotionByUrl(): void {
        if (this.route.snapshot.params?.id) {
            this.subscriptions.push(
                this.route.params.subscribe(routeParams => {
                    this.loadMotionById(Number(routeParams.id));
                })
            );
        } else {
            super.setTitle('New motion');
            // new motion
            this.newMotion = true;
            this.editMotion = true;
            const defaultMotion: any = {};
            if (this.route.snapshot.queryParams.parent) {
                const parentId = +this.route.snapshot.queryParams.parent;
                this.amendmentEdit = true;
                const parentMotion = this.repo.getViewModel(parentId);
                const defaultTitle = `${this.translate.instant('Amendment to')} ${parentMotion.numberOrTitle}`;
                defaultMotion.title = defaultTitle;
                defaultMotion.lead_motion_id = parentMotion.id;
                defaultMotion.category_id = parentMotion.category_id;
                defaultMotion.tag_ids = parentMotion.tag_ids;
                defaultMotion.block_id = parentMotion.block_id;
                // this.contentForm.patchValue({
                //     title: defaultTitle,
                //     category_id: parentMotion.category_id,
                //     block_id: parentMotion.block_id,
                //     parent_id: parentMotion.id,
                //     tag_ids: parentMotion.tag_ids
                // });

                const amendmentTextMode = this.meetingSettingsService.instant('motions_amendments_text_mode');
                if (amendmentTextMode === 'fulltext') {
                    defaultMotion.text = parentMotion.text;
                    // this.contentForm.patchValue({ text: defaultMotion.text });
                }
            }
            this.motion = defaultMotion;
            // this.motion = new ViewCreateMotion(new CreateMotion(defaultMotion));
        }
    }

    private loadMotionById(motionId: number): void {
        this.requestModels({
            viewModelCtor: ViewMotion,
            ids: [motionId],
            follow: [
                'block_id',
                'category_id',
                'lead_motion_id',
                'comment_ids',
                // 'workflow_id',
                {
                    idField: 'change_recommendation_ids'
                },
                {
                    idField: 'amendment_ids',
                    follow: [
                        {
                            idField: 'lead_motion_id',
                            fieldset: 'amendment'
                        }
                    ]
                },
                {
                    idField: 'submitter_ids',
                    follow: [
                        {
                            idField: 'user_id',
                            fieldset: 'shortName'
                        }
                    ]
                },
                {
                    idField: 'supporter_ids',
                    fieldset: 'shortName'
                },
                {
                    idField: 'state_id',
                    follow: [
                        {
                            idField: 'next_state_ids'
                        },
                        GET_POSSIBLE_RECOMMENDATIONS
                    ]
                    // fieldset: 'list'
                },
                'recommendation_id',
                'tag_ids',
                SPEAKER_BUTTON_FOLLOW
            ]
        });

        this.subscriptions.push(
            this.repo.getViewModelObservable(motionId).subscribe(motion => {
                if (motion) {
                    if (motion.isParagraphBasedAmendment()) {
                        // this.contentForm.get('text').clearValidators();
                        // this.contentForm.get('text').updateValueAndValidity();
                    }
                    const title = motion.getTitle();
                    super.setTitle(title);
                    this.motion = motion;
                    // this.newStateExtension = this.motion.stateExtension;
                    this.commentIds = motion.comment_ids;
                    // this.recommendationStateExtension = this.motion.recommendationExtension;
                    // if (!this.editMotion) {
                    //     this.patchForm(this.motion);
                    // }
                    this.cd.markForCheck();
                }
            })
        );
    }

    /**
     * Using Shift, Alt + the arrow keys will navigate between the motions
     *
     * @param event has the key code
     */
    @HostListener('document:keydown', ['$event']) public onKeyNavigation(event: KeyboardEvent): void {
        if (event.key === 'ArrowLeft' && event.altKey && event.shiftKey) {
            this.navigateToMotion(this.previousMotion);
        }
        if (event.key === 'ArrowRight' && event.altKey && event.shiftKey) {
            this.navigateToMotion(this.nextMotion);
        }
    }

    /**
     * Creates a motion. Calls the "patchValues" function in the MotionObject
     */
    public async createMotion(newMotionValues: Partial<MotionAction.CreatePayload>): Promise<void> {
        try {
            const response = await this.repo.create(newMotionValues);
            this.router.navigate(['./motions/' + response.id]);
        } catch (e) {
            this.raiseError(e);
        }
    }

    private async updateMotion(
        newMotionValues: Partial<MotionAction.UpdatePayload>,
        motion: ViewMotion
    ): Promise<void> {
        await this.repo.update(newMotionValues, motion);
    }

    /**
     * In the ui are no distinct buttons for update or create. This is decided here.
     */
    public saveMotion(event?: Partial<MotionAction.CreatePayload>): void {
        console.log('saveMotion', event || this.temporaryMotion);
        if (this.newMotion) {
            this.createMotion(event || this.temporaryMotion);
        } else {
            this.updateMotion(event, this.motion);
            // When saving the changes, notify other users if they edit the same motion.
            // this.unsubscribeEditNotifications(MotionEditNotificationType.TYPE_SAVING_EDITING_MOTION);
        }
    }

    public getPossibleRecommendations(): ViewMotionState[] {
        const allStates = this.motion.state?.workflow.states || [];
        return allStates.filter(state => state.recommendation_label);
    }

    /**
     * get the formated motion text from the repository.
     *
     * @returns formated motion texts
     */
    public getFormattedTextPlain(): string {
        // Prevent this.sortedChangingObjects to be reordered from within formatMotion
        // let changes: ViewUnifiedChange[];
        // if (this.crMode === ChangeRecoMode.Original) {
        //     changes = [];
        // } else {
        //     changes = Object.assign([], this.getAllTextChangingObjects());
        // }
        // const formattedText = this.repo.formatMotion(
        //     this.motion.id,
        //     this.crMode,
        //     changes,
        //     this.lineLength,
        //     this.highlightedLine
        // );
        // return formattedText;
        throw new Error('Todo');
    }

    /**
     * This returns the plain HTML of a changed area in an amendment, including its context,
     * for the purpose of piping it into <motion-detail-original-change-recommendations>.
     * This component works with plain HTML, hence we are composing plain HTML here, too.
     *
     * @param {DiffLinesInParagraph} paragraph
     * @returns {string}
     *
     * TODO: Seems to be directly duplicated in the slide
     */
    public getAmendmentDiffTextWithContext(paragraph: DiffLinesInParagraph): string {
        return (
            '<div class="paragraphcontext">' +
            paragraph.textPre +
            '</div>' +
            '<div>' +
            paragraph.text +
            '</div>' +
            '<div class="paragraphcontext">' +
            paragraph.textPost +
            '</div>'
        );
    }

    /**
     * If `this.motion` is an amendment, this returns the list of all changed paragraphs.
     * TODO: Cleanup: repo function could be injected part of the model, to have easier access
     *
     * @returns {DiffLinesInParagraph[]}
     */
    public getAmendmentParagraphs(): DiffLinesInParagraph[] {
        throw new Error('Todo');
        // return this.repo.getAmendmentParagraphLines(
        //     this.motion,
        //     this.lineLength,
        //     this.crMode,
        //     this.changeRecommendations,
        //     this.showAmendmentContext
        // );
    }

    public getAmendmentParagraphLinesTitle(paragraph: DiffLinesInParagraph): string {
        // return this.repo.getAmendmentParagraphLinesTitle(paragraph);
        throw new Error('todo');
    }

    /**
     * get the diff html from the statute amendment, as SafeHTML for [innerHTML]
     *
     * @returns safe html strings
     */
    public getFormattedStatuteAmendment(): string {
        throw new Error('Todo');
        // return this.repo.formatStatuteAmendment(this.statuteParagraphs, this.motion, this.lineLength);
    }

    public getChangesForDiffMode(): ViewUnifiedChange[] {
        throw new Error('Todo');
        // return this.getAllChangingObjectsSorted().filter(change => {
        //     if (this.showAllAmendments) {
        //         return true;
        //     } else {
        //         return change.showInDiffView();
        //     }
        // });
    }

    // public getChangesForFinalMode(): ViewUnifiedChange[] {
    //     // return this.getAllChangingObjectsSorted().filter(change => {
    //     //     return change.showInFinalView();
    //     // });
    //     throw new Error('Todo');
    // }

    // public getAllTextChangingObjects(): ViewUnifiedChange[] {
    //     // return this.getAllChangingObjectsSorted().filter((obj: ViewUnifiedChange) => !obj.isTitleChange());
    //     throw new Error('Todo');
    // }

    // public getTitleChangingObject(): ViewUnifiedChange {
    //     if (this.changeRecommendations) {
    //         return this.changeRecommendations.find(change => change.isTitleChange());
    //     } else {
    //         return null;
    //     }
    // }

    // public getTitleWithChanges(): string {
    //     return this.changeRecoRepo.getTitleWithChanges
    //      this.motion.title, this.getTitleChangingObject(), this.crMode);
    // }

    /**
     * Trigger to delete the motion.
     */
    public async deleteMotionButton(): Promise<void> {
        const title = this.translate.instant('Are you sure you want to delete this motion?');
        const content = this.motion.getTitle();
        if (await this.promptService.open(title, content)) {
            await this.repo.delete(this.motion);
            this.router.navigate(['../motions/']);
        }
    }

    public setLineNumberingMode(mode: LineNumberingMode): void {
        console.log('changeLineNumbering', mode);
        this.lnMode = mode;
    }

    // /**
    //  * Sets the motions change reco mode
    //  * @param mode The mode
    //  */
    // public setChangeRecoMode(mode: ChangeRecoMode): void {
    //     this.crMode = mode;
    // }

    // /**
    //  * Highlights the line and scrolls to it
    //  * @param {number} line
    //  */
    // public gotoHighlightedLine(line: number): void {
    //     const maxLineNumber = this.repo.getLastLineNumber(this.motion, this.lineLength);
    //     if (line >= maxLineNumber) {
    //         return;
    //     }

    //     this.highlightedLine = line;
    //     // setTimeout necessary for DOM-operations to work
    //     window.setTimeout(() => {
    //         const element = <HTMLElement>this.el.nativeElement;

    //         // We only scroll if it's not in the screen already
    //         const bounding = element
    //             .querySelector('.os-line-number.line-number-' + line.toString(10))
    //             .getBoundingClientRect();
    //         if (bounding.top >= 0 &&
    //             bounding.bottom <= (window.innerHeight || document.documentElement.clientHeight)) {
    //             return;
    //         }

    //         let target: Element;
    //         // to make the selected line not stick at the very top of the screen, and to prevent it from being
    //         // conceiled from the header, we actually scroll to a element a little bit above.
    //         if (line > 4) {
    //             target = element.querySelector('.os-line-number.line-number-' + (line - 4).toString(10));
    //         } else {
    //             target = element.querySelector('.title-line');
    //         }
    //         target.scrollIntoView({ behavior: 'smooth' });
    //     }, 1);
    // }

    /**
     * In the original version, the title has been clicked to create a new change recommendation
     */
    public createTitleChangeRecommendation(): void {
        // const data: MotionTitleChangeRecommendationDialogComponentData = {
        //     editChangeRecommendation: false,
        //     newChangeRecommendation: true,
        //     changeRecommendation: this.changeRecoRepo.createTitleChangeRecommendationTemplate(
        //         this.motion,
        //         this.lineLength
        //     )
        // };
        // this.dialogService.open(MotionTitleChangeRecommendationDialogComponent, {
        //     ...infoDialogSettings,
        //     data: data
        // });
        throw new Error('Todo');
    }

    public titleCanBeChanged(): boolean {
        // throw new Error('Todo');
        return false;
        // if (this.editMotion) {
        //     return false;
        // }
        // if (this.motion.isStatuteAmendment() || this.motion.isParagraphBasedAmendment()) {
        //     return false;
        // }
        // return this.isRecoMode(ChangeRecoMode.Original) || this.isRecoMode(ChangeRecoMode.Diff);
    }

    // /**
    //  * In the original version, a change-recommendation-annotation has been clicked
    //  * -> Go to the diff view and scroll to the change recommendation
    //  */
    // public gotoChangeRecommendation(changeRecommendation: ViewMotionChangeRecommendation): void {
    //     this.scrollToChange = changeRecommendation;
    //     this.setChangeRecoMode(ChangeRecoMode.Diff);
    // }

    /**
     * Goes to the amendment creation wizard. Executed via click.
     */
    public createAmendment(): void {
        const amendmentTextMode = this.meetingSettingsService.instant('motions_amendments_text_mode');
        if (amendmentTextMode === 'paragraph') {
            this.router.navigate(['./create-amendment'], { relativeTo: this.route });
        } else {
            this.router.navigate(['./motions/new-amendment'], {
                relativeTo: this.route.snapshot.params.relativeTo,
                queryParams: { parent: this.motion.id || null }
            });
        }
    }

    // /**
    //  * Sets the modified final version to the final version.
    //  */
    // public async createModifiedFinalVersion(): Promise<void> {
    //     if (this.motion.isParagraphBasedAmendment()) {
    //         throw new Error('Cannot create a final version of an amendment.');
    //     }
    //     // Get the final version and remove line numbers
    //     const changes: ViewUnifiedChange[] = Object.assign([], this.getChangesForFinalMode());
    //     // let finalVersion = this.repo.formatMotion(
    //     //     this.motion.id,
    //     //     ChangeRecoMode.Final,
    //     //     changes,
    //     //     this.lineLength,
    //     //     this.highlightedLine
    //     // );
    //     throw new Error('Todo');
    //     // finalVersion = this.linenumberingService.stripLineNumbers(finalVersion);

    //     // Update the motion
    //     try {
    //         // Just confirm this, if there is one modified final version the user would override.
    //         // await this.updateMotion({ modified_final_version: finalVersion }, this.motion);
    //     } catch (e) {
    //         this.raiseError(e);
    //     }
    // }

    // /**
    //  * Deletes the modified final version
    //  */
    // public async deleteModifiedFinalVersion(): Promise<void> {
    //     const title = this.translate.instant('Are you sure you want to delete the print template?');
    //     if (await this.promptService.open(title)) {
    //         // this.finalEditMode = false;
    //         // this.updateMotion({ modified_final_version: '' }, this.motion).then(
    //         //     () => this.setChangeRecoMode(ChangeRecoMode.Final),
    //         //     this.raiseError
    //         // );
    //     }
    // }

    public enterEditMotion(): void {
        this.editMotion = true;
    }

    public leaveEditMotion(): void {
        if (this.newMotion) {
            this.router.navigate(['./motions/']);
        } else {
            this.editMotion = false;
        }
    }

    // /**
    //  * Comes from the head bar
    //  *
    //  * @param mode
    //  */
    // public setEditMode(mode: boolean): void {
    //     console.log('setEditMode', mode, this.newMotion);
    //     if (!mode && this.newMotion) {
    //         this.router.navigate(['./motions/']);
    //     } else {
    //         this.editMotion = mode;
    //     }
    //     // if (mode) {
    //     //     this.patchForm(this.motion);
    //     //     this.editNotificationSubscription = this.listenToEditNotification();
    //     //     this.sendEditNotification(MotionEditNotificationType.TYPE_BEGIN_EDITING_MOTION);
    //     // }
    //     // // If the user cancels the work on this motion,
    //     // // notify the users who are still editing the same motion
    //     // if (!mode && !this.newMotion) {
    //     //     this.unsubscribeEditNotifications(MotionEditNotificationType.TYPE_CLOSING_EDITING_MOTION);
    //     // }
    // }

    // /**
    //  * Sets the default workflow ID during form creation
    //  */
    // public updateWorkflowIdForCreateForm(paragraph?: number): void {
    //     let configKey: keyof Settings;

    //     if (!!this.contentForm.get('statute_amendment').value && !!paragraph) {
    //         configKey = 'motions_default_statute_amendment_workflow_id';
    //     } else if (!!this.route.snapshot.queryParams.parent) {
    //         configKey = 'motions_default_amendment_workflow_id';
    //     } else {
    //         configKey = 'motions_default_workflow_id';
    //     }
    //     const workflowId = this.meetingSettingsService.instant(configKey);
    //     this.contentForm.patchValue({ workflow_id: +workflowId });
    // }

    // /**
    //  * If the checkbox is deactivated, the statute_paragraph_id-field needs to be reset, as only that field is saved
    //  *
    //  * @param {MatCheckboxChange} $event
    //  */
    // public onStatuteAmendmentChange($event: MatCheckboxChange): void {
    //     this.contentForm.patchValue({
    //         statute_paragraph_id: null
    //     });
    //     this.updateWorkflowIdForCreateForm();
    // }

    // /**
    //  * The paragraph of the statute to amend was changed -> change the input fields below
    //  *
    //  * @param {number} newValue
    //  */
    // public onStatuteParagraphChange(newValue: number): void {
    //     const selectedParagraph = this.statuteParagraphs.find(par => par.id === newValue);
    //     this.contentForm.patchValue({
    //         title: this.translate.instant('Statute amendment for') + ` ${selectedParagraph.title}`,
    //         text: selectedParagraph.text
    //     });
    //     this.updateWorkflowIdForCreateForm(newValue);
    // }

    /**
     * Navigates the user to the given ViewMotion
     *
     * @param motion target
     */
    public navigateToMotion(motion: ViewMotion): void {
        if (motion) {
            this.router.navigate([`../${motion.id}`], { relativeTo: this.route.parent });
            // update the current motion
            this.motion = motion;
            this.setSurroundingMotions();
        }
    }

    /**
     * Sets the previous and next motion. Sorts by the current sorting as used
     * in the {@link MotionSortListService} or {@link AmendmentSortListService},
     * respectively
     */
    public setSurroundingMotions(): void {
        const indexOfCurrent = this.sortedMotions.findIndex(motion => {
            return motion === this.motion;
        });
        if (indexOfCurrent > 0) {
            this.previousMotion = this.sortedMotions[indexOfCurrent - 1];
        } else {
            this.previousMotion = null;
        }
        if (indexOfCurrent > -1 && indexOfCurrent < this.sortedMotions.length - 1) {
            this.nextMotion = this.sortedMotions[indexOfCurrent + 1];
        } else {
            this.nextMotion = null;
        }
        this.cd.markForCheck();
    }

    // /**
    //  * Supports the motion (as requested user)
    //  */
    // public support(): void {
    //     this.repo.support(this.motion).catch(this.raiseError);
    // }

    // /**
    //  * Unsupports the motion
    //  */
    // public unsupport(): void {
    //     this.repo.unsupport(this.motion).catch(this.raiseError);
    // }

    // /**
    //  * Opens the dialog with all supporters.
    //  * TODO: open dialog here!
    //  */
    // public openSupportersDialog(): void {
    //     this.showSupporters = !this.showSupporters;
    // }

    /**
     * Click handler for the pdf button
     */
    public onDownloadPdf(): void {
        this.pdfExport.exportSingleMotion(this.motion, {
            lnMode: this.lnMode === this.LineNumberingMode.Inside ? this.LineNumberingMode.Outside : this.lnMode,
            crMode: this.crMode,
            // export all comment fields as well as personal note
            comments: this.motion.usedCommentSectionIds.concat([PERSONAL_NOTE_ID])
        });
    }

    // /**
    //  * Click handler for attachments
    //  *
    //  * @param attachment the selected file
    //  */
    // public onClickAttachment(attachment: Mediafile): void {
    //     window.open(attachment.url);
    // }

    /**
     * Check if a recommendation can be followed. Checks for permissions and additionally if a recommentadion is present
     */
    public canFollowRecommendation(): boolean {
        if (
            this.perms.isAllowed('createpoll', this.motion) &&
            this.motion.recommendation &&
            this.motion.recommendation.recommendation_label
        ) {
            return true;
        }
        return false;
    }

    /**
     * Handler for the 'follow recommendation' button
     */
    public onFollowRecButton(): void {
        this.repo.followRecommendation(this.motion);
    }

    // public isFavorite(): boolean {
    //     const personalNote = this.motion.getPersonalNote();
    //     return personalNote && personalNote.star;
    // }

    // /**
    //  * Function to send a notification, so that other persons can recognize editing the same motion,
    //  * if they're doing.
    //  *
    //  * @param type TypeOfNotificationViewMotion defines the type of the notification which is sent.
    //  * @param user Optional userId. If set the function will send a notification to the given userId.
    //  */
    // private sendEditNotification(type: MotionEditNotificationType, user?: number): void {
    //     const content: MotionEditNotification = {
    //         motionId: this.motion.id,
    //         senderId: this.operator.operatorId,
    //         senderName: this.operator.shortName,
    //         type: type
    //     };
    //     if (user) {
    //         this.notifyService.sendToUsers(this.NOTIFICATION_EDIT_MOTION, content, user);
    //     } else {
    //         this.notifyService.sendToAllUsers<MotionEditNotification>(this.NOTIFICATION_EDIT_MOTION, content);
    //     }
    // }

    // /**
    //  * Tries to determine the realistic CR-Mode from a given CR mode
    //  */
    // private determineCrMode(mode: ChangeRecoMode): ChangeRecoMode {
    //     if (mode === ChangeRecoMode.Final) {
    //         if (this.motion?.modified_final_version) {
    //             return ChangeRecoMode.ModifiedFinal;
    //             /**
    //              * Because without change recos you cannot escape the final version anymore
    //              */
    //         } else if (!this.hasChangingObjects()) {
    //             return ChangeRecoMode.Original;
    //         }
    //     } else if (mode === ChangeRecoMode.Changed && !this.hasChangingObjects()) {
    //         /**
    //          * Because without change recos you cannot escape the changed version view
    //          * You will not be able to automatically change to the Changed view after creating
    //          * a change reco. The autoupdate has to come "after" this routine
    //          */
    //         return ChangeRecoMode.Original;
    //     } else if (
    //         mode === ChangeRecoMode.Diff &&
    //         !this.changeRecommendations?.length &&
    //         this.motion?.isParagraphBasedAmendment()
    //     ) {
    //         /**
    //          * The Diff view for paragraph-based amendments is only relevant for change recommendations;
    //          * the regular amendment changes are shown in the "original" view.
    //          */
    //         return ChangeRecoMode.Original;
    //     }
    //     return mode;
    // }

    // /**
    //  * Function to listen to notifications if the user edits this motion.
    //  * Handles the notification messages.
    //  *
    //  * @returns A subscription, only if the user wants to edit this motion, to listen to notifications.
    //  */
    // private listenToEditNotification(): Subscription {
    //     return this.notifyService.getMessageObservable(this.NOTIFICATION_EDIT_MOTION).subscribe(message => {
    //         const content = <MotionEditNotification>message.content;
    //         if (this.operator.operatorId !== content.senderId && content.motionId === this.motion.id) {
    //             let warning = '';

    //             switch (content.type) {
    //                 case MotionEditNotificationType.TYPE_BEGIN_EDITING_MOTION:
    //                 case MotionEditNotificationType.TYPE_ALSO_EDITING_MOTION: {
    //                     if (!this.otherWorkOnMotion.includes(content.senderName)) {
    //                         this.otherWorkOnMotion.push(content.senderName);
    //                     }

    //                     warning = `${this.translate.instant('Following users are currently editing this motion:')} ${
    //                         this.otherWorkOnMotion
    //                     }`;
    //                     if (content.type === MotionEditNotificationType.TYPE_BEGIN_EDITING_MOTION) {
    //                         this.sendEditNotification(
    //                             MotionEditNotificationType.TYPE_ALSO_EDITING_MOTION,
    //                             message.senderUserId
    //                         );
    //                     }
    //                     break;
    //                 }
    //                 case MotionEditNotificationType.TYPE_CLOSING_EDITING_MOTION: {
    //                     this.recognizeOtherWorkerOnMotion(content.senderName);
    //                     break;
    //                 }
    //                 case MotionEditNotificationType.TYPE_SAVING_EDITING_MOTION: {
    //                     warning = `${content.senderName} ${this.translate.instant(
    //                         'has saved his work on this motion.'
    //                     )}`;
    //                     // Wait, to prevent overlapping snack bars
    //                     setTimeout(() => this.recognizeOtherWorkerOnMotion(content.senderName), 2000);
    //                     break;
    //                 }
    //             }

    //             if (warning !== '') {
    //                 this.raiseWarning(warning);
    //             }
    //         }
    //     });
    // }

    // /**
    //  * Function to handle leaving persons and
    //  * recognize if there is no other person editing the same motion anymore.
    //  *
    //  * @param senderName The name of the sender who has left the editing-view.
    //  */
    // private recognizeOtherWorkerOnMotion(senderName: string): void {
    //     this.otherWorkOnMotion = this.otherWorkOnMotion.filter(value => value !== senderName);
    //     if (this.otherWorkOnMotion.length === 0) {
    //         this.closeSnackBar();
    //     }
    // }

    // /**
    //  * Function to unsubscribe the notification subscription.
    //  * Before unsubscribing a notification will send with the reason.
    //  *
    //  * @param unsubscriptionReason The reason for the unsubscription.
    //  */
    // private unsubscribeEditNotifications(unsubscriptionReason: MotionEditNotificationType): void {
    //     if (this.editNotificationSubscription && !this.editNotificationSubscription.closed) {
    //         this.sendEditNotification(unsubscriptionReason);
    //         this.closeSnackBar();
    //         this.editNotificationSubscription.unsubscribe();
    //     }
    // }

    // /**
    //  * Submits the modified final version of the motion
    //  */
    // public onSubmitFinalVersion(): void {
    //     throw new Error('Todo');
    //     // const val = this.contentForm.get('modified_final_version').value;
    //     // this.updateMotion({ modified_final_version: val }, this.motion).then(() => {
    //     //     this.finalEditMode = false;
    //     //     this.contentForm.get('modified_final_version').markAsPristine();
    //     // }, this.raiseError);
    // }

    // /**
    //  * Cancels the final version edit and resets the form value
    //  *
    //  * TODO: the tinyMCE editor content should reset, too
    //  */
    // public cancelFinalVersionEdit(): void {
    //     // this.finalEditMode = false;
    //     throw new Error('Todo');
    //     // this.contentForm.patchValue({ modified_final_version: this.motion.modified_final_version });
    // }

    // /**
    //  * Toggles the favorite status
    //  */
    // public toggleFavorite(): void {
    //     throw new Error('TODO');
    //     /*if (!this.motion.personalNote) {
    //         this.motion.personalNote = {
    //             note: '',
    //             star: true
    //         };
    //     } else {
    //         this.motion.personalNote.star = !this.motion.personalNote.star;
    //     }
    //     this.personalNoteService.savePersonalNote(this.motion, this.motion.personalNote).catch(this.raiseError);
    //     */
    // }

    /**
     * Handler for upload errors
     *
     * @param error the error message passed by the upload component
     */
    public showUploadError(error: string): void {
        this.raiseError(error);
    }

    /**
     * Function to prevent automatically closing the window/tab,
     * if the user is editing a motion.
     *
     * @param event The event object from 'onUnbeforeUnload'.
     */
    @HostListener('window:beforeunload', ['$event'])
    public stopClosing(event: Event): void {
        if (this.editMotion) {
            // event.returnValue = null;
        }
    }

    // public async createNewSubmitter(username: string): Promise<void> {
    //     const newUserObj = await this.createNewUser(username);
    //     this.addNewUserToFormCtrl(newUserObj, 'submitters_id');
    // }

    // public async createNewSupporter(username: string): Promise<void> {
    //     const newUserObj = await this.createNewUser(username);
    //     this.addNewUserToFormCtrl(newUserObj, 'supporters_id');
    // }

    // private addNewUserToFormCtrl(newUserObj: NewUser, controlName: string): void {
    //     const control = this.contentForm.get(controlName);
    //     let currentSubmitters: number[] = control.value;
    //     if (currentSubmitters?.length) {
    //         currentSubmitters.push(newUserObj.id);
    //     } else {
    //         currentSubmitters = [newUserObj.id];
    //     }
    //     control.setValue(currentSubmitters);
    // }

    // private createNewUser(username: string): Promise<NewUser> {
    //     return this.userRepo.createFromString(username);
    // }

    public swipe(e: TouchEvent, when: string): void {
        const coord: [number, number] = [e.changedTouches[0].pageX, e.changedTouches[0].pageY];
        const time = new Date().getTime();
        if (when === 'start') {
            this.swipeCoord = coord;
            this.swipeTime = time;
        } else if (when === 'end') {
            const direction = [coord[0] - this.swipeCoord[0], coord[1] - this.swipeCoord[1]];
            const duration = time - this.swipeTime;

            if (
                duration < 1000 &&
                Math.abs(direction[0]) > 30 && // swipe length to be detected
                Math.abs(direction[0]) > Math.abs(direction[1] * 3) // 30° should be "horizontal enough"
            ) {
                if (
                    direction[0] > 0 // swipe left to right
                ) {
                    this.navigateToMotion(this.previousMotion);
                }

                if (
                    direction[0] < 0 // swipe left to right
                ) {
                    this.navigateToMotion(this.nextMotion);
                }
            }
        }
    }

    // /**
    //  * Activates the 'edit final version' mode
    //  */
    // public editModifiedFinal(): void {
    //     // this.finalEditMode = true;
    // }

    public addToAgenda(): void {
        this.itemRepo.addItemToAgenda(this.motion).catch(this.raiseError);
    }

    public removeFromAgenda(): void {
        this.itemRepo.removeFromAgenda(this.motion.agenda_item).catch(this.raiseError);
    }

    /**
     * Helper function so UI elements can call to detect changes
     */
    public detectChanges(): void {
        this.cd.markForCheck();
    }

    // public openDialog(): void {
    //     const dialogData = {
    //         collection: ViewMotionPoll.COLLECTION,
    //         motion_id: this.motion.id,
    //         motion: this.motion,
    //         ...this.motionPollService.getDefaultPollData(this.motion.id)
    //     };

    //     this.pollDialog.openDialog(dialogData);
    // }
}
