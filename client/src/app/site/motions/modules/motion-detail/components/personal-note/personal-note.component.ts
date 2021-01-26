import { Component, Input } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';

import { PersonalNoteAction } from 'app/core/actions/personal-note-action';
import { PersonalNoteRepositoryService } from 'app/core/repositories/users/personal-note-repository.service';
import { ComponentServiceCollector } from 'app/core/ui-services/component-service-collector';
import { PersonalNote } from 'app/shared/models/users/personal-note';
import { BaseComponent } from 'app/site/base/components/base.component';
import { ViewMotion } from 'app/site/motions/models/view-motion';
import { MotionPdfExportService } from 'app/site/motions/services/motion-pdf-export.service';

/**
 * Component for the motion comments view
 */
@Component({
    selector: 'os-personal-note',
    templateUrl: './personal-note.component.html',
    styleUrls: ['./personal-note.component.scss']
})
export class PersonalNoteComponent extends BaseComponent {
    /**
     * The motion, which the personal note belong to.
     */
    @Input()
    public motion: ViewMotion;

    /**
     * The edit form for the note
     */
    public personalNoteForm: FormGroup;

    /**
     * Saves, if the users edits the note.
     */
    public isEditMode = false;

    public get personalNoteText(): string {
        const pn = this.motion.getPersonalNote();
        return pn ? pn.note : '';
    }

    public get hasPersonalNote(): boolean {
        return !!this.motion.getPersonalNote();
    }

    public get personalNote(): PersonalNote | null {
        return this.motion.getPersonalNote();
    }

    /**
     * Constructor. Creates form
     *
     * @param personalNoteService
     * @param formBuilder
     * @param pdfService
     */
    public constructor(
        componentServiceCollector: ComponentServiceCollector,
        formBuilder: FormBuilder,
        private repo: PersonalNoteRepositoryService,
        private pdfService: MotionPdfExportService
    ) {
        super(componentServiceCollector);
        this.personalNoteForm = formBuilder.group({
            note: ['']
        });
    }

    /**
     * Sets up the form.
     */
    public editPersonalNote(): void {
        this.personalNoteForm.reset();
        this.personalNoteForm.patchValue({
            note: this.personalNoteText
        });
        this.isEditMode = true;
    }

    /**
     * Saves the personal note. If it does not exists, it will be created.
     */
    public async savePersonalNote(): Promise<void> {
        if (this.hasPersonalNote) {
            await this.updatePersonalNote();
        } else {
            await this.createPersonalNote();
        }
        this.isEditMode = false;
    }

    /**
     * Triggers a pdf export of the personal note
     */
    public printPersonalNote(): void {
        this.pdfService.exportPersonalNote(this.motion);
    }

    private async createPersonalNote(): Promise<void> {
        const content: PersonalNoteAction.CreatePayload = {
            content_object_id: this.motion.fqid,
            note: this.personalNoteForm.get('note').value,
            star: false
        };
        await this.repo.create(content);
    }

    private async updatePersonalNote(): Promise<void> {
        const note = this.personalNoteForm.get('note').value;
        await this.repo.update({ note }, this.personalNote);
    }
}
