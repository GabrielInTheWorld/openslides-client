import { Component, Input, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { Subscription } from 'rxjs';

import { PersonalNoteAction } from 'app/core/actions/personal-note-action';
import { MotionChangeRecommendationRepositoryService } from 'app/core/repositories/motions/motion-change-recommendation-repository.service';
import { PersonalNoteRepositoryService } from 'app/core/repositories/users/personal-note-repository.service';
import { ComponentServiceCollector } from 'app/core/ui-services/component-service-collector';
import { ViewUnifiedChange } from 'app/shared/models/motions/view-unified-change';
import { PersonalNote } from 'app/shared/models/users/personal-note';
import { infoDialogSettings } from 'app/shared/utils/dialog-settings';
import { BaseComponent } from 'app/site/base/components/base.component';
import { ViewMotion } from 'app/site/motions/models/view-motion';
import { ViewMotionChangeRecommendation } from 'app/site/motions/models/view-motion-change-recommendation';
import { ChangeRecoMode } from 'app/site/motions/motions.constants';
import {
    MotionTitleChangeRecommendationDialogComponent,
    MotionTitleChangeRecommendationDialogComponentData
} from '../motion-title-change-recommendation-dialog/motion-title-change-recommendation-dialog.component';

@Component({
    selector: 'os-motion-manage-title',
    templateUrl: './motion-manage-title.component.html',
    styleUrls: ['./motion-manage-title.component.scss']
})
export class MotionManageTitleComponent extends BaseComponent implements OnInit {
    @Input()
    public motion: ViewMotion;

    @Input()
    public crMode: ChangeRecoMode;

    /**
     * Value for os-motion-detail-diff: when this is set, that component scrolls to the given change
     */
    public scrollToChange: ViewUnifiedChange = null;

    /**
     * Value of the config variable `motions_show_sequential_numbers`
     */
    public showSequential: boolean;

    public changeRecommendations: ViewMotionChangeRecommendation[];

    private get personalNote(): PersonalNote | null {
        return this.motion.getPersonalNote();
    }

    public constructor(
        componentServiceCollector: ComponentServiceCollector,
        private changeRecoRepo: MotionChangeRecommendationRepositoryService,
        private personalNoteRepo: PersonalNoteRepositoryService,
        private dialogService: MatDialog
    ) {
        super(componentServiceCollector);
    }

    public ngOnInit(): void {
        this.subscriptions.push(...this.getSubscriptionsToSettings());
    }

    /**
     * In the original version, the title has been clicked to create a new change recommendation
     */
    public createTitleChangeRecommendation(): void {
        const data: MotionTitleChangeRecommendationDialogComponentData = {
            editChangeRecommendation: false,
            newChangeRecommendation: true,
            changeRecommendation: this.changeRecoRepo.createTitleChangeRecommendationTemplate(this.motion)
        };
        this.dialogService.open(MotionTitleChangeRecommendationDialogComponent, {
            ...infoDialogSettings,
            data: data
        });
    }

    public titleCanBeChanged(): boolean {
        if (this.motion.isStatuteAmendment() || this.motion.isParagraphBasedAmendment()) {
            return false;
        }
        return this.crMode === ChangeRecoMode.Original || this.crMode === ChangeRecoMode.Diff;
    }

    /**
     * In the original version, a change-recommendation-annotation has been clicked
     * -> Go to the diff view and scroll to the change recommendation
     */
    public gotoChangeRecommendation(changeRecommendation: ViewMotionChangeRecommendation): void {
        this.scrollToChange = changeRecommendation;
        // this.setChangeRecoMode(ChangeRecoMode.Diff); // Todo
    }

    public getTitleChangingObject(): ViewUnifiedChange {
        if (this.changeRecommendations) {
            return this.changeRecommendations.find(change => change.isTitleChange());
        } else {
            return null;
        }
    }

    public getTitleWithChanges(): string {
        return this.changeRecoRepo.getTitleWithChanges(this.motion.title, this.getTitleChangingObject(), this.crMode);
    }

    /**
     * Toggles the favorite status
     */
    public toggleFavorite(): void {
        if (this.personalNote) {
            this.updateFavorite();
            // this.motion.personalNote = {
            //     note: '',
            //     star: true
            // };
        } else {
            this.createFavorite();
            // this.motion.personalNote.star = !this.motion.personalNote.star;
        }
        // this.personalNoteService.savePersonalNote(this.motion, this.motion.personalNote).catch(this.raiseError);
    }

    public isFavorite(): boolean {
        const personalNote = this.motion.getPersonalNote();
        return personalNote && personalNote.star;
    }

    private getSubscriptionsToSettings(): Subscription[] {
        return [
            this.meetingSettingService
                .get('motions_show_sequential_number')
                .subscribe(shown => (this.showSequential = shown))
        ];
    }

    private async createFavorite(): Promise<void> {
        const payload: PersonalNoteAction.CreatePayload = {
            content_object_id: this.motion.fqid,
            star: true
        };
        await this.personalNoteRepo.create(payload);
    }

    private async updateFavorite(): Promise<void> {
        await this.personalNoteRepo.update({ star: !this.isFavorite() }, this.personalNote);
    }
}
