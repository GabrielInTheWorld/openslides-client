import { Injectable } from '@angular/core';

import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { AgendaItemRepositoryService, AgendaListTitle } from '../agenda/agenda-item-repository.service';
import { MotionAction } from 'app/core/actions/motion-action';
import { DEFAULT_FIELDSET, Fieldsets, Follow } from 'app/core/core-services/model-request-builder.service';
import { OperatorService } from 'app/core/core-services/operator.service';
import { DiffLinesInParagraph, DiffService } from 'app/core/ui-services/diff.service';
import { MeetingSettingsService } from 'app/core/ui-services/meeting-settings.service';
import { TreeIdNode } from 'app/core/ui-services/tree.service';
import { Identifiable } from 'app/shared/models/base/identifiable';
import { Motion } from 'app/shared/models/motions/motion';
import { ViewUnifiedChange, ViewUnifiedChangeType } from 'app/shared/models/motions/view-unified-change';
import { createAgendaItem } from 'app/shared/utils/create-agenda-item';
import { ViewMotion } from 'app/site/motions/models/view-motion';
import {
    ViewMotionAmendedParagraph,
    ViewMotionAmendedParagraphs
} from 'app/site/motions/models/view-motion-amended-paragraph';
import { ViewMotionChangeRecommendation } from 'app/site/motions/models/view-motion-change-recommendation';
import { ViewMotionStatuteParagraph } from 'app/site/motions/models/view-motion-statute-paragraph';
import { ChangeRecoMode } from 'app/site/motions/motions.constants';
import { BaseIsAgendaItemAndListOfSpeakersContentObjectRepository } from '../base-is-agenda-item-and-list-of-speakers-content-object-repository';
import { LineNumberedString, LinenumberingService, LineNumberRange } from '../../ui-services/linenumbering.service';
import { MotionLineNumberingService } from './motion-line-numbering.service';
import { RepositoryServiceCollector } from '../repository-service-collector';

type SortProperty = 'sort_weight' | 'number';

// /**
//  * Describes the single paragraphs from the base motion.
//  */
// export interface ParagraphToChoose {
//     /**
//      * The paragraph number.
//      */
//     paragraphNo: number;

//     /**
//      * The raw HTML of this paragraph.
//      */
//     html: string;

//     /**
//      * The first line number
//      */
//     lineFrom: number;

//     /**
//      * The last line number
//      */
//     lineTo: number;
// }

export const GET_POSSIBLE_RECOMMENDATIONS: Follow = {
    idField: 'workflow_id',
    follow: [
        {
            idField: 'state_ids',
            fieldset: ['recommendation_label', 'show_recommendation_extension_field']
        }
    ]
};

/**
 * Repository Services for motions (and potentially categories)
 *
 * The repository is meant to process domain objects (those found under
 * shared/models), so components can display them and interact with them.
 *
 * Rather than manipulating models directly, the repository is meant to
 * inform the {@link ActionService} about changes which will send
 * them to the Server.
 */
@Injectable({
    providedIn: 'root'
})
export class MotionRepositoryService extends BaseIsAgendaItemAndListOfSpeakersContentObjectRepository<
    ViewMotion,
    Motion
> {
    /**
     * The property the incoming data is sorted by
     */
    protected sortProperty: SortProperty;

    /**
     * Line length of a motion
     */
    private motionLineLength: number;

    public constructor(
        repositoryServiceCollector: RepositoryServiceCollector,
        agendaItemRepo: AgendaItemRepositoryService,
        private meetingsSettingsService: MeetingSettingsService,
        private motionLineNumbering: MotionLineNumberingService,
        private operator: OperatorService
    ) {
        super(repositoryServiceCollector, Motion, agendaItemRepo);
        this.meetingsSettingsService.get('motions_default_sorting').subscribe(conf => {
            this.sortProperty = conf as SortProperty;
            this.setConfigSortFn();
        });

        this.meetingsSettingsService.get('motions_line_length').subscribe(lineLength => {
            this.motionLineLength = lineLength;
        });
    }

    public create(partialMotion: Partial<MotionAction.CreatePayload>): Promise<Identifiable> {
        const payload: MotionAction.CreatePayload = {
            meeting_id: this.activeMeetingIdService.meetingId,
            title: partialMotion.title,
            text: partialMotion.text,
            origin_id: partialMotion.origin_id,
            submitter_ids: partialMotion.submitter_ids,
            workflow_id: partialMotion.workflow_id,
            category_id: partialMotion.category_id,
            attachment_ids: partialMotion.attachment_ids,
            reason: partialMotion.reason,
            number: partialMotion.number,
            block_id: partialMotion.block_id,
            state_extension: partialMotion.state_extension,
            statute_paragraph_id: partialMotion.statute_paragraph_id,
            sort_parent_id: partialMotion.sort_parent_id,
            tag_ids: partialMotion.tag_ids,
            supporter_ids: partialMotion.supporter_ids,
            ...createAgendaItem(partialMotion)
        };
        return this.sendActionToBackend(MotionAction.CREATE, payload);
    }

    public update(update: Partial<Motion>, viewModel: ViewMotion): Promise<void> {
        const payload: MotionAction.UpdatePayload = {
            id: viewModel.id,
            number: update.number,
            modified_final_version: update.modified_final_version,
            reason: update.reason,
            text: update.text,
            title: update.title
        };
        return this.sendActionToBackend(MotionAction.UPDATE, payload);
    }

    private updateMetadata(update: Partial<MotionAction.UpdateMetadataPayload>, viewMotion: ViewMotion): Promise<void> {
        const payload: MotionAction.UpdateMetadataPayload = {
            id: viewMotion.id,
            attachment_ids: update.attachment_ids,
            category_id: update.category_id,
            block_id: update.block_id,
            recommendation_extension: update.recommendation_extension,
            state_extension: update.state_extension,
            supporter_ids: update.supporter_ids,
            tag_ids: update.tag_ids
        };
        return this.sendActionToBackend(MotionAction.UPDATE_METADATA, payload);
    }

    public delete(viewModel: ViewMotion): Promise<void> {
        return this.sendActionToBackend(MotionAction.DELETE, { id: viewModel.id });
    }

    public getFieldsets(): Fieldsets<Motion> {
        const titleFields: (keyof Motion)[] = ['title', 'number'];
        const listFields: (keyof Motion)[] = titleFields.concat([
            'sequential_number',
            'sort_weight',
            'category_weight',
            'lead_motion_id', // needed for filtering
            'amendment_ids'
        ]);
        const blockListFields: (keyof Motion)[] = titleFields.concat(['block_id']);
        const detailFields: (keyof Motion)[] = titleFields.concat([
            'sequential_number',
            'text',
            'reason',
            'modified_final_version',
            'state_extension',
            'recommendation_extension',
            'agenda_item_id' // for add/remove from agenda
        ]);
        const amendmentFields: (keyof Motion)[] = listFields.concat(['lead_motion_id', 'amendment_ids']);
        const callListFields: (keyof Motion)[] = titleFields.concat(['sort_weight', 'sort_parent_id']);
        return {
            [DEFAULT_FIELDSET]: detailFields,
            list: listFields,
            blockList: blockListFields,
            callList: callListFields,
            title: titleFields,
            amendment: amendmentFields
        };
    }

    public getTitle = (viewMotion: ViewMotion) => {
        if (viewMotion.number) {
            return `${viewMotion.number}: ${viewMotion.title}`;
        } else {
            return viewMotion.title;
        }
    };

    public getNumberOrTitle = (viewMotion: ViewMotion) => {
        if (viewMotion.number) {
            return viewMotion.number;
        } else {
            return viewMotion.title;
        }
    };

    public getAgendaSlideTitle = (viewMotion: ViewMotion) => {
        const numberPrefix = this.agendaItemRepo.getItemNumberPrefix(viewMotion);
        // if the number is set, the title will be 'Motion <number>'.
        if (viewMotion.number) {
            return `${numberPrefix} ${this.translate.instant('Motion')} ${viewMotion.number}`;
        } else {
            return `${numberPrefix} ${viewMotion.title}`;
        }
    };

    public getAgendaListTitle = (viewMotion: ViewMotion) => {
        const numberPrefix = this.agendaItemRepo.getItemNumberPrefix(viewMotion);
        // Append the verbose name only, if not the special format 'Motion <number>' is used.
        let title;
        if (viewMotion.number) {
            title = `${numberPrefix}${this.translate.instant('Motion')} ${viewMotion.number} · ${viewMotion.title}`;
        } else {
            title = `${numberPrefix}${viewMotion.title} (${this.getVerboseName()})`;
        }
        const agendaTitle: AgendaListTitle = { title };

        if (viewMotion.submittersAsUsers && viewMotion.submittersAsUsers.length) {
            agendaTitle.subtitle = `${this.translate.instant('by')} ${viewMotion.submittersAsUsers.join(', ')}`;
        }
        return agendaTitle;
    };

    public getVerboseName = (plural: boolean = false) => {
        return this.translate.instant(plural ? 'Motions' : 'Motion');
    };

    public getProjectorTitle = (viewMotion: ViewMotion) => {
        const subtitle =
            viewMotion.agenda_item && viewMotion.agenda_item.comment ? viewMotion.agenda_item.comment : null;
        return { title: this.getAgendaSlideTitle(viewMotion), subtitle };
    };

    protected createViewModel(model: Motion): ViewMotion {
        const viewModel = super.createViewModel(model);

        viewModel.getNumberOrTitle = () => this.getNumberOrTitle(viewModel);
        viewModel.getProjectorTitle = () => this.getProjectorTitle(viewModel);

        viewModel.getAmendmentParagraphLines = () => {
            if (viewModel.lead_motion && viewModel.isParagraphBasedAmendment()) {
                const changeRecos = viewModel.change_recommendations.filter(changeReco => changeReco.showInFinalView());
                return this.motionLineNumbering.getAmendmentParagraphLines(
                    viewModel,
                    this.motionLineLength,
                    ChangeRecoMode.Changed,
                    changeRecos,
                    false
                );
            } else {
                return [];
            }
        };

        return viewModel;
    }

    /**
     * Set the state of a motion
     *
     * @param viewMotion target motion
     * @param stateId the number that indicates the state
     */
    public async setState(viewMotion: ViewMotion, stateId: number): Promise<void> {
        const payload: MotionAction.SetStatePayload = { id: viewMotion.id, state_id: stateId };
        await this.sendActionToBackend(MotionAction.SET_STATE, payload);
    }

    public async resetState(viewMotion: ViewMotion): Promise<void> {
        const payload: MotionAction.ResetStatePayload = { id: viewMotion.id };
        return this.sendActionToBackend(MotionAction.RESET_STATE, payload);
    }

    /**
     * Set the recommenders state of a motion
     *
     * @param viewMotion target motion
     * @param recommendationId the number that indicates the recommendation
     */
    public async setRecommendation(viewMotion: ViewMotion, recommendationId: number): Promise<void> {
        const payload: MotionAction.SetRecommendationPayload = {
            id: viewMotion.id,
            recommendation_id: recommendationId
        };
        await this.sendActionToBackend(MotionAction.SET_RECOMMENDATION, payload);
    }

    public async resetRecommendation(viewMotion: ViewMotion): Promise<void> {
        const payload: MotionAction.ResetRecommendationPayload = { id: viewMotion.id };
        return this.sendActionToBackend(MotionAction.RESET_RECOMMENDATION, payload);
    }

    /**
     * Set the state of motions in bulk
     *
     * @param viewMotions target motions
     * @param stateId the number that indicates the state
     */
    public async setMultiState(viewMotions: ViewMotion[], stateId: number): Promise<void> {
        const payload: MotionAction.SetStatePayload[] = viewMotions.map(motion => {
            return { id: motion.id, state_id: stateId };
        });
        await this.sendBulkActionToBackend(MotionAction.UPDATE_METADATA, payload);
    }

    /**
     * Set the motion blocks of motions in bulk
     *
     * @param viewMotions target motions
     * @param motionblockId the number that indicates the motion block
     */
    public async setMultiMotionBlock(viewMotions: ViewMotion[], motionblockId: number): Promise<void> {
        const payload: MotionAction.UpdateMetadataPayload[] = viewMotions.map(motion => {
            return { id: motion.id, block_id: motionblockId };
        });
        await this.sendBulkActionToBackend(MotionAction.UPDATE_METADATA, payload);
    }

    /**
     * Set the category of motions in bulk
     *
     * @param viewMotions target motions
     * @param categoryId the number that indicates the category
     */
    public async setMultiCategory(viewMotions: ViewMotion[], categoryId: number): Promise<void> {
        const payload: MotionAction.UpdateMetadataPayload[] = viewMotions.map(motion => {
            return { id: motion.id, category_id: categoryId };
        });
        await this.sendBulkActionToBackend(MotionAction.UPDATE_METADATA, payload);
    }

    /**
     * Set the category of a motion
     *
     * @param viewMotion target motion
     * @param categoryId the number that indicates the category
     */
    public async setCategory(viewMotion: ViewMotion, categoryId: number): Promise<void> {
        return this.updateMetadata({ category_id: categoryId }, viewMotion);
    }

    /**
     * Add the motion to a motion block
     *
     * @param viewMotion the motion to add
     * @param blockId the ID of the motion block
     */
    public async setBlock(viewMotion: ViewMotion, blockId: number): Promise<void> {
        return this.updateMetadata({ block_id: blockId }, viewMotion);
    }

    /**
     * Adds new or removes existing tags from motions
     *
     * @param viewMotion the motion to tag
     * @param tagId the tags id to add or remove
     */
    public async toggleTag(viewMotion: ViewMotion, tagId: number): Promise<void> {
        const tag_ids = viewMotion.motion.tag_ids?.map(tag => tag) || [];
        const tagIndex = tag_ids.findIndex(tag => tag === tagId);

        if (tagIndex === -1) {
            // add tag to motion
            tag_ids.push(tagId);
        } else {
            // remove tag from motion
            tag_ids.splice(tagIndex, 1);
        }
        return this.updateMetadata({ tag_ids: tag_ids }, viewMotion);
    }

    /**
     * Sets the submitters by sending a request to the server,
     *
     * @param viewMotion The motion to change the submitters from
     * @param submitterUserIds The submitters to set
     */
    public async setSubmitters(viewMotion: ViewMotion, submitterUserIds: number[]): Promise<void> {
        return this.update({ submitter_ids: submitterUserIds }, viewMotion);
    }

    /**
     * Sends the changed nodes to the server.
     *
     * @param data The reordered data from the sorting
     */
    public async sortMotions(data: TreeIdNode[]): Promise<void> {
        const payload: MotionAction.SortPayload = {
            meeting_id: this.activeMeetingIdService.meetingId,
            tree: data
        };
        return await this.sendActionToBackend(MotionAction.SORT, payload);
    }

    /**
     * Supports the motion
     *
     * @param viewMotion target motion
     */
    public async support(viewMotion: ViewMotion): Promise<void> {
        const nextSupporterIds = [...viewMotion.supporter_ids, this.operator.operatorId];
        return this.updateMetadata({ supporter_ids: nextSupporterIds }, viewMotion);
    }

    /**
     * Unsupports the motion
     *
     * @param viewMotion target motion
     */
    public async unsupport(viewMotion: ViewMotion): Promise<void> {
        if (!viewMotion.supporter_ids || !viewMotion.supporter_ids.length) {
            return;
        }
        const nextSupporterIds = viewMotion.supporter_ids.filter(
            supporterId => supporterId !== this.operator.operatorId
        );
        return this.updateMetadata({ supporter_ids: nextSupporterIds }, viewMotion);
    }

    /**
     * Returns an observable returning the amendments to a given motion
     *
     * @param {number} motionId
     * @returns {Observable<ViewMotion[]>}
     */
    public amendmentsTo(motionId: number): Observable<ViewMotion[]> {
        return this.getViewModelListObservable().pipe(
            map((motions: ViewMotion[]): ViewMotion[] => {
                return motions.filter((motion: ViewMotion): boolean => {
                    return motion.lead_motion_id === motionId;
                });
            })
        );
    }

    /**
     * Returns an observable for all motions, that referencing the given motion (via id)
     * in the recommendation.
     */
    public getRecommendationReferencingMotions(motionId: number): Observable<ViewMotion[]> {
        return this.getViewModelListObservable().pipe(
            map((motions: ViewMotion[]): ViewMotion[] => {
                return motions.filter((motion: ViewMotion): boolean => {
                    if (!motion.recommendationExtension) {
                        return false;
                    }

                    // Check, if this motion has the motionId in it's recommendation
                    const placeholderRegex = /\[motion:(\d+)\]/g;
                    let match;
                    while ((match = placeholderRegex.exec(motion.recommendationExtension))) {
                        if (parseInt(match[1], 10) === motionId) {
                            return true;
                        }
                    }

                    return false;
                });
            })
        );
    }

    /**
     * @returns all amendments
     */
    public getAllAmendmentsInstantly(): ViewMotion[] {
        return this.getViewModelList().filter(motion => !!motion.lead_motion_id);
    }

    /**
     * Returns the amendments to a given motion
     *
     * @param motionId the motion ID to get the amendments to
     */
    public getAmendmentsInstantly(motionId: number): ViewMotion[] {
        return this.getViewModelList().filter(motion => motion.lead_motion_id === motionId);
    }

    // /**
    //  * Format the motion text using the line numbering and change
    //  * reco algorithm.
    //  *
    //  * Can be called from detail view and exporter
    //  * @param id Motion ID - will be pulled from the repository
    //  * @param crMode indicator for the change reco mode
    //  * @param changes all change recommendations and amendments, sorted by line number
    //  * @param lineLength the current line
    //  * @param highlightLine the currently highlighted line (default: none)
    //  */
    // public formatMotion(
    //     id: number,
    //     crMode: ChangeRecoMode,
    //     changes: ViewUnifiedChange[],
    //     lineLength: number,
    //     highlightLine?: number
    // ): string {
    //     const targetMotion = this.getViewModel(id);
    //     if (targetMotion && targetMotion.text) {
    //         if (!crMode) {
    //             crMode = ChangeRecoMode.Original;
    //         }

    //         if (!lineLength) {
    //             lineLength = 80;
    //         }

    //         switch (crMode) {
    //             case ChangeRecoMode.Original:
    //                 return this.lineNumbering.insertLineNumbers(targetMotion.text, lineLength, highlightLine);
    //             case ChangeRecoMode.Changed:
    //                 const changeRecommendations = changes.filter(
    //                     change => change.getChangeType() === ViewUnifiedChangeType.TYPE_CHANGE_RECOMMENDATION
    //                 );
    //                 return this.diff.getTextWithChanges(
    //                     targetMotion.text,
    //                     changeRecommendations,
    //                     lineLength,
    //                     highlightLine
    //                 );
    //             case ChangeRecoMode.Diff:
    //                 const text = [];
    //                 const changesToShow = changes.filter(change => change.showInDiffView());
    //                 const motionText = this.lineNumbering.insertLineNumbers(targetMotion.text, lineLength);

    //                 for (let i = 0; i < changesToShow.length; i++) {
    //                     text.push(
    //                         this.diff.extractMotionLineRange(
    //                             motionText,
    //                             {
    //                                 from: i === 0 ? 1 : changesToShow[i - 1].getLineTo(),
    //                                 to: changesToShow[i].getLineFrom()
    //                             },
    //                             true,
    //                             lineLength,
    //                             highlightLine
    //                         )
    //                     );

    //                     text.push(this.diff.getChangeDiff(motionText, changesToShow[i], lineLength, highlightLine));
    //                 }

    //                 text.push(
    //                     this.diff.getTextRemainderAfterLastChange(motionText,
    // changesToShow, lineLength, highlightLine)
    //                 );
    //                 return text.join('');
    //             case ChangeRecoMode.Final:
    //                 const appliedChanges: ViewUnifiedChange[] = changes.filter(change => change.showInFinalView());
    //                 return this.diff.getTextWithChanges(targetMotion.text,
    // appliedChanges, lineLength, highlightLine);
    //             case ChangeRecoMode.ModifiedFinal:
    //                 if (targetMotion.modified_final_version) {
    //                     return this.lineNumbering.insertLineNumbers(
    //                         targetMotion.modified_final_version,
    //                         lineLength,
    //                         highlightLine,
    //                         null,
    //                         1
    //                     );
    //                 } else {
    //                     // Use the final version as fallback, if the modified does not exist.
    //                     return this.formatMotion(id, ChangeRecoMode.Final, changes, lineLength, highlightLine);
    //                 }
    //             default:
    //                 console.error('unrecognized ChangeRecoMode option (' + crMode + ')');
    //                 return null;
    //         }
    //     } else {
    //         return null;
    //     }
    // }

    // public formatStatuteAmendment(
    //     paragraphs: ViewMotionStatuteParagraph[],
    //     amendment: ViewMotion,
    //     lineLength: number
    // ): string {
    //     const origParagraph = paragraphs.find(paragraph => paragraph.id === amendment.statute_paragraph_id);
    //     if (origParagraph) {
    //         let diffHtml = this.diff.diff(origParagraph.text, amendment.text);
    //         diffHtml = this.lineNumbering.insertLineBreaksWithoutNumbers(diffHtml, lineLength, true);
    //         return diffHtml;
    //     }
    // }

    // /**
    //  * Returns the last line number of a motion
    //  *
    //  * @param {ViewMotion} motion
    //  * @param {number} lineLength
    //  * @return {number}
    //  */
    // public getLastLineNumber(motion: ViewMotion, lineLength: number): number {
    //     const numberedHtml = this.lineNumbering.insertLineNumbers(motion.text, lineLength);
    //     const range = this.lineNumbering.getLineNumberRange(numberedHtml);
    //     return range.to;
    // }

    // /**
    //  * Splits a motion into paragraphs, optionally adding line numbers
    //  *
    //  * @param {ViewMotion} motion
    //  * @param {boolean} lineBreaks
    //  * @param {number} lineLength
    //  * @returns {string[]}
    //  */
    // public getTextParagraphs(motion: ViewMotion, lineBreaks: boolean, lineLength: number): string[] {
    //     if (!motion) {
    //         return [];
    //     }
    //     let html = motion.text;
    //     if (lineBreaks) {
    //         html = this.lineNumbering.insertLineNumbers(html, lineLength);
    //     }
    //     return this.lineNumbering.splitToParagraphs(html);
    // }

    // /**
    //  * Returns the data structure used for creating and editing amendments
    //  *
    //  * @param {ViewMotion} motion
    //  * @param {number} lineLength
    //  */
    // public getParagraphsToChoose(motion: ViewMotion, lineLength: number): ParagraphToChoose[] {
    //     const parent = motion.hasLeadMotion ? motion.lead_motion : motion;
    //     return this.getTextParagraphs(parent, true, lineLength).map((paragraph: string, index: number) => {
    //         let localParagraph;
    //         if (motion.hasLeadMotion) {
    //             localParagraph = motion.amendment_paragraph(index) ? motion.amendment_paragraph(index) : paragraph;
    //         } else {
    //             localParagraph = paragraph;
    //         }
    //         return this.extractAffectedParagraphs(localParagraph, index);
    //     });
    // }

    // /**
    //  * To create paragraph based amendments for amendments, creates diffed paragraphs
    //  * for selection
    //  */
    // public getDiffedParagraphToChoose(amendment: ViewMotion, lineLength: number): ParagraphToChoose[] {
    //     if (amendment.hasLeadMotion) {
    //         const parent = amendment.lead_motion;

    //         return this.getTextParagraphs(parent, true, lineLength).map((paragraph: string, index: number) => {
    //             const diffedParagraph = amendment.amendment_paragraph(index)
    //                 ? this.diff.diff(paragraph, amendment.amendment_paragraph(index), lineLength)
    //                 : paragraph;
    //             return this.extractAffectedParagraphs(diffedParagraph, index);
    //         });
    //     } else {
    //         throw new Error('getDiffedParagraphToChoose: given amendment has no parent');
    //     }
    // }

    // /**
    //  * Creates a selectable and editable paragraph
    //  */
    // private extractAffectedParagraphs(paragraph: string, index: number): ParagraphToChoose {
    //     const affected: LineNumberRange = this.lineNumbering.getLineNumberRange(paragraph);
    //     return {
    //         paragraphNo: index,
    //         html: this.lineNumbering.stripLineNumbers(paragraph),
    //         lineFrom: affected.from,
    //         lineTo: affected.to
    //     } as ParagraphToChoose;
    // }

    // /**
    //  * Returns the amended paragraphs by an amendment. Correlates to the amendment_paragraph field,
    //  * but also considers relevant change recommendations.
    //  * The returned array includes "null" values for paragraphs that have not been changed.
    //  *
    //  * @param {ViewMotion} amendment
    //  * @param {number} lineLength
    //  * @param {ViewMotionChangeRecommendation[]} changes
    //  * @param {boolean} includeUnchanged
    //  * @returns {string[]}
    //  */
    // public applyChangesToAmendment(
    //     amendment: ViewMotion,
    //     lineLength: number,
    //     changes: ViewMotionChangeRecommendation[],
    //     includeUnchanged: boolean
    // ): string[] {
    //     const motion = amendment.lead_motion;
    //     const baseParagraphs = this.getTextParagraphs(motion, true, lineLength);

    //     // Changes need to be applied from the bottom up, to prevent conflicts with changing line numbers.
    //     changes.sort((change1: ViewUnifiedChange, change2: ViewUnifiedChange) => {
    //         if (change1.getLineFrom() < change2.getLineFrom()) {
    //             return 1;
    //         } else if (change1.getLineFrom() > change2.getLineFrom()) {
    //             return -1;
    //         } else {
    //             return 0;
    //         }
    //     });

    //     return baseParagraphs.map((paragraph: string, paraNo: number) => {
    //         let paragraphHasChanges = false;

    //         if (amendment.amendment_paragraph(paraNo)) {
    //             // Add line numbers to newText, relative to the baseParagraph, by creating a diff
    //             // to the line numbered base version any applying it right away
    //             const diff = this.diff.diff(paragraph, amendment.amendment_paragraph(paraNo));
    //             paragraph = this.diff.diffHtmlToFinalText(diff);
    //             paragraphHasChanges = true;
    //         }

    //         const affected: LineNumberRange = this.lineNumbering.getLineNumberRange(paragraph);

    //         changes.forEach((change: ViewMotionChangeRecommendation) => {
    //             // Hint: this assumes that change recommendations only affect one specific paragraph, not multiple
    //             if (change.line_from >= affected.from && change.line_from < affected.to) {
    //                 paragraph = this.diff.replaceLines(paragraph, change.text, change.line_from, change.line_to);

    //                 // Reapply relative line numbers
    //                 const diff = this.diff.diff(baseParagraphs[paraNo], paragraph);
    //                 paragraph = this.diff.diffHtmlToFinalText(diff);

    //                 paragraphHasChanges = true;
    //             }
    //         });

    //         if (paragraphHasChanges || includeUnchanged) {
    //             return paragraph;
    //         } else {
    //             return null;
    //         }
    //     });
    // }

    // /**
    //  * Returns all paragraph lines that are affected by the given amendment in diff-format, including context.
    //  *
    //  * Should only be called for paragraph-based amendments.
    //  *
    //  * @param {ViewMotion} amendment
    //  * @param {number} lineLength
    //  * @param {ChangeRecoMode} crMode
    //  * @param {ViewMotionChangeRecommendation[]} changeRecommendations
    //  * @param {boolean} includeUnchanged
    //  * @returns {DiffLinesInParagraph}
    //  */
    // public getAmendmentParagraphLines(
    //     amendment: ViewMotion,
    //     lineLength: number,
    //     crMode: ChangeRecoMode,
    //     changeRecommendations: ViewMotionChangeRecommendation[],
    //     includeUnchanged: boolean
    // ): DiffLinesInParagraph[] {
    //     const motion = amendment.lead_motion;
    //     const baseParagraphs = this.getTextParagraphs(motion, true, lineLength);

    //     let amendmentParagraphs;
    //     if (crMode === ChangeRecoMode.Changed) {
    //         amendmentParagraphs = this.applyChangesToAmendment(amendment, lineLength, changeRecommendations, true);
    //     } else {
    //         amendmentParagraphs = baseParagraphs.map((_: string, paraNo: number) => {
    //             return amendment.amendment_paragraph(paraNo);
    //         });
    //     }

    //     return amendmentParagraphs
    //         ?.map(
    //             (newText: string, paraNo: number): DiffLinesInParagraph => {
    //                 if (newText !== null) {
    //                     return this.diff.getAmendmentParagraphsLines(
    //                         paraNo,
    //                         baseParagraphs[paraNo],
    //                         newText,
    //                         lineLength
    //                     );
    //                 } else {
    //                     return null; // Nothing has changed in this paragraph
    //                 }
    //             }
    //         )
    //         .map((diffLines: DiffLinesInParagraph, paraNo: number) => {
    //             // If nothing has changed and we want to keep unchanged paragraphs for the context,
    //             // return the original text in "textPre"
    //             if (diffLines === null && includeUnchanged) {
    //                 const paragraph_line_range = this.lineNumbering.getLineNumberRange(baseParagraphs[paraNo]);
    //                 return {
    //                     paragraphNo: paraNo,
    //                     paragraphLineFrom: paragraph_line_range.from,
    //                     paragraphLineTo: paragraph_line_range.to,
    //                     diffLineFrom: paragraph_line_range.to,
    //                     diffLineTo: paragraph_line_range.to,
    //                     textPre: baseParagraphs[paraNo],
    //                     text: '',
    //                     textPost: ''
    //                 } as DiffLinesInParagraph;
    //             } else {
    //                 return diffLines;
    //             }
    //         })
    //         .filter((para: DiffLinesInParagraph) => para !== null);
    // }

    // public getAmendmentParagraphLinesTitle(paragraph: DiffLinesInParagraph): string {
    //     if (paragraph.diffLineTo === paragraph.diffLineFrom + 1) {
    //         return this.translate.instant('Line') + ' ' + paragraph.diffLineFrom.toString(10);
    //     } else {
    //         return (
    //             this.translate.instant('Line') +
    //             ' ' +
    //             paragraph.diffLineFrom.toString(10) +
    //             ' - ' +
    //             (paragraph.diffLineTo - 1).toString(10)
    //         );
    //     }
    // }

    // /**
    //  * Returns all paragraphs that are affected by the given amendment as unified change objects.
    //  * Only the affected part of each paragraph is returned.
    //  * Change recommendations to this amendment are considered here, too. That is, if a change recommendation
    //  * for an amendment exists and is not rejected, the changed amendment will be returned here.
    //  *
    //  * @param {ViewMotion} amendment
    //  * @param {number} lineLength
    //  * @param {ViewMotionChangeRecommendation[]} changeRecos
    //  * @returns {ViewMotionAmendedParagraph[]}
    //  */
    // public getAmendmentAmendedParagraphs(
    //     amendment: ViewMotion,
    //     lineLength: number,
    //     changeRecos: ViewMotionChangeRecommendation[]
    // ): ViewMotionAmendedParagraph[] {
    //     const motion = amendment.lead_motion;
    //     const baseParagraphs = this.getTextParagraphs(motion, true, lineLength);
    //     const changedAmendmentParagraphs = this.applyChangesToAmendment(amendment, lineLength, changeRecos, false);

    //     return changedAmendmentParagraphs
    //         ?.map(
    //             (newText: string, paraNo: number): ViewMotionAmendedParagraph => {
    //                 if (newText === null) {
    //                     return null;
    //                 }

    //                 const origText = baseParagraphs[paraNo],
    //                     diff = this.diff.diff(origText, newText),
    //                     affectedLines = this.diff.detectAffectedLineRange(diff);

    //                 if (affectedLines === null) {
    //                     return null;
    //                 }
    //                 const affectedDiff = this.diff.formatDiff(
    //                     this.diff.extractRangeByLineNumbers(diff, affectedLines.from, affectedLines.to)
    //                 );
    //                 const affectedConsolidated = this.diff.diffHtmlToFinalText(affectedDiff);

    //                 return new ViewMotionAmendedParagraph(amendment, paraNo, affectedConsolidated, affectedLines);
    //             }
    //         )
    //         .filter((para: ViewMotionAmendedParagraph) => para !== null);
    // }

    // /**
    //  * For unchanged paragraphs, this returns the original motion paragraph, including line numbers.
    //  * For changed paragraphs, this returns the content of the amendment_paragraph-field,
    //  *     but including line numbers relative to the original motion line numbers,
    //  *     so they can be used for the amendment change recommendations
    //  *
    //  * @param {ViewMotion} amendment
    //  * @param {number} lineLength
    //  * @param {boolean} withDiff
    //  * @returns {LineNumberedString[]}
    //  */
    // public getAllAmendmentParagraphsWithOriginalLineNumbers(
    //     amendment: ViewMotion,
    //     lineLength: number,
    //     withDiff: boolean
    // ): LineNumberedString[] {
    //     const motion = amendment.lead_motion;
    //     const baseParagraphs = this.getTextParagraphs(motion, true, lineLength);

    //     return baseParagraphs.map((origText: string, paraNo: number): string => {
    //         const newText = amendment.amendment_paragraph(paraNo);
    //         if (!newText) {
    //             return origText;
    //         }

    //         const diff = this.diff.diff(origText, newText);

    //         if (withDiff) {
    //             return diff;
    //         } else {
    //             return this.diff.diffHtmlToFinalText(diff);
    //         }
    //     });
    // }

    /**
     * Signals the acceptance of the current recommendation to the server
     *
     * @param motion A ViewMotion
     */
    public async followRecommendation(motion: ViewMotion): Promise<void> {
        if (motion.recommendation_id) {
            const payload: MotionAction.FollowRecommendationPayload = {
                id: motion.id
            };
            return this.sendActionToBackend(MotionAction.FOLLOW_RECOMMENDATION, payload);
        }
    }
    /**
     * Check if a motion currently has any amendments
     *
     * @param motion A viewMotion
     * @returns True if there is at eleast one amendment
     */
    public hasAmendments(motion: ViewMotion): boolean {
        return this.getViewModelList().filter(allMotions => allMotions.lead_motion_id === motion.id).length > 0;
    }

    /**
     * updates the state Extension with the string given, if the current workflow allows for it
     *
     * @param viewMotion
     * @param value
     */
    public async setStateExtension(viewMotion: ViewMotion, value: string): Promise<void> {
        if (viewMotion.state.show_state_extension_field) {
            return this.updateMetadata({ state_extension: value }, viewMotion);
        }
    }

    /**
     * updates the recommendation extension with the string given, if the current workflow allows for it
     *
     * @param viewMotion
     * @param value
     */
    public async setRecommendationExtension(viewMotion: ViewMotion, value: string): Promise<void> {
        if (viewMotion.recommendation.show_recommendation_extension_field) {
            return this.updateMetadata({ recommendation_extension: value }, viewMotion);
        }
    }

    /**
     * Get the label for the motion's current state with the extension
     * attached (if available). For cross-referencing other motions, `[motion:id]`
     * will replaced by the referenced motion's number (see {@link solveExtensionPlaceHolder})
     *
     * @param motion
     * @returns the translated state with the extension attached
     */
    public getExtendedStateLabel(motion: ViewMotion): string {
        if (!motion.state) {
            return null;
        }
        let state = this.translate.instant(motion.state.name);
        if (motion.stateExtension && motion.state.show_state_extension_field) {
            state += ' ' + this.parseMotionPlaceholders(motion.stateExtension);
        }
        return state;
    }

    /**
     * Get the label for the motion's current recommendation with the extension
     * attached (if available)
     *
     * @param motion
     * @returns the translated extension with the extension attached
     */
    public getExtendedRecommendationLabel(motion: ViewMotion): string {
        if (motion.recommendation) {
            let rec = this.translate.instant(motion.recommendation.recommendation_label);
            if (motion.recommendationExtension && motion.recommendation.show_recommendation_extension_field) {
                rec += ' ' + this.parseMotionPlaceholders(motion.recommendationExtension);
            }
            return rec;
        }
        return '';
    }

    /**
     * Replaces any motion placeholder (`[motion:id]`) with the motion's title(s)
     *
     * @param value
     * @returns the string with the motion titles replacing the placeholders
     */
    public parseMotionPlaceholders(value: string): string {
        return value.replace(/\[motion:(\d+)\]/g, (match, id) => {
            const motion = this.getViewModel(id);
            if (motion) {
                return motion.getNumberOrTitle();
            } else {
                return this.translate.instant('<unknown motion>');
            }
        });
    }

    /**
     * Triggers an update for the sort function responsible for the default sorting of data items
     */
    public setConfigSortFn(): void {
        this.setSortFunction((a: ViewMotion, b: ViewMotion) => {
            if (a[this.sortProperty] && b[this.sortProperty]) {
                if (a[this.sortProperty] === b[this.sortProperty]) {
                    return this.languageCollator.compare(a.title, b.title);
                } else {
                    if (this.sortProperty === 'sort_weight') {
                        // handling numerical values
                        return a.sort_weight - b.sort_weight;
                    } else {
                        return this.languageCollator.compare(a[this.sortProperty], b[this.sortProperty]);
                    }
                }
            } else if (a[this.sortProperty]) {
                return -1;
            } else if (b[this.sortProperty]) {
                return 1;
            } else {
                return this.languageCollator.compare(a.title, b.title);
            }
        });
    }

    public changeHasCollissions(change: ViewUnifiedChange, changes: ViewUnifiedChange[]): boolean {
        return (
            changes.filter((otherChange: ViewUnifiedChange) => {
                return (
                    otherChange.getChangeId() !== change.getChangeId() &&
                    ((otherChange.getLineFrom() >= change.getLineFrom() &&
                        otherChange.getLineFrom() < change.getLineTo()) ||
                        (otherChange.getLineTo() > change.getLineFrom() &&
                            otherChange.getLineTo() <= change.getLineTo()) ||
                        (otherChange.getLineFrom() < change.getLineFrom() &&
                            otherChange.getLineTo() > change.getLineTo()))
                );
            }).length > 0
        );
    }
}
